import { describe, expect, it } from 'vitest'
import { squashScale } from './squash'

const AMOUNT = 0.25
const DURATION = 160

describe('squashScale', () => {
  it('is at its flattest the instant he lands', () => {
    const { scaleX, scaleY } = squashScale(0, AMOUNT, DURATION)
    expect(scaleY).toBeCloseTo(0.75)
    expect(scaleX).toBeGreaterThan(1)
  })

  it('keeps him the same amount of player: wider means shorter', () => {
    for (const elapsed of [0, 40, 80, 120]) {
      const { scaleX, scaleY } = squashScale(elapsed, AMOUNT, DURATION)
      expect(scaleX * scaleY).toBeCloseTo(1)
    }
  })

  it('springs back a bit more with every passing millisecond', () => {
    const early = squashScale(20, AMOUNT, DURATION).scaleY
    const middle = squashScale(80, AMOUNT, DURATION).scaleY
    const late = squashScale(140, AMOUNT, DURATION).scaleY

    expect(early).toBeLessThan(middle)
    expect(middle).toBeLessThan(late)
    expect(late).toBeLessThan(1)
  })

  it('is back to exactly normal size the moment the squash ends', () => {
    expect(squashScale(DURATION, AMOUNT, DURATION)).toEqual({ scaleX: 1, scaleY: 1 })
  })

  it('is still exactly normal size long after the squash ended', () => {
    expect(squashScale(5000, AMOUNT, DURATION)).toEqual({ scaleX: 1, scaleY: 1 })
    expect(squashScale(Number.POSITIVE_INFINITY, AMOUNT, DURATION)).toEqual({
      scaleX: 1,
      scaleY: 1,
    })
  })

  it('treats time before the landing as the moment of landing', () => {
    expect(squashScale(-50, AMOUNT, DURATION)).toEqual(squashScale(0, AMOUNT, DURATION))
  })

  it('does nothing at all when the squash is turned off', () => {
    for (const elapsed of [-10, 0, 80, 160, 5000]) {
      expect(squashScale(elapsed, 0, DURATION)).toEqual({ scaleX: 1, scaleY: 1 })
    }
  })

  it('does nothing at all when the squash lasts no time', () => {
    expect(squashScale(0, AMOUNT, 0)).toEqual({ scaleX: 1, scaleY: 1 })
  })

  it('never squashes him away to nothing, however silly the numbers are', () => {
    const flattest = squashScale(0, 99, DURATION)
    expect(flattest.scaleY).toBeGreaterThan(0)
    expect(Number.isFinite(flattest.scaleX)).toBe(true)

    // A negative squash is just "no squash", not a stretch.
    expect(squashScale(0, -1, DURATION)).toEqual({ scaleX: 1, scaleY: 1 })
  })
})
