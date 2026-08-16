/**
 * Landing squash — pure logic, no Phaser, no browser.
 *
 * When something with weight hits the ground it goes briefly wide and short,
 * then springs back. Cartoons have done it forever, and it's the difference
 * between a character landing and a box stopping.
 *
 * This file answers one question: "he landed THIS many milliseconds ago — how
 * wide and how tall should he be right now?" It counts real time rather than
 * counting frames, so the squash lasts exactly as long on a slow laptop as on
 * a fast one.
 */

/** How much wider and taller than normal to draw him. 1 means "normal size". */
export interface SquashScale {
  scaleX: number
  scaleY: number
}

/** Normal size. Handed back whenever there is nothing to squash. */
const NO_SQUASH: SquashScale = { scaleX: 1, scaleY: 1 }

/**
 * However silly a number someone types into tuning.ts, never flatten him past
 * this. At 1 he would have no height left at all and would vanish.
 */
const FLATTEST = 0.9

/**
 * How squashed he is right now.
 *
 * - `elapsedMs` — milliseconds since he touched down. 0 is the moment of impact,
 *   which is the flattest he gets. Anything before that counts as the impact.
 * - `amount` — how much of his height the squash takes away at its flattest.
 *   0.25 means "three-quarters as tall". 0 means no squash at all.
 * - `durationMs` — how long the whole squash-and-spring-back takes.
 *
 * He gets exactly as much wider as he got shorter, so he always looks like the
 * same amount of player rather than melting away. Once the squash is over this
 * returns exactly normal size, so he can never get stuck the wrong shape.
 */
export function squashScale(elapsedMs: number, amount: number, durationMs: number): SquashScale {
  if (!(amount > 0) || !(durationMs > 0)) return NO_SQUASH
  if (elapsedMs >= durationMs) return NO_SQUASH

  const depth = Math.min(amount, FLATTEST)
  const progress = Math.max(elapsedMs, 0) / durationMs

  // A smooth spring back: full squash at the start, easing off to nothing by
  // the end, with no sudden jolt at either end.
  const squash = depth * ((1 + Math.cos(Math.PI * progress)) / 2)

  const scaleY = 1 - squash
  return { scaleX: 1 / scaleY, scaleY }
}
