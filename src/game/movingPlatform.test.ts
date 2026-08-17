import { describe, expect, it } from 'vitest'
import { isStandingOn, pickRide, platformPosition, platformVelocity } from './movingPlatform'

/** A ferry that slides 300 to the right and back, three seconds each way. */
const FERRY = { x: 100, y: 400, moves: { moveX: 300, seconds: 3 } }

/** A lift that climbs 200 into the sky and comes back down, two seconds each way. */
const LIFT = { x: 700, y: 450, moves: { moveY: -200, seconds: 2 } }

describe('platformPosition', () => {
  it('leaves a platform with no movement exactly where it was put', () => {
    const still = { x: 480, y: 520 }
    for (const elapsed of [0, 1000, 999_999]) {
      expect(platformPosition(still, elapsed)).toEqual({ x: 480, y: 520 })
    }
  })

  it('starts at home', () => {
    expect(platformPosition(FERRY, 0)).toEqual({ x: 100, y: 400 })
  })

  it('is at the far end after one trip', () => {
    const { x, y } = platformPosition(FERRY, 3000)
    expect(x).toBeCloseTo(400)
    expect(y).toBeCloseTo(400)
  })

  it('is home again after there and back', () => {
    const { x } = platformPosition(FERRY, 6000)
    expect(x).toBeCloseTo(100)
  })

  it('is halfway across halfway through the trip', () => {
    expect(platformPosition(FERRY, 1500).x).toBeCloseTo(250)
    // ...and halfway back again at the same point on the return trip.
    expect(platformPosition(FERRY, 4500).x).toBeCloseTo(250)
  })

  it('keeps going back and forth long after the first trip', () => {
    // Ten full there-and-backs later, it is doing exactly what it did at the start.
    expect(platformPosition(FERRY, 60_000).x).toBeCloseTo(100)
    expect(platformPosition(FERRY, 61_500).x).toBeCloseTo(250)
    expect(platformPosition(FERRY, 63_000).x).toBeCloseTo(400)
  })

  it('never wanders outside the trip it was given', () => {
    for (let ms = 0; ms <= 20_000; ms += 37) {
      const { x } = platformPosition(FERRY, ms)
      expect(x).toBeGreaterThanOrEqual(100)
      expect(x).toBeLessThanOrEqual(400)
    }
  })

  it('goes the other way when the distance is negative', () => {
    expect(platformPosition(LIFT, 0)).toEqual({ x: 700, y: 450 })
    expect(platformPosition(LIFT, 2000).y).toBeCloseTo(250)
    expect(platformPosition(LIFT, 4000).y).toBeCloseTo(450)
  })

  it('moves diagonally when given both directions at once', () => {
    const diagonal = { x: 0, y: 0, moves: { moveX: 100, moveY: 50, seconds: 1 } }
    expect(platformPosition(diagonal, 500)).toEqual({ x: 50, y: 25 })
  })

  it('starts part-way along its trip when told to', () => {
    // startAt 1 is the far end, so this one begins where the plain ferry ends.
    const staggered = { ...FERRY, moves: { ...FERRY.moves, startAt: 1 } }
    expect(staggered).not.toEqual(FERRY)

    expect(platformPosition(staggered, 0).x).toBeCloseTo(400)
    expect(platformPosition(staggered, 3000).x).toBeCloseTo(100)
    // Two ferries half a trip apart are never in the same place at the same time.
    const halfway = { ...FERRY, moves: { ...FERRY.moves, startAt: 0.5 } }
    for (const ms of [0, 500, 1000, 2000, 4000]) {
      expect(platformPosition(halfway, ms).x).not.toBeCloseTo(platformPosition(FERRY, ms).x)
    }
  })

  it('treats time before the level started as the start of the level', () => {
    // The clock never runs backwards, but a platform should not teleport if it did.
    const { x } = platformPosition(FERRY, -1000)
    expect(x).toBeGreaterThanOrEqual(100)
    expect(x).toBeLessThanOrEqual(400)
  })

  it('stands still rather than dividing by nothing when the trip takes no time', () => {
    const instant = { x: 10, y: 20, moves: { moveX: 300, seconds: 0 } }
    expect(platformPosition(instant, 5000)).toEqual({ x: 10, y: 20 })

    const backwards = { x: 10, y: 20, moves: { moveX: 300, seconds: -3 } }
    expect(platformPosition(backwards, 5000)).toEqual({ x: 10, y: 20 })
  })

  it('stands still when the level clock is frozen, whatever the trip', () => {
    // This is what tuning.ts `platforms.movingSpeed: 0` does: no time passes,
    // so every platform sits at home and the level goes still.
    expect(platformPosition(FERRY, 0)).toEqual({ x: 100, y: 400 })
    expect(platformPosition(LIFT, 0)).toEqual({ x: 700, y: 450 })
  })
})

describe('platformVelocity', () => {
  it('is nothing at all for a platform that does not move', () => {
    expect(platformVelocity({ x: 480, y: 520 }, 1000)).toEqual({ x: 0, y: 0 })
  })

  it('is the distance divided by the time, going out', () => {
    expect(platformVelocity(FERRY, 0).x).toBeCloseTo(100)
    expect(platformVelocity(FERRY, 1500).x).toBeCloseTo(100)
  })

  it('turns round when the platform does', () => {
    expect(platformVelocity(FERRY, 4500).x).toBeCloseTo(-100)
    // ...and back again on the next trip out.
    expect(platformVelocity(FERRY, 7500).x).toBeCloseTo(100)
  })

  it('matches the distance the platform actually covers', () => {
    // The honest check: speed times time is the distance it really travels.
    const step = 10
    const before = platformPosition(FERRY, 1000)
    const after = platformPosition(FERRY, 1000 + step)
    expect(platformVelocity(FERRY, 1000).x * (step / 1000)).toBeCloseTo(after.x - before.x, 5)
  })

  it('goes the other way for a lift, and turns round too', () => {
    expect(platformVelocity(LIFT, 0).y).toBeCloseTo(-100)
    expect(platformVelocity(LIFT, 3000).y).toBeCloseTo(100)
  })

  it('stands still rather than dividing by nothing when the trip takes no time', () => {
    const instant = { x: 10, y: 20, moves: { moveX: 300, seconds: 0 } }
    expect(platformVelocity(instant, 5000)).toEqual({ x: 0, y: 0 })
  })
})

describe('isStandingOn', () => {
  /** A deck from x 100 to 300, with its surface at y 400. */
  const DECK = { left: 100, right: 300, top: 400, bottom: 424 }
  /** Someone stood in the middle of it. */
  const STANDING = { left: 184, right: 216, top: 352, bottom: 400 }

  it('says yes to someone stood on it', () => {
    expect(isStandingOn(STANDING, DECK)).toBe(true)
  })

  it('says yes when he is a pixel or two into it, or a pixel or two above', () => {
    expect(isStandingOn({ ...STANDING, bottom: 402 }, DECK)).toBe(true)
    expect(isStandingOn({ ...STANDING, bottom: 398 }, DECK)).toBe(true)
  })

  it('says no to someone jumping well above it', () => {
    expect(isStandingOn({ ...STANDING, bottom: 340 }, DECK)).toBe(false)
  })

  it('says no to someone below it', () => {
    expect(isStandingOn({ ...STANDING, bottom: 500 }, DECK)).toBe(false)
  })

  it('says no to someone at the right height but off to one side', () => {
    expect(isStandingOn({ ...STANDING, left: 20, right: 52 }, DECK)).toBe(false)
    expect(isStandingOn({ ...STANDING, left: 400, right: 432 }, DECK)).toBe(false)
  })

  it('says yes to someone with only his toes on the end', () => {
    expect(isStandingOn({ ...STANDING, left: 298, right: 330 }, DECK)).toBe(true)
    // ...and no once he is past the end entirely.
    expect(isStandingOn({ ...STANDING, left: 300, right: 332 }, DECK)).toBe(false)
  })
})

describe('pickRide', () => {
  /** A deck from x 100 to 300, with its surface at y 400. */
  const DECK = { left: 100, right: 300, top: 400, bottom: 424 }
  /** The one next door, carrying straight on from x 300 to 500. */
  const NEXT_DOOR = { left: 300, right: 500, top: 400, bottom: 424 }
  /** Someone stood in the middle of the first one. */
  const STANDING = { left: 184, right: 216, top: 352, bottom: 400 }

  it('is nobody when there is nothing to ride', () => {
    expect(pickRide(STANDING, [])).toBe(null)
  })

  it('is nobody when he is nowhere near any of them', () => {
    expect(pickRide({ ...STANDING, bottom: 200 }, [DECK, NEXT_DOOR])).toBe(null)
  })

  it('is the one he is standing on', () => {
    expect(pickRide(STANDING, [DECK, NEXT_DOOR])).toBe(0)
    expect(pickRide({ ...STANDING, left: 384, right: 416 }, [DECK, NEXT_DOOR])).toBe(1)
  })

  it('is the one he has most of his feet on, not the first one listed', () => {
    // Squarely on the second, with a toe back over the end of the first.
    const mostlyOnTheSecond = { ...STANDING, left: 298, right: 330 }
    expect(pickRide(mostlyOnTheSecond, [DECK, NEXT_DOOR])).toBe(1)
    // ...and the answer does not depend on the order they were written in.
    expect(pickRide(mostlyOnTheSecond, [NEXT_DOOR, DECK])).toBe(0)
  })

  it('still rides one he is only just on, when it is the only thing under him', () => {
    const toesOnly = { ...STANDING, left: 298, right: 330 }
    expect(pickRide(toesOnly, [DECK])).toBe(0)
  })
})
