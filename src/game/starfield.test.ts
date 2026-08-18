import { describe, expect, it } from 'vitest'
import { makeStarfield, type StarfieldOptions } from './starfield'

const OPTIONS: StarfieldOptions = {
  width: 960,
  height: 540,
  count: 110,
  twinkleEvery: 5,
  twinkleMs: 1200,
}

describe('makeStarfield', () => {
  it('makes as many stars as it was asked for', () => {
    expect(makeStarfield(OPTIONS)).toHaveLength(110)
    expect(makeStarfield({ ...OPTIONS, count: 0 })).toHaveLength(0)
  })

  it('keeps every star on screen, and up in the sky rather than in the hills', () => {
    for (const star of makeStarfield(OPTIONS)) {
      expect(star.x).toBeGreaterThanOrEqual(0)
      expect(star.x).toBeLessThanOrEqual(960)
      expect(star.y).toBeGreaterThanOrEqual(0)
      expect(star.y).toBeLessThan(540 * 0.75)
    }
  })

  it('gives the same sky every single time', () => {
    expect(makeStarfield(OPTIONS)).toEqual(makeStarfield(OPTIONS))
  })

  it('twinkles one star in every five', () => {
    const twinkling = makeStarfield(OPTIONS).filter((star) => star.twinkles)
    expect(twinkling).toHaveLength(22)
  })

  it('can twinkle all of them, or none at all', () => {
    const all = makeStarfield({ ...OPTIONS, twinkleEvery: 1 })
    expect(all.every((star) => star.twinkles)).toBe(true)

    const none = makeStarfield({ ...OPTIONS, twinkleEvery: 0 })
    expect(none.some((star) => star.twinkles)).toBe(false)
  })

  it('leaves the stars where they were when twinkling is turned off', () => {
    const twinkling = makeStarfield(OPTIONS)
    const still = makeStarfield({ ...OPTIONS, twinkleEvery: 0 })

    for (const [index, star] of twinkling.entries()) {
      expect({ x: star.x, y: star.y }).toEqual({ x: still[index]?.x, y: still[index]?.y })
    }
  })

  it('never asks for a fade that takes no time, which would be a stuck star', () => {
    for (const star of makeStarfield(OPTIONS)) {
      expect(star.durationMs).toBeGreaterThan(0)
      expect(star.delayMs).toBeGreaterThanOrEqual(0)
    }
  })
})
