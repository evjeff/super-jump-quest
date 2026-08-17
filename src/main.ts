import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { GameScene } from './scenes/GameScene'
import { wantsTouchControls } from './scenes/TouchPad'
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

/**
 * While the "turn your phone sideways" card is up, stop the game.
 *
 * The card covers the whole screen and nothing shows through it, but the game
 * behind it was still doing every bit of its work sixty times a second — the
 * physics, the spinning coins, a full redraw — and throwing every one of those
 * pictures away. On a phone that is pure battery, and it goes on for as long as
 * the phone is left lying face up.
 *
 * Sleeping the loop is not the same as quitting: everything stays exactly where
 * it was, so turning the phone back picks up mid-jump. It also stops the level
 * clock, which counts the frames the game actually ran — which is the right
 * answer anyway. Rotating the phone shouldn't cost you your best time.
 *
 * This is set up only where the card can appear, so nothing about playing on a
 * computer changes.
 */
if (wantsTouchControls()) {
  const heldUpright = window.matchMedia('(orientation: portrait)')
  const followTheCard = () => {
    if (heldUpright.matches) game.loop.sleep()
    else game.loop.wake()
  }

  heldUpright.addEventListener('change', followTheCard)
  // Not before the game has booted: sending the loop to sleep during start-up
  // would stop it before it ever drew anything, and someone who opens the game
  // already holding the phone upright would turn it and find nothing there.
  game.events.once(Phaser.Core.Events.READY, followTheCard)
}
