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
  input: {
    // Two thumbs at once is the whole point of the on-screen buttons: running
    // and jumping together is one finger on ◀ and another on ▲. One spare on
    // top of that, because a small hand rests a third finger on the glass.
    activePointers: 3,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // The `#game` div is already sized by CSS to the right shape for whatever
    // screen this is — phone, tablet or laptop — so Phaser fits the picture
    // into that rather than resizing the page around it.
    expandParent: false,
  },
  scene: [BootScene, GameScene],
})

window.__GAME__ = game
