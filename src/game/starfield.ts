/**
 * Where the stars go, and which of them twinkle.
 *
 * The same numbers come out every time, so the sky looks identical on every
 * run. That's on purpose — a sky that rearranged itself each time you pressed R
 * would be distracting rather than atmospheric.
 *
 * Most stars sit still and get painted straight into the sky picture, which
 * costs nothing while you're playing. Only the ones marked `twinkles` become
 * real objects that fade in and out.
 */

/** How far down the screen stars reach. Below this is where the hills are. */
const SKY_DEPTH = 0.72

/** How likely a star is to be the smaller of the two sizes. */
const SMALL_STAR_CHANCE = 0.75

export interface StarfieldOptions {
  /** How wide the sky is. */
  width: number

  /** How tall the sky is. */
  height: number

  /** How many stars altogether. */
  count: number

  /** One star in every this many twinkles. 0 means none of them do. */
  twinkleEvery: number

  /** Roughly how long one fade takes, in milliseconds. */
  twinkleMs: number
}

export interface Star {
  x: number
  y: number

  /** How many pixels across — either 1 or 2. */
  size: number

  /** Does this one fade in and out, or just sit there? */
  twinkles: boolean

  /** How long before it starts fading, so they don't all pulse in time. */
  delayMs: number

  /** How long one fade takes. */
  durationMs: number
}

export function makeStarfield(options: StarfieldOptions): Star[] {
  const { width, height, count, twinkleEvery, twinkleMs } = options
  const nextNumber = seededNumbers(7)
  const stars: Star[] = []

  for (let index = 0; index < count; index++) {
    // Every star draws the same five numbers whether it twinkles or not, so
    // that changing how many twinkle doesn't shuffle where the stars are.
    const x = nextNumber() * width
    const y = nextNumber() * height * SKY_DEPTH
    const size = nextNumber() < SMALL_STAR_CHANCE ? 1 : 2
    const delayMs = nextNumber() * twinkleMs * 2
    const durationMs = twinkleMs * (0.6 + nextNumber() * 0.8)

    stars.push({
      x: Math.round(x),
      y: Math.round(y),
      size,
      twinkles: twinkleEvery > 0 && index % twinkleEvery === 0,
      delayMs: Math.round(delayMs),
      durationMs: Math.round(durationMs),
    })
  }

  return stars
}

/** Numbers between 0 and 1 that look scattered but are the same every time. */
function seededNumbers(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}
