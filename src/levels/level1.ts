/**
 * ===========================================================
 *  LEVEL 1 — THE MAP
 * ===========================================================
 *
 * A level is just a list of platforms and a list of coins.
 *
 *   x = how far right (0 is the left edge, 960 is the right edge)
 *   y = how far DOWN (0 is the top, 540 is the bottom)
 *
 * x and y are the CENTER of the thing you're placing.
 *
 * To build a new level: copy this file, rename it, change the numbers.
 */

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

export const LEVEL_1: Level = {
  name: 'First Steps',

  playerStart: { x: 80, y: 400 },

  platforms: [
    // The ground.
    { x: 480, y: 520, width: 960, height: 40 },

    // Stepping stones going up and to the right.
    { x: 240, y: 420, width: 160, height: 24 },
    { x: 460, y: 340, width: 160, height: 24 },
    { x: 700, y: 270, width: 160, height: 24 },
    { x: 880, y: 400, width: 140, height: 24 },

    // A floating reward platform, only reachable with a double jump.
    { x: 500, y: 150, width: 200, height: 24 },
  ],

  coins: [
    { x: 240, y: 380 },
    { x: 460, y: 300 },
    { x: 700, y: 230 },
    { x: 880, y: 360 },
    { x: 450, y: 110 },
    { x: 500, y: 110 },
    { x: 550, y: 110 },
  ],
}
