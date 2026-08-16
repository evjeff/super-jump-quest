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

import { LEVEL_1 } from './level1'
import { LEVEL_2 } from './level2'

export interface Platform {
  x: number
  y: number
  width: number
  height: number
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
export const LEVELS = [LEVEL_1, LEVEL_2] as const
