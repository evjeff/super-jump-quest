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

  platforms: {
    /**
     * How fast the moving platforms in level 3 go — all of them at once.
     *
     * 1 is normal. 0.5 is half speed, which makes level 3 much kinder. 2 is
     * twice as fast. 0 freezes every moving platform where it starts, which
     * turns level 3 into an ordinary level.
     *
     * How far each one travels, and how long its own trip takes, is in
     * `src/levels/level3.ts` — that's the level's DESIGN. This knob is for
     * "that's too hard for me today" without opening a level file.
     */
    movingSpeed: 1,
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

  /**
   * The buttons a phone plays with. They only appear on a touchscreen — on a
   * computer the keyboard is still the whole story and none of this shows up.
   *
   * Sizes are measured from the middle of a button to its edge, on the same
   * 960 × 540 grid the levels use. Bigger = easier to hit, but more of the
   * game hidden underneath.
   */
  touch: {
    /** The ◀ and ▶ buttons, bottom left. */
    buttonRadius: 52,

    /** JUMP, bottom right. It's the one you press most, so it's the biggest. */
    jumpButtonRadius: 60,

    /** The little ↻ start-over button, up in the far corner away from thumbs. */
    restartButtonRadius: 22,

    /** How far in from the edge of the screen the buttons sit. */
    edgeMargin: 24,

    /**
     * The gap between ◀ and ▶. Bigger if a thumb keeps catching both at once.
     */
    directionGap: 12,

    /**
     * How see-through the buttons are. 0 = invisible, 1 = solid.
     * Low on purpose: you should be able to watch him run right through one.
     */
    opacity: 0.55,

    /**
     * How long the finish banner ignores taps for, in milliseconds.
     *
     * A finger that never leaves the screen is already not a tap — that's
     * `newFingerLanded` in `src/game/touchControls.ts`, and it needs no help.
     * What this pause buys is the reflex: you grab the last coin, and your
     * thumb presses ▲ again a tenth of a second later out of pure habit. That
     * IS a new finger landing, and without the pause it would wipe away a "NEW
     * BEST TIME!" nobody got to read.
     *
     * Smaller = the banner gets out of your way sooner.
     */
    bannerTapDelayMs: 400,
  },

  world: {
    width: 960,
    height: 540,

    /** Fall below this and you respawn at the start. */
    deathDepth: 700,
  },

  /** Colors are hex numbers: 0xRRGGBB. Pick new ones at https://htmlcolorcodes.com */
  colors: {
    /**
     * What's behind everything. The night sky picture covers all of it, so you
     * only ever see this in the instant before the game draws its first frame.
     */
    sky: 0x1e2749,

    platform: 0x3d5a80,

    /**
     * The platforms that MOVE. Deliberately a different color from the ones
     * that don't: you should be able to tell which ledges slide from across
     * the screen, before you trust one with a jump.
     */
    movingPlatform: 0x7b5ea7,

    coin: 0xf4a261,
    text: '#e8e8f0',

    /** The on-screen buttons on a phone. See `touch.opacity` for how faint they are. */
    touchButton: 0xe8e8f0,

    /**
     * PIP — the boy you play as.
     *
     * He's built out of little coloured squares. WHICH square is which colour
     * is the letter grid in `src/game/pipSprite.ts`; what those colours ARE is
     * right here. Change one number, save, and he changes in front of you.
     *
     * Give him a green cap. Give him purple dungarees. Nothing can break.
     */
    pip: {
      /** His cap. */
      cap: 0xe0525a,

      /** The peak of the cap, sticking out over his eyes. A bit darker looks best. */
      capBrim: 0xb03a45,

      /** His face and hands. */
      skin: 0xf6c99f,

      /** The two rosy patches on his cheeks. */
      blush: 0xf09a9a,

      /** His eyes. */
      eye: 0x26243a,

      /** The twinkle in each eye, and his teeth. Usually white. */
      highlight: 0xffffff,

      /** The inside of his big open smile. */
      mouth: 0x7a2f38,

      /** The shirt under the dungarees, and his sleeves. */
      shirt: 0xffd166,

      /** The dungarees themselves. */
      overalls: 0x3f6fb5,

      /** The legs of the dungarees. A bit darker than the top looks best. */
      trousers: 0x2d5089,

      /** His boots. */
      shoes: 0x33304a,
    },

    /**
     * THE NIGHT SKY he runs around in, listed from the top of the screen down.
     *
     * The whole picture is drawn once when the game starts and then never
     * again, so adding more to it doesn't slow the game down.
     */
    night: {
      /** Straight up overhead, the darkest part. */
      top: 0x080c26,

      /** Halfway down. */
      middle: 0x1e2749,

      /** Down at the horizon, where the sky is always lightest. */
      horizon: 0x3a4884,

      /** The stars. */
      star: 0xeef2ff,

      /** The moon. */
      moon: 0xf6edd4,

      /** The craters on the moon. */
      crater: 0xe3d6ba,

      /** The furthest hills, right on the horizon. */
      hillFar: 0x26305f,

      /** The middle row of hills. */
      hillMid: 0x1a2245,

      /** The nearest hills. Darkest, because they're closest. */
      hillNear: 0x111730,
    },
  },
} as const
