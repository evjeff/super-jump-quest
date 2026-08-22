/**
 * ===========================================================
 *  THE LIST OF LEVELS
 * ===========================================================
 *
 * What a level is made of (the shapes below), the order you play them in, and
 * where a level comes from once you've played all the ones we drew.
 *
 * There are two kinds, and they are the same kind really:
 *
 *   LEVELS 1, 2 AND 3 are ours. Somebody sat down and put every ledge where it
 *   is. They live in `level1.ts`, `level2.ts` and `level3.ts` and nothing here
 *   touches them.
 *
 *   LEVEL 4 ONWARDS the game makes up for itself, in `src/game/levelGen.ts`,
 *   and it never runs out. A made-up level is exactly the same list of
 *   platforms and coins as a hand-drawn one — you could paste one into a file
 *   and keep it if it turned out to be good.
 *
 * `levelFor(index)` is the one door onto both. Ask it for a level, get a level.
 *
 * To add a level of our own: copy `level2.ts`, rename it, change the numbers,
 * then add it to the end of `LEVELS`. It slots in ahead of the made-up ones.
 */

import { type GenerateOptions, generateLevel } from '../game/levelGen'
import type { PlatformMotion } from '../game/movingPlatform'
import { PIP_ON_SCREEN } from '../game/pipSprite'
import { touchButtonLayout } from '../game/touchControls'
import { TUNING } from '../tuning'
import { LEVEL_1 } from './level1'
import { LEVEL_2 } from './level2'
import { LEVEL_3 } from './level3'

export interface Platform {
  x: number
  y: number
  width: number
  height: number

  /**
   * Leave this out and the platform stands still, like every platform in
   * levels 1 and 2.
   *
   * Put it in and the platform slides there and back, forever. `x` and `y`
   * above are where it STARTS — one end of its trip — and `moves` says how far
   * it goes and how long the trip takes:
   *
   *   moves: { moveX: 300, seconds: 3 }    slides 300 right, 3 seconds each way
   *   moves: { moveY: -200, seconds: 2 }   a lift: 200 UP and back down
   *
   * Stand on one and it carries you. See `src/game/movingPlatform.ts`.
   */
  moves?: PlatformMotion
}

export interface Coin {
  x: number
  y: number
}

export interface Level {
  name: string
  playerStart: { x: number; y: number }
  platforms: Platform[]
  coins: Coin[]

  /**
   * Which page of the record book this level's best time is written on.
   *
   * Our own levels leave this out and are filed under their `name`, exactly as
   * they always have been — which is why a best time set on The Sky Ferry last
   * Saturday is still sitting there today.
   *
   * A made-up level fills it in with a short code worked out from its own
   * ledges and coins (`recordKeyFor` below). Two levels are never handed each
   * other's record, and if a level ever changes shape its old time doesn't
   * follow it onto what is really a different level.
   */
  recordKey?: string
}

/**
 * The levels we drew ourselves. The first one is where a new game starts.
 *
 * `levelFor` below is what the game actually asks; this is just the front of
 * the queue.
 */
export const LEVELS = [LEVEL_1, LEVEL_2, LEVEL_3] as const

/** Which world of made-up levels to build — `TUNING.levels`. */
export interface LevelWorld {
  /** Keep going past the hand-made levels, or stop there? */
  endless: boolean

  /** Which world. Change it and every made-up level becomes a different one. */
  worldSeed: number

  /** How fast the made-up levels get mean. Bigger = a gentler climb. */
  ramp: number
}

/**
 * The level at `index`, counting from 0 — so `levelFor(0)` is the one a person
 * calls level 1.
 *
 * The first three come straight out of `LEVELS`, the same objects every time,
 * untouched. Everything after that is made up on the spot, and made up the
 * SAME every time: level 12 is the same level 12 on every machine, today and
 * next Saturday, so "try level 12, it's the one with the massive hole" means
 * something and a best time on it is worth chasing.
 *
 * Turn `endless` off in `tuning.ts` and there is nothing past level 3 at all;
 * asking for it hands back level 1, which is what the game did before it could
 * make levels up.
 */
export function levelFor(index: number, world: LevelWorld = TUNING.levels): Level {
  const handMade = LEVELS[index]
  if (handMade) return handMade

  if (!world.endless || !Number.isInteger(index) || index < LEVELS.length) return LEVELS[0]

  // Index 3 is the level a person calls 4, and the level-maker counts the way
  // a person does.
  const levelNumber = index + 1
  const level = generateLevel(levelNumber, generatorOptions(world))
  return { ...level, recordKey: recordKeyFor(level, levelNumber) }
}

/**
 * Everything the level-maker needs to know about the game it's building for,
 * read out of the control panel.
 */
function generatorOptions(world: LevelWorld): GenerateOptions {
  return {
    physics: TUNING.player,
    maxJumps: TUNING.player.maxJumps,
    world: TUNING.world,
    movingSpeed: TUNING.platforms.movingSpeed,
    deathDepth: TUNING.world.deathDepth,
    playerWidth: PIP_ON_SCREEN.width,
    playerHeight: PIP_ON_SCREEN.height,
    // Asked rather than typed out again, so that moving a phone button moves
    // the "don't put a coin under the jump button" rule with it.
    touchButtons: touchButtonLayout({
      width: TUNING.world.width,
      height: TUNING.world.height,
      radius: TUNING.touch.buttonRadius,
      jumpRadius: TUNING.touch.jumpButtonRadius,
      restartRadius: TUNING.touch.restartButtonRadius,
      margin: TUNING.touch.edgeMargin,
      directionGap: TUNING.touch.directionGap,
    }),
    worldSeed: world.worldSeed,
    ramp: world.ramp,
  }
}

/**
 * The page in the record book for a made-up level: its number, and a short
 * code squeezed out of the level itself — every ledge, every coin, every
 * sliding deck.
 *
 * Keying on the SHAPE rather than just the number is what keeps the record
 * book honest. Change `worldSeed` and level 7 becomes a different level, so it
 * gets a different page and starts its records fresh — and the old world's
 * times are still there, untouched, if you ever change the seed back. Change
 * nothing and every code comes out identical, which is the case that matters
 * on an ordinary Saturday: every best time survives.
 *
 * The fair warning: if we ever teach the level-maker something new and level 7
 * comes out reshaped, its best time goes blank. That's the truth — it's a new
 * level — but somebody will notice, so it's worth changing the level-maker in
 * one go rather than a bit at a time.
 *
 * The code is not a secret and does not have to be perfect; two levels sharing
 * one would cost a child one wrong best time, and the odds are about one in
 * four billion.
 */
export function recordKeyFor(level: Level, levelNumber: number): string {
  return `level-${levelNumber}-${squeeze(shapeOf(level))}`
}

/** Everything about a level that changes how it plays, written out as text. */
function shapeOf(level: Level): string {
  const platforms = level.platforms.map((platform) => {
    const { moveX = 0, moveY = 0, seconds = 0, startAt = 0 } = platform.moves ?? {}
    const trip = platform.moves ? `~${moveX},${moveY},${seconds},${startAt}` : ''
    return `${platform.x},${platform.y},${platform.width},${platform.height}${trip}`
  })
  const coins = level.coins.map((coin) => `${coin.x},${coin.y}`)

  return [`${level.playerStart.x},${level.playerStart.y}`, ...platforms, ...coins].join('|')
}

/**
 * Squeeze a long piece of text down to a handful of letters and numbers.
 *
 * Every letter is stirred in, so changing one coin by one pixel changes the
 * answer completely. It's the well-known FNV-1a recipe; the two magic numbers
 * are simply the ones it says to use.
 */
function squeeze(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193)
  }
  // >>> 0 turns it back into a plain positive number; base 36 spends it as
  // digits and letters, which is a lot shorter than digits alone.
  return (hash >>> 0).toString(36)
}
