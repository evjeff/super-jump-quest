/**
 * ===========================================================
 *  THE LIST OF LEVELS
 * ===========================================================
 *
 * What a level is made of (the shapes below), and the order you play them in.
 *
 * To add a level: copy `level2.ts`, rename it, change the numbers, then add it
 * to the end of `LEVELS`. That's the whole job — the game plays them in this
 * order and shows "YOU WIN!" after the last one.
 */

import type { PlatformMotion } from '../game/movingPlatform'
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
}

/** The order you play them in. The first one is where a new game starts. */
export const LEVELS = [LEVEL_1, LEVEL_2, LEVEL_3] as const
