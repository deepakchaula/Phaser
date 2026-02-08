import Phaser from "phaser";
import MainScene from "./scenes/MainScene";

const config = {
  type: Phaser.AUTO,
  width: 1000,
  height: 600,
  backgroundColor: "#1b1b1b",
  parent: "app",
  physics: {
    default: "arcade",
    arcade: {
      debug: false,
    },
  },
  scene: [MainScene],
};

new Phaser.Game(config);