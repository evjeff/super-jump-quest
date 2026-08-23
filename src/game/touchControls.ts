/**
 * Where the on-screen buttons go, and which ones a finger is on — pure logic,
 * no Phaser, no browser.
 *
 * A phone has no keyboard, so the game draws its own buttons: ◀ ▶ down in the
 * bottom-left where a left thumb rests, JUMP in the bottom-right for the right
 * thumb, and a row of three little ones along the top-right edge, deliberately
 * as far from both thumbs as the screen allows — ↻ start the whole game over,
 * ↺ play this level again, ⏭ skip it.
 *
 * Everything here works in the game's own 960 × 540 coordinates, the same grid
 * the levels are drawn on. Phaser hands us finger positions already converted
 * into that grid, so this file never has to know how big the phone is.
 */

/** The six things a finger can be on. */
export type TouchControlId = 'left' | 'right' | 'jump' | 'restart' | 'playAgain' | 'skip'

/** One round button: where its middle is, and how far the edge is from there. */
export interface TouchButton {
  id: TouchControlId
  x: number
  y: number
  radius: number
  /** The symbol drawn in the middle of it. */
  label: string
}

/** A point on the screen — one finger, or the mouse. */
export interface TouchPoint {
  x: number
  y: number
}

export interface TouchLayoutOptions {
  /** The size of the play area, in game coordinates. */
  width: number
  height: number
  /** How far the ◀ ▶ buttons reach from their middle to their edge. */
  radius: number
  /** JUMP is the button you press most, so it gets to be bigger. */
  jumpRadius: number
  /** The little ones along the top: ↻ ↺ ⏭. They're all this size. */
  restartRadius: number
  /** How far the buttons sit in from the edge of the screen. */
  margin: number
  /**
   * Breathing room between two buttons side by side, so a thumb can't press
   * both at once. It sets the gap between ◀ and ▶, and the gaps along the top.
   */
  directionGap: number
  /**
   * Is the skip button being drawn at all? It's `TUNING.debug.skipLevel`.
   *
   * Leave it out and the skip button is there. That's on purpose: the
   * level-maker asks this same question when it works out where NOT to put a
   * coin, and if switching the button off took its spot away, every made-up
   * level would quietly come out a different shape — and every best time with
   * it. Only the phone buttons themselves ever pass `false`.
   */
  showSkip?: boolean
}

/**
 * Work out where every button goes for a screen this size.
 *
 * Both movement buttons go bottom-LEFT and jump goes bottom-RIGHT, which is how
 * a phone is held: the left thumb steers, the right thumb jumps, and neither
 * hand has to do two jobs. The other three go along the top-RIGHT edge, the one
 * strip no thumb reaches by accident — the score is drawn in the top-left, so
 * that end was taken anyway. They are small so that brushing the top of the
 * screen misses them: none of them is a button you want pressed by mistake.
 *
 * ↻ stays exactly where it has always been, right in the corner, and still
 * means the same thing. The two new ones queue up beside it, in the order you
 * reach for them: ↺ play this level again first, ⏭ skip it furthest out.
 */
export function touchButtonLayout(options: TouchLayoutOptions): TouchButton[] {
  const { width, height, radius, jumpRadius, restartRadius, margin, directionGap } = options

  const thumbRow = height - margin - radius
  const leftX = margin + radius

  // The top row is built from the corner inwards, so ↻ never moves.
  const topRow = margin + restartRadius
  const cornerX = width - margin - restartRadius
  const nextAlong = restartRadius * 2 + directionGap

  const buttons: TouchButton[] = [
    { id: 'left', x: leftX, y: thumbRow, radius, label: '◀' },
    { id: 'right', x: leftX + radius * 2 + directionGap, y: thumbRow, radius, label: '▶' },
    {
      id: 'jump',
      x: width - margin - jumpRadius,
      y: height - margin - jumpRadius,
      radius: jumpRadius,
      label: '▲',
    },
    { id: 'restart', x: cornerX, y: topRow, radius: restartRadius, label: '↻' },
    { id: 'playAgain', x: cornerX - nextAlong, y: topRow, radius: restartRadius, label: '↺' },
  ]

  if (options.showSkip ?? true) {
    buttons.push({
      id: 'skip',
      x: cornerX - nextAlong * 2,
      y: topRow,
      radius: restartRadius,
      label: '⏭',
    })
  }

  return buttons
}

/** Is this point inside this button? Touching the very edge counts. */
export function isOnButton(button: TouchButton, point: TouchPoint): boolean {
  const dx = point.x - button.x
  const dy = point.y - button.y
  return dx * dx + dy * dy <= button.radius * button.radius
}

/**
 * Which buttons are being held down right now.
 *
 * This is worked out fresh from where the fingers ARE, every single frame,
 * rather than by remembering "finger went down on JUMP" and waiting for a
 * matching "finger came up". That matters: a finger that slides off the button,
 * or leaves the screen at the edge, or gets swallowed by a phone notification,
 * never sends the "came up" half — and the player would be left running right
 * forever with nothing on screen to explain why. Asking every frame means a
 * button can only ever be held while a finger is genuinely on it.
 *
 * Several points at once is the normal case, not an edge case: running and
 * jumping at the same time is two thumbs on two buttons.
 */
export function pressedButtons(
  buttons: readonly TouchButton[],
  points: readonly TouchPoint[],
): Set<TouchControlId> {
  const pressed = new Set<TouchControlId>()
  for (const point of points) {
    for (const button of buttons) {
      if (isOnButton(button, point)) pressed.add(button.id)
    }
  }
  return pressed
}

/**
 * Did this button go down *this frame*?
 *
 * Jumping and the three little top buttons happen once per press: holding JUMP
 * down must not spend all three jumps in three frames, and leaning on ⏭ must
 * not skip level after level after level. Moving left and right is the opposite
 * — that's a hold, and it uses `pressedButtons` directly.
 */
export function justPressed(
  previous: ReadonlySet<TouchControlId>,
  current: ReadonlySet<TouchControlId>,
  id: TouchControlId,
): boolean {
  return current.has(id) && !previous.has(id)
}

/**
 * Did a NEW finger land on the screen, anywhere?
 *
 * This is how "tap to carry on" works on the finish banner, where there is no N
 * key to press and no button to aim at.
 *
 * It compares how MANY fingers are on the glass, rather than asking "is the
 * screen being touched" — those are different questions the moment a second
 * hand joins in, and the difference is the whole point:
 *
 * - A finger that never left the screen is not a tap. Winning usually happens
 *   mid-jump, so a thumb is still on ▲ when the banner appears; the count
 *   doesn't change, so nothing is skipped.
 * - A tap still counts while another thumb rests. That same left thumb is
 *   usually parked where ◀ was. "Is the screen being touched" never goes back
 *   to no, so it would swallow every tap of the other hand and leave the banner
 *   looking broken with no way on.
 */
export function newFingerLanded(previousCount: number, currentCount: number): boolean {
  return currentCount > previousCount
}
