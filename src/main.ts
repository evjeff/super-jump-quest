import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { GameScene } from './scenes/GameScene'
import { TUNING } from './tuning'

declare global {
  interface Window {
    /** Exposed so the Playwright smoke test can prove the game actually booted. */
    __GAME__?: Phaser.Game
  }
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: TUNING.world.width,
  height: TUNING.world.height,
  backgroundColor: TUNING.colors.sky,
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
  },
  scene: [BootScene, GameScene],
})

window.__GAME__ = game
