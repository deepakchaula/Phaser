import Phaser from "phaser";

export default class MainScene extends Phaser.Scene {
  constructor() {
    super("MainScene");
  }

  init() {
    // Game state
    this.score = 0;
    this.round = 1;
    this.lives = 3;

    // Difficulty
    this.baseBeltSpeed = 120;
    this.beltSpeed = this.baseBeltSpeed;

    this.baseSpawnDelay = 2200;
    this.spawnDelay = this.baseSpawnDelay;

    // Carrying
    this.carriedRack = null;

    // Conveyor layout
    this.beltStartX = 180;

    // Conveyor visual scale
    this.conveyorScale = 0.4;

    // Wheels
    this.middleWheels = [];
  }

  preload() {
    // Conveyor tiles
    this.load.image("beltLeft", "/assets/conveyor/left-CB.png");
    this.load.image("beltMid", "/assets/conveyor/middle-CB-repeat.png");
    this.load.image("beltRight", "/assets/conveyor/right-CB.png");

    // Wheel
    this.load.image("wheel", "/assets/conveyor/wheel.png");

    // Tray
    this.load.image("trayRack", "/assets/items/tray-bottles.png");
    this.load.image("factorySprite", "/assets/factory/full-factory.png");
    this.load.image("truckSprite", "/assets/truck/full-truck.png");
    this.load.image("workerIdleGif", "/assets/worker/worker-idle.gif");
    this.load.spritesheet("workerIdle", "/assets/worker/worker-idle.png", {
      frameWidth: 56,     // change this
      frameHeight: 56,    // change this
    });
  }

  // ------------------------------------------------------------
  // Conveyor builder (Left + N middle tiles + Right)
  // Middle tiles are TileSprites so they can scroll.
  // ------------------------------------------------------------
  createConveyorBelt({ x, y, middleCount = 6, scale = 1 }) {
    const beltContainer = this.add.container(x, y);
    const mids = [];

    // Left cap
    const left = this.add
      .image(0, 0, "beltLeft")
      .setOrigin(0, 0.5)
      .setScale(scale);
    beltContainer.add(left);

    const tileW = left.displayWidth;
    const tileH = left.displayHeight;

    // Middle tiles
    for (let i = 0; i < middleCount; i++) {
      const mid = this.add
        .tileSprite(tileW * (i + 1), 0, tileW, tileH, "beltMid")
        .setOrigin(0, 0.5)
        .setScale(scale);

      beltContainer.add(mid);
      mids.push(mid);
    }

    // Right cap
    const right = this.add
      .image(tileW * (middleCount + 1), 0, "beltRight")
      .setOrigin(0, 0.5)
      .setScale(scale);

    beltContainer.add(right);

    const totalWidth = tileW * (middleCount + 2);

    return {
      container: beltContainer,
      width: totalWidth,
      height: tileH,
      tileW,
      middleCount,
      scale,
      mids,
    };
  }

  create() {
    const { width, height } = this.scale;

    // --- Background FIRST ---
    this.add.rectangle(width / 2, height / 2, width, height, 0x1b1b1b);

    // --- Belt positions ---
    this.beltY = 420;

    // Tray should sit ON TOP of belt.
    // Because tray uses origin(0.5, 1) (bottom),
    // we set tray bottom a little above belt center.
    this.trayBottomY = this.beltY - 20;

    // --- Create conveyor ---
    this.conveyor = this.createConveyorBelt({
      x: this.beltStartX,
      y: this.beltY,
      middleCount: 6,
      scale: 1,
    });

    // Scale down the whole belt
    this.conveyor.container.setScale(this.conveyorScale);
    this.conveyor.container.setDepth(2);

    // IMPORTANT:
    // conveyor.width is UN-SCALED width.
    // actual on-screen width:
    this.actualBeltWidth = this.conveyor.width * this.conveyorScale;

    // Belt end X on screen:
    this.beltEndX = this.beltStartX + this.actualBeltWidth;

    this.beltLeftLimit = this.beltStartX + 15;
    this.beltRightLimit = this.beltStartX + this.actualBeltWidth - 15;

    // --- Factory position (near belt end) ---
    this.factoryX = Phaser.Math.Clamp(this.beltEndX - 30, 0, width - 80);

    this.factory = this.add.image(this.factoryX, this.beltY - 190, "factorySprite");

    // Adjust scale (change if needed)
    this.factory.setScale(1.4);

    // Put factory behind racks but above belt
    this.factory.setDepth(1);

    // Optional label (you can remove)
    // this.factoryText = this.add
    //   .text(this.factoryX - 55, this.beltY - 260, "FACTORY", {
    //     fontSize: "16px",
    //     color: "#ffffff",
    //   })
    //   .setDepth(20);

    // --- Factory Door (spawn point) ---
    // Door is at left edge of factory
    this.factoryDoorX = this.factoryX - 5;
    this.factoryDoorY = this.trayBottomY;

    // Debug door marker (REMOVE later if you want)
    // If you see this red dot, trays will spawn correctly.
    // this.add
    //   .circle(this.factoryDoorX, this.factoryDoorY, 6, 0xff0000)
    //   .setDepth(50);

    // --- Wheels ---
    const wheelY = this.beltY + 7;
    const wheelScale = 0.55;

    // Place 4 wheels evenly across belt
    const totalWheels = 4;
    const spacing = (this.actualBeltWidth - 64) / (totalWheels - 1);

    this.middleWheels = [];

    for (let i = 0; i < totalWheels; i++) {
      const wheelX = this.beltStartX + 32 + i * spacing;

      const wheel = this.add
        .image(wheelX, wheelY, "wheel")
        .setScale(wheelScale)
        .setDepth(5);

      this.middleWheels.push(wheel);

      if (i === 0) this.leftWheel = wheel;
      if (i === totalWheels - 1) this.rightWheel = wheel;
    }

    this.anims.create({
      key: "worker-idle",
      frames: this.anims.generateFrameNumbers("workerIdle", {
        start: 0,
        end: 3, // change this based on total frames
      }),
      frameRate: 10,
      repeat: -1,
    });

    // --- Worker on left side ---
    this.worker = this.physics.add.sprite(230, this.beltY - 55, "workerIdle");

    this.worker.setScale(3);
    this.worker.setDepth(30);

    this.worker.body.setAllowGravity(false);
    this.worker.body.setCollideWorldBounds(true);

    // physics body size (tune later)
    this.worker.body.setSize(18, 28, true);

    // play animation
    this.worker.play("worker-idle");

    // --- Truck behind worker ---
    this.truckX = -40;

    this.truck = this.add.image(this.truckX, this.beltY - 65, "truckSprite");

    // Adjust scale to fit your scene
    this.truck.setScale(0.8);

    // Put truck behind worker + trays
    this.truck.setDepth(6);

    // Optional label (remove if you want)
    // this.truckText = this.add
    //   .text(this.truckX - 35, this.beltY - 240, "TRUCK", {
    //     fontSize: "16px",
    //     color: "#ffffff",
    //   })
    //   .setDepth(20);

    // Truck zone for delivery
    // Truck drop zone (near truck opening)
    this.truckDropZone = this.add.zone(this.truckX + 140, this.beltY - 110, 140, 160);
    this.physics.add.existing(this.truckDropZone);

    this.truckDropZone.body.setAllowGravity(false);
    this.truckDropZone.body.setImmovable(true);

    // --- Racks group ---
    this.racks = this.physics.add.group();

    // --- Controls ---
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys("A,D,E");

    // --- UI ---
    this.ui = this.add.text(20, 20, "", {
      fontSize: "18px",
      color: "#ffffff",
    });

    this.help = this.add.text(20, 60, "Move: A/D or Arrow Keys | Pick: E", {
      fontSize: "16px",
      color: "#bbbbbb",
    });

    this.updateUI();

    // --- Spawner ---
    this.spawnTimer = this.time.addEvent({
      delay: this.spawnDelay,
      callback: this.spawnRack,
      callbackScope: this,
      loop: true,
    });

    // --- Delivery overlap ---
    // this.physics.add.overlap(this.worker, this.truckZone, () => {
    //   this.tryDeliverRack();
    // });

    // --- World bounds ---
    this.physics.world.setBounds(0, 0, width, height);
  }

  // ------------------------------------------------------------
  // Spawn tray exactly from factory door
  // ------------------------------------------------------------
  spawnRack() {
    // Prevent spawning if another tray is still near the door
    for (const r of this.racks.getChildren()) {
      if (!r.active) continue;
      if (r.isCarried) continue;

      if (Math.abs(r.x - this.factoryDoorX) < 120) {
        return;
      }
    }

    const tray = this.physics.add.image(
      this.factoryDoorX,
      this.factoryDoorY,
      "trayRack",
    );

    tray.setScale(0.4);
    tray.setOrigin(0.5, 1);

    tray.body.setAllowGravity(false);
    tray.body.setImmovable(true);
    tray.x = Phaser.Math.Clamp(tray.x, this.beltLeftLimit, this.beltRightLimit);

    tray.isCarried = false;

    // Keep above belt visuals
    tray.setDepth(20);

    this.racks.add(tray);
  }

  // ------------------------------------------------------------
  // Pick tray (closest within range)
  // ------------------------------------------------------------
  tryPickRack() {
    if (this.carriedRack) return;

    const racks = this.racks.getChildren();

    let closest = null;
    let closestDist = 999999;

    for (const r of racks) {
      if (!r.active) continue;
      if (r.isCarried) continue;

      const dist = Phaser.Math.Distance.Between(
        this.worker.x,
        this.worker.y,
        r.x,
        r.y,
      );

      if (dist < 90 && dist < closestDist) {
        closestDist = dist;
        closest = r;
      }
    }

    if (!closest) return;

    this.carriedRack = closest;
    closest.isCarried = true;
    closest.body.setVelocity(0, 0);
  }

  // ------------------------------------------------------------
  // Deliver tray to truck
  // ------------------------------------------------------------
  tryDeliverRack() {
    if (!this.carriedRack) return;

    // Worker must be close to truck drop zone
    const dist = Phaser.Math.Distance.Between(
      this.worker.x,
      this.worker.y,
      this.truckDropZone.x,
      this.truckDropZone.y
    );

    if (dist > 90) return; // too far, don't deliver

    const rackToDeliver = this.carriedRack;
    this.carriedRack = null;

    // Drop animation into truck
    this.tweens.add({
      targets: rackToDeliver,
      x: this.truckDropZone.x,
      y: this.truckDropZone.y + 20,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        rackToDeliver.destroy();
      },
    });

    this.score++;

    if (this.score % 10 === 0) {
      this.round++;
      this.updateDifficulty();
    }

    this.updateUI();
  }

  // ------------------------------------------------------------
  // Difficulty scaling
  // ------------------------------------------------------------
  updateDifficulty() {
    this.beltSpeed = this.baseBeltSpeed + (this.round - 1) * 35;
    this.spawnDelay = Math.max(
      650,
      this.baseSpawnDelay - (this.round - 1) * 250,
    );

    this.spawnTimer.remove(false);
    this.spawnTimer = this.time.addEvent({
      delay: this.spawnDelay,
      callback: this.spawnRack,
      callbackScope: this,
      loop: true,
    });

    this.updateUI();
  }

  updateUI() {
    const carrying = this.carriedRack ? "YES" : "NO";

    this.ui.setText(
      `Score: ${this.score} | Round: ${this.round} | Lives: ${this.lives} | Carrying: ${carrying}\n` +
        `Belt Speed: ${this.beltSpeed} | Spawn: ${this.spawnDelay}ms`,
    );
  }

  update(time, delta) {
    const dt = delta / 1000;

    // --- Rotate wheels ---
    const rotationSpeed = this.beltSpeed * dt * 0.02;

    for (const w of this.middleWheels) {
      w.rotation -= rotationSpeed;
    }

    // --- Animate belt middle tiles ---
    for (const mid of this.conveyor.mids) {
      mid.tilePositionX -= this.beltSpeed * dt * 0.8;
    }

    // --- Worker movement ---
    const speed = 200;

    if (this.cursors.left.isDown || this.keys.A.isDown) {
      this.worker.body.setVelocityX(-speed);
      this.worker.setFlipX(true);
    } else if (this.cursors.right.isDown || this.keys.D.isDown) {
      this.worker.body.setVelocityX(speed);
      this.worker.setFlipX(false);
    } else {
      this.worker.body.setVelocityX(0);
    }

    // --- Pick tray ---
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) {
      // If carrying, try deliver first
      if (this.carriedRack) {
        this.tryDeliverRack();
      } else {
        this.tryPickRack();
      }
    }

    // --- Move trays with belt ---
    for (const r of this.racks.getChildren()) {
      if (!r.active) continue;

      // Skip carried tray
      if (r.isCarried) continue;

      r.x -= this.beltSpeed * dt;

      // Keep bottom aligned to belt top
      r.y = this.trayBottomY;

      // Missed tray
      if (r.x < this.beltLeftLimit) {
        r.destroy();
        this.lives--;

        if (this.lives <= 0) {
          this.gameOver();
          return;
        }

        this.updateUI();
      }
    }

    // --- Carried tray follows worker ---
    if (this.carriedRack) {
      this.carriedRack.x = this.worker.x;

      // Worker is a rectangle, so use this for nice look
      this.carriedRack.y = this.worker.y - 10;
    }
  }

  gameOver() {
    this.physics.pause();

    this.add
      .rectangle(
        this.scale.width / 2,
        this.scale.height / 2,
        520,
        240,
        0x000000,
        1,
      )
      .setOrigin(0.5)
      .setDepth(100);

    this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 40, "GAME OVER", {
        fontSize: "44px",
        color: "#ff5555",
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.add
      .text(
        this.scale.width / 2,
        this.scale.height / 2 + 40,
        `Final Score: ${this.score}`,
        {
          fontSize: "22px",
          color: "#ffffff",
        },
      )
      .setOrigin(0.5)
      .setDepth(100);
  }
}
