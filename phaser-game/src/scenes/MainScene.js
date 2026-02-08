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
  }

  preload() {
    // Conveyor tiles
    this.load.image("beltLeft", "/assets/conveyor/left-CB.png");
    this.load.image("beltMid", "/assets/conveyor/middle-CB.png");
    this.load.image("beltRight", "/assets/conveyor/right-CB.png");
  }

  // ------------------------------------------------------------
  // Conveyor builder (Left + N middle tiles + Right)
  // Middle tiles are TileSprites so they can scroll.
  // ------------------------------------------------------------
  createConveyorBelt({ x, y, middleCount = 9, scale = 1 }) {
    const beltContainer = this.add.container(x, y);
    const mids = [];

    // Left cap
    const left = this.add
      .image(0, 0, "beltLeft")
      .setOrigin(0, 0.5)
      .setScale(scale);
    beltContainer.add(left);

    // Use displayWidth after scaling
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

    // Total width of belt
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

    // --- Background FIRST (so it doesn't cover belt) ---
    this.add.rectangle(width / 2, height / 2, width, height, 0x1b1b1b);

    // --- Belt positions ---
    this.beltY = 420;
    this.rackY = this.beltY - 52;

    // --- Create conveyor using your 3 images ---
    const scale = 1;

    // Create a temporary left tile to know width
    const tempLeft = this.add
      .image(0, 0, "beltLeft")
      .setScale(scale)
      .setVisible(false);
    const tileW = tempLeft.displayWidth;
    tempLeft.destroy();

    // Available belt width on screen
    const availableWidth = width - 360; // keep space for truck + worker + factory
    const middleCount = Math.max(3, Math.floor(availableWidth / tileW) - 2);

    // Create belt with new scale and middle count
    this.conveyor = this.createConveyorBelt({
      x: this.beltStartX,
      y: this.beltY,
      middleCount: 6,
      scale,
    });

    this.conveyor.container.setScale(0.4);

    // --- Factory position (right end of belt) ---
    const beltEndX = this.beltStartX + this.conveyor.width;
    // this.factoryX = beltEndX + 60;
    this.factoryX = Phaser.Math.Clamp(
      beltEndX + 20, // gap = 20px
      0,
      width - 80, // keep factory visible
    );

    // --- Factory block ---
    this.factory = this.add
      .rectangle(this.factoryX, this.beltY - 100, 170, 260, 0x444444)
      .setDepth(10); // Higher number = closer to the camera

    this.factoryText = this.add
      .text(this.factoryX - 55, this.beltY - 215, "FACTORY", {
        fontSize: "16px",
        color: "#ffffff",
      })
      .setDepth(10);

    // --- Worker on left side ---
    this.worker = this.add.rectangle(230, this.beltY - 95, 40, 85, 0xffcc00);
    this.physics.add.existing(this.worker);

    this.worker.body.setAllowGravity(false);
    this.worker.body.setCollideWorldBounds(true);

    // --- Truck behind worker ---
    this.truckX = 70;

    // --- Truck behind worker ---
    this.truck = this.add
      .rectangle(this.truckX, this.beltY - 110, 160, 250, 0x123a66)
      .setDepth(10);

    this.truckText = this.add
      .text(this.truckX - 45, this.beltY - 220, "TRUCK", {
        fontSize: "16px",
        color: "#ffffff",
      })
      .setDepth(10);

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
  // Spawn rack on the belt (right side near factory)
  // ------------------------------------------------------------
  spawnRack() {
    const spawnX = this.beltStartX + this.conveyor.width - 55;

    const rack = this.add.rectangle(spawnX, this.rackY, 70, 45, 0x00d084);
    this.physics.add.existing(rack);

    rack.body.setAllowGravity(false);
    rack.body.setImmovable(true);

    rack.isCarried = false;

    this.racks.add(rack);
  }

  // ------------------------------------------------------------
  // Pick rack (closest within range)
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

      if (dist < 80 && dist < closestDist) {
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
  // Deliver rack to truck
  // ------------------------------------------------------------
  tryDeliverRack() {
    if (!this.carriedRack) return;

    this.carriedRack.destroy();
    this.carriedRack = null;

    const rackToDeliver = this.carriedRack;
    this.carriedRack = null;

    // Move the rack behind the truck before destroying
    this.tweens.add({
        targets: rackToDeliver,
        x: this.truckX,
        alpha: 0,
        duration: 200,
        onComplete: () => {
        rackToDeliver.destroy();
        }
    });

    this.score++;

    // Every 10 deliveries, new round
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

    // Restart timer
    this.spawnTimer.remove(false);
    this.spawnTimer = this.time.addEvent({
      delay: this.spawnDelay,
      callback: this.spawnRack,
      callbackScope: this,
      loop: true,
    });

    this.updateUI();
  }

  // ------------------------------------------------------------
  // UI update
  // ------------------------------------------------------------
  updateUI() {
    const carrying = this.carriedRack ? "YES" : "NO";

    this.ui.setText(
      `Score: ${this.score} | Round: ${this.round} | Lives: ${this.lives} | Carrying: ${carrying}\n` +
        `Belt Speed: ${this.beltSpeed} | Spawn: ${this.spawnDelay}ms`,
    );
  }

  update(time, delta) {
    const dt = delta / 1000;

    // --- Animate belt middle tiles (right-to-left) ---
    for (const mid of this.conveyor.mids) {
      mid.tilePositionX -= this.beltSpeed * dt * 0.6;
    }

    // --- Worker movement (left/right) ---
    const speed = 200;

    if (this.cursors.left.isDown || this.keys.A.isDown) {
      this.worker.body.setVelocityX(-speed);
    } else if (this.cursors.right.isDown || this.keys.D.isDown) {
      this.worker.body.setVelocityX(speed);
    } else {
      this.worker.body.setVelocityX(0);
    }

    // --- Pick rack ---
    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) {
      this.tryPickRack();
    }

    // --- Move racks with belt ---
    for (const r of this.racks.getChildren()) {
      if (!r.active) continue;

      // Skip carried rack
      if (r.isCarried) continue;

      // Belt movement
      r.x -= this.beltSpeed * dt;
      r.y = this.rackY;

      // Missed rack
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

    // --- Carry rack follows worker ---
    if (this.carriedRack) {
      this.carriedRack.x = this.worker.x;
      this.carriedRack.y = this.worker.y - 70;
    }
  }

  gameOver() {
    this.physics.pause();

    this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      520,
      240,
      0x000000,
      0.8,
    );

    this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 40, "GAME OVER", {
        fontSize: "44px",
        color: "#ff5555",
      })
      .setOrigin(0.5);

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
      .setOrigin(0.5);
  }
}
