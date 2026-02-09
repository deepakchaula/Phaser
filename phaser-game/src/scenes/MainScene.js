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

    // --- Factory position (near belt end) ---
    this.factoryX = Phaser.Math.Clamp(this.beltEndX + 60, 0, width - 80);

    this.factory = this.add
      .rectangle(this.factoryX, this.beltY - 100, 170, 260, 0x444444)
      .setDepth(3);

    this.factoryText = this.add
      .text(this.factoryX - 55, this.beltY - 215, "FACTORY", {
        fontSize: "16px",
        color: "#ffffff",
      })
      .setDepth(10);

    // --- Factory Door (spawn point) ---
    // Door is at left edge of factory
    this.factoryDoorX = this.factoryX - 85;
    this.factoryDoorY = this.trayBottomY;

    // Debug door marker (REMOVE later if you want)
    // If you see this red dot, trays will spawn correctly.
    this.add
      .circle(this.factoryDoorX, this.factoryDoorY, 6, 0xff0000)
      .setDepth(50);

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

    // --- Worker on left side ---
    this.worker = this.add.rectangle(230, this.beltY - 95, 40, 85, 0xffcc00);
    this.physics.add.existing(this.worker);

    this.worker.body.setAllowGravity(false);
    this.worker.body.setCollideWorldBounds(true);

    // --- Truck behind worker ---
    this.truckX = 70;

    this.truck = this.add
      .rectangle(this.truckX, this.beltY - 110, 160, 250, 0x123a66)
      .setDepth(100);

    this.truckText = this.add
      .text(this.truckX - 45, this.beltY - 220, "TRUCK", {
        fontSize: "16px",
        color: "#ffffff",
      })
      .setDepth(100);

    // Truck zone for delivery
    this.truckZone = this.add.zone(this.truckX, this.beltY - 110, 170, 250);
    this.physics.add.existing(this.truckZone);
    this.truckZone.body.setAllowGravity(false);
    this.truckZone.body.setImmovable(true);

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
    this.physics.add.overlap(this.worker, this.truckZone, () => {
      this.tryDeliverRack();
    });

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

    tray.setScale(0.35);
    tray.setOrigin(0.5, 1);

    tray.body.setAllowGravity(false);
    tray.body.setImmovable(true);

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

    const rackToDeliver = this.carriedRack;
    this.carriedRack = null;

    // Simple delivery animation
    this.tweens.add({
      targets: rackToDeliver,
      x: this.truckX,
      y: this.beltY - 150,
      alpha: 0,
      duration: 220,
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
    } else if (this.cursors.right.isDown || this.keys.D.isDown) {
      this.worker.body.setVelocityX(speed);
    } else {
      this.worker.body.setVelocityX(0);
    }

    // --- Pick tray ---
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) {
      this.tryPickRack();
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
      if (r.x < 40) {
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
