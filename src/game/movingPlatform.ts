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

/** The four edges of something square, the way the physics engine sees it. */
export interface Bounds {
  left: number
  right: number
  top: number
  bottom: number
}

/**
 * How close his feet have to be to the deck to count as standing on it.
 *
 * A few pixels of slack, because he is never resting on it exactly: gravity
 * pulls him a fraction into it every frame and the collision pushes him back
 * out, so his feet hover either side of the surface all the time.
 */
const FOOT_SLACK = 4

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

/**
 * How fast this platform is going right now, in pixels per second.
 *
 * Steady speed, turning round at each end: the distance divided by the time,
 * pointing one way on the trip out and the other way on the trip back.
 *
 * This is what a passenger takes with him when he jumps. Once he is in the air
 * he keeps the speed he left with, so a ferry turning round underneath him
 * doesn't turn HIM round in mid-air.
 */
export function platformVelocity(platform: Movable, elapsedMs: number): Point {
  const moves = platform.moves
  if (!moves || !(moves.seconds > 0)) return { x: 0, y: 0 }

  const { moveX = 0, moveY = 0, seconds, startAt = 0 } = moves

  const phase = (((elapsedMs / 1000 / seconds + startAt) % 2) + 2) % 2
  const heading = phase < 1 ? 1 : -1

  return { x: (moveX / seconds) * heading, y: (moveY / seconds) * heading }
}

/**
 * Is he standing on this platform?
 *
 * Two questions at once: are his feet at the height of the deck, and is any
 * part of him over it. Toes on the very end still counts — if he can stand
 * there, he can ride there.
 */
export function isStandingOn(player: Bounds, platform: Bounds): boolean {
  const feetAtDeckHeight =
    player.bottom >= platform.top - FOOT_SLACK && player.bottom <= platform.top + FOOT_SLACK
  const somePartOverIt = player.right > platform.left && player.left < platform.right

  return feetAtDeckHeight && somePartOverIt
}
