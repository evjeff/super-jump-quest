/**
 * ===========================================================
 *  THE CONTROL PANEL
 * ===========================================================
 *
 * Every number that changes how the game FEELS lives in this file.
 *
 * This is the file to open when someone says "make him jump higher" or
 * "he's too slow" or "make the sky purple". Change a number, save the file,
 * and the browser updates instantly. You do not need to understand any of
 * the rest of the code to play with these.
 *
 * Nothing here can break the game. Try wild numbers. That's the point.
 */

export const TUNING = {
  player: {
    /** Sideways running speed. Bigger = faster. Try 400 for zoomy. */
    speed: 220,

    /** How hard he launches upward. Bigger = higher jump. Try 900 for moon-jump. */
    jumpVelocity: 520,

    /** How hard the world pulls him down. Smaller = floaty. Try 300 for outer space. */
    gravity: 1200,

    /** How many jumps before touching the ground again. 2 = double jump. Try 5. */
    maxJumps: 2,

    /** A little bounce when he lands. 0 = no bounce, 1 = rubber ball. */
    bounce: 0.1,
  },

  coins: {
    /** Points per coin. */
    value: 10,

    /** How fast coins spin, in degrees per second. */
    spinSpeed: 90,
  },

  world: {
    width: 960,
    height: 540,

    /** Fall below this and you respawn at the start. */
    deathDepth: 700,
  },

  /** Colors are hex numbers: 0xRRGGBB. Pick new ones at https://htmlcolorcodes.com */
  colors: {
    sky: 0x1e2749,
    player: 0xffd166,
    platform: 0x3d5a80,
    coin: 0xf4a261,
    text: '#e8e8f0',
  },
} as const
