import type Phaser from 'phaser'
import type { TouchButton, TouchControlId } from '../game/touchControls'
import {
  justPressed,
  newFingerLanded,
  pressedButtons,
  touchButtonLayout,
} from '../game/touchControls'
import { TUNING } from '../tuning'

/**
 * The on-screen buttons a phone plays with: draws them, and each frame says
 * which ones a finger is on.
 *
 * All the thinking lives in `src/game/touchControls.ts`, which is pure and unit
 * tested. This file is only the drawing and the reading of fingers — the same
 * split the rest of the game uses between `game/` and `scenes/`.
 *
 * The buttons sit ON TOP of the game rather than in a strip beside it, so the
 * picture stays as big as the phone allows. They are mostly see-through rings
 * for that reason: you can watch him run straight through one.
 */

/** Above every sprite, so a finger always has something to press. */
const DEPTH = 1000

/** What one button is made of: a ring, and the symbol inside it. */
type ButtonArt = Phaser.GameObjects.Arc | Phaser.GameObjects.Text

export class TouchPad {
  private readonly buttons: TouchButton[]
  /** The rings and arrows, kept together so they can be hidden all at once. */
  private readonly thumbControls: ButtonArt[] = []

  private held: Set<TouchControlId> = new Set()
  private heldLastFrame: Set<TouchControlId> = new Set()
  /** How many fingers are on the glass — not which, just how many. */
  private fingerCount = 0
  private fingerCountLastFrame = 0

  constructor(private readonly scene: Phaser.Scene) {
    this.buttons = touchButtonLayout({
      width: TUNING.world.width,
      height: TUNING.world.height,
      radius: TUNING.touch.buttonRadius,
      jumpRadius: TUNING.touch.jumpButtonRadius,
      restartRadius: TUNING.touch.restartButtonRadius,
      margin: TUNING.touch.edgeMargin,
      directionGap: TUNING.touch.directionGap,
    })

    for (const button of this.buttons) {
      const drawn = this.draw(button)
      // Restart stays put while the finish banner is up — it's the only way
      // back to level 1 on a phone. The thumb buttons get out of the way.
      if (button.id !== 'restart') this.thumbControls.push(...drawn)
    }

    // A finger already on the glass right now is NOT a new press.
    //
    // This pad is built fresh every time a level starts, and a level usually
    // starts because a finger pressed something: ↻, or a tap past the finish
    // banner. That finger is still down when this runs. Starting from "nothing
    // was pressed" would read it as a brand new press on the very next frame —
    // and holding ↻ would rebuild the level every frame for as long as a thumb
    // stayed on it, freezing him at the spawn point.
    //
    // So take a reading now and treat it as the past. Whatever is down has to
    // be let go and pressed again to count.
    this.read()
    this.heldLastFrame = this.held
    this.fingerCountLastFrame = this.fingerCount
  }

  /**
   * Look at where the fingers are, once per frame, before anything asks.
   *
   * Reading the real positions every frame rather than remembering button
   * presses is what stops a button ever getting stuck down; see the note on
   * `pressedButtons`.
   */
  read(): void {
    const points = this.scene.input.manager.pointers
      .filter((pointer) => pointer.isDown)
      // `x`/`y` rather than `worldX`/`worldY`: these buttons don't scroll with
      // the level, they're painted on the glass.
      .map((pointer) => ({ x: pointer.x, y: pointer.y }))

    this.heldLastFrame = this.held
    this.held = pressedButtons(this.buttons, points)

    this.fingerCountLastFrame = this.fingerCount
    this.fingerCount = points.length
  }

  /** Is this button being held down right now? For moving left and right. */
  isHeld(id: TouchControlId): boolean {
    return this.held.has(id)
  }

  /** Did this button go down this frame? For jumping and restarting. */
  wasJustPressed(id: TouchControlId): boolean {
    return justPressed(this.heldLastFrame, this.held, id)
  }

  /** Did a new finger just land anywhere on the screen? For "tap to carry on". */
  wasScreenTapped(): boolean {
    return newFingerLanded(this.fingerCountLastFrame, this.fingerCount)
  }

  /** Hide the thumb buttons while the finish banner is up. */
  setThumbControlsVisible(visible: boolean): void {
    for (const control of this.thumbControls) control.setVisible(visible)
  }

  /** A see-through ring with a symbol in the middle. */
  private draw(button: TouchButton): ButtonArt[] {
    const { opacity } = TUNING.touch
    const color = TUNING.colors.touchButton
    // The inside is fainter than the outline, so a coin or a ledge sitting
    // under a button is still something you can see and aim at.
    const ring = this.scene.add.circle(button.x, button.y, button.radius, color, opacity * 0.3)
    ring.setStrokeStyle(3, color, opacity)
    ring.setScrollFactor(0).setDepth(DEPTH)

    const label = this.scene.add.text(button.x, button.y, button.label, {
      fontFamily: 'monospace',
      fontSize: `${Math.round(button.radius * 0.9)}px`,
      // The same colour as the ring around it, written the way text wants it.
      // Reading a second colour here would let an arrow drift away from its
      // own outline the first time somebody recoloured one of them.
      color: cssColor(color),
    })
    label.setOrigin(0.5).setAlpha(opacity).setScrollFactor(0).setDepth(DEPTH)

    return [ring, label]
  }
}

/** `0xe8e8f0` the way a text style wants it: `#e8e8f0`. */
function cssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

/**
 * Should this device get on-screen buttons at all?
 *
 * A coarse pointer means a finger rather than a mouse, which is the question we
 * actually care about — and it is deliberately the SAME question `index.html`
 * asks before it hides the keyboard instructions.
 *
 * "Does this device support touch at all" would be the wrong question, and it
 * was asked here first: it is true of any touchscreen laptop, so a player with
 * a mouse and a keyboard got four buttons painted over the game and a banner
 * telling them to tap, while the footer underneath still told them to press N.
 * One question, one answer, both files.
 */
export function wantsTouchControls(): boolean {
  return window.matchMedia?.('(pointer: coarse)').matches ?? false
}
