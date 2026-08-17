/**
 * Platforms that move — pure logic, no Phaser, no browser.
 *
 * A moving platform goes there and comes back, forever: out to the far end,
 * back home, out again. This file answers one question — "the level has been
 * running for THIS long, so where is this platform right now?"
 *
 * The important part is that the answer depends on the CLOCK, not on how many
 * pictures the computer has drawn. A slow phone draws fewer pictures than a
 * fast laptop, and if the platform crept along a bit with every picture, level
 * 3 would be a slower, easier level on the phone. The game writes down your
 * best time, so that would make the record you're chasing meaningless. Asking
 * the clock instead means the platform is in exactly the same place at the same
 * second on every machine — and in exactly the same place if you play it again.
 *
 * See `docs/adr/20260817-moving-platforms-level-3/`.
 */

/**
 * What makes a platform move. Add this to a platform in a level file and it
 * slides; leave it out and it stands still like every platform always has.
 */
export interface PlatformMotion {
  /** How far right it slides before turning round. Negative goes left first. */
  moveX?: number

  /** How far DOWN it goes before turning round. Negative goes UP first. */
  moveY?: number

  /** How long one trip takes, in seconds. Bigger = slower and gentler. */
  seconds: number

  /**
   * Where in its trip it starts, so two platforms aren't marching in step.
   * 0 starts it at home, 1 starts it at the far end, 0.5 starts it halfway.
   */
  startAt?: number
}

/** Anything that sits somewhere and might move: a platform, basically. */
export interface Movable {
  x: number
  y: number
  moves?: PlatformMotion
}

/** Where on the screen something is. */
export interface Point {
  x: number
  y: number
}

/**
 * Where this platform is, `elapsedMs` milliseconds into the level.
 *
 * The trip is a there-and-back at a steady speed: at 0 it's at home, after
 * `seconds` it's at the far end, and after twice `seconds` it's home again,
 * over and over. It never goes further than the distance it was given, so a
 * platform can't wander off somewhere the level designer didn't look.
 *
 * A platform with nothing to say about moving — or a trip that takes no time,
 * which would be a divide by zero — just stays where it was put.
 */
export function platformPosition(platform: Movable, elapsedMs: number): Point {
  const home = { x: platform.x, y: platform.y }
  const moves = platform.moves
  if (!moves || !(moves.seconds > 0)) return home

  const { moveX = 0, moveY = 0, seconds, startAt = 0 } = moves

  // Two trips make a full there-and-back, so the phase runs 0 → 2 and wraps.
  // The `+ 2` keeps it positive if the clock is ever handed a negative number.
  const phase = (((elapsedMs / 1000 / seconds + startAt) % 2) + 2) % 2

  // Out on the first half of the phase, back on the second.
  const travelled = phase <= 1 ? phase : 2 - phase

  return { x: home.x + moveX * travelled, y: home.y + moveY * travelled }
}
