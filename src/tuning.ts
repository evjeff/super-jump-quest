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

    /** How many jumps before touching the ground again. 3 = triple jump. Try 5. */
    maxJumps: 3,

    /** A little bounce when he lands. 0 = no bounce, 1 = rubber ball. */
    bounce: 0.1,

    /**
     * How much he squashes when he hits the ground. 0.25 means he flattens to
     * three-quarters of his height for a moment — and goes just as much wider,
     * so he still looks like the same amount of player.
     *
     * 0 turns the squash OFF. Try 0.6 for a pancake.
     */
    landingSquash: 0.25,

    /**
     * How long the squash lasts before he's back to normal, in milliseconds.
     * Small = a quick sharp thump. Try 400 for wobbly jelly legs.
     */
    landingSquashMs: 160,
  },

  coins: {
    /** Points per coin. */
    value: 10,

    /** How fast coins spin, in degrees per second. */
    spinSpeed: 90,
  },

  sound: {
    /** How loud the beeps are. 0 turns all sound OFF. 1 is as loud as it gets. */
    volume: 0.35,

    /**
     * He bounces a tiny bit when he lands, and each bounce counts as landing
     * again. Ignore extra thuds within this many milliseconds so one landing
     * makes one noise. Bigger = fewer thuds.
     *
     * A bounce comes back down within ~180ms; two REAL landings are always at
     * least ~800ms apart, so there's plenty of room between the two.
     */
    landingCooldownMs: 250,
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
