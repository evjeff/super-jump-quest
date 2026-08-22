import { describe, expect, it } from 'vitest'
import type { Level } from '../levels'
import { LEVEL_1 } from '../levels/level1'
import { LEVEL_2 } from '../levels/level2'
import { LEVEL_3 } from '../levels/level3'
import { TUNING } from '../tuning'
import { type MeasureOptions, measureLevel } from './levelMeasure'
import { runFor } from './reach'

/**
 * The three hand-made levels are the ruler everything else is measured
 * against, so most of this file is "run the tape measure over level 1, 2 and 3
 * and write down what came back". Those numbers are copied into
 * `docs/adr/20260822-random-endless-levels/plan.md` §4.2, and if the two ever
 * disagree, the plan is describing levels nobody has played.
 *
 * A child has finished all three levels, so any coin coming back as
 * unreachable is this file's fault, never the level's.
 */
const OPTIONS: MeasureOptions = {
  physics: TUNING.player,
  maxJumps: TUNING.player.maxJumps,
  world: TUNING.world,
  movingSpeed: TUNING.platforms.movingSpeed,
}

/** Costs are shares of a triple jump, and two decimal places is plenty. */
const share = (value: number) => Math.round(value * 100) / 100

describe('level 1 — First Steps', () => {
  const measured = measureLevel(LEVEL_1, OPTIONS)

  it('has ground the whole way across, so there is nowhere to fall', () => {
    expect(measured.floorSolid).toBe(1)
    expect(measured.gaps).toEqual([])
    expect(measured.oneWayCrossings).toBe(0)
    expect(measured.fallCost).toBe(0)
  })

  it('is five ledges, nothing moving, and seven coins', () => {
    expect(measured.ledges).toBe(5)
    expect(measured.narrowestLedge).toBe(140)
    expect(measured.movers).toBe(0)
    expect(measured.ferries).toEqual([])
    expect(measured.coinCount).toBe(7)
  })

  it('lets him reach every coin', () => {
    expect(measured.everyCoinReachable).toBe(true)
  })

  it('asks for a third of a triple jump at its hardest', () => {
    expect(share(measured.hardestHop)).toBe(0.36)
    expect(measured.routeDepth).toBe(5)
    expect(measured.forcedRides).toBe(0)
  })
})

describe('level 2 — The Tall Tower', () => {
  const measured = measureLevel(LEVEL_2, OPTIONS)

  it('has one hole in the ground, and it is one a triple jump clears', () => {
    expect(share(measured.floorSolid)).toBe(0.63)
    const [hole] = measured.gaps
    expect(measured.gaps).toHaveLength(1)
    expect(hole?.width).toBe(360)
    expect(hole?.jumpable).toBe(true)
    expect(measured.oneWayCrossings).toBe(0)
    expect(measured.fallCost).toBe(3)
  })

  it('is six ledges, nothing moving, and eleven coins', () => {
    expect(measured.ledges).toBe(6)
    expect(measured.narrowestLedge).toBe(130)
    expect(measured.movers).toBe(0)
    expect(measured.coinCount).toBe(11)
  })

  it('lets him reach every coin, sky coin included', () => {
    expect(measured.everyCoinReachable).toBe(true)
  })

  it('is the longest climb of the three and still not a hard jump', () => {
    expect(share(measured.hardestHop)).toBe(0.32)
    expect(measured.routeDepth).toBe(8)
    expect(measured.forcedRides).toBe(0)
  })
})

describe('level 3 — The Sky Ferry', () => {
  const measured = measureLevel(LEVEL_3, OPTIONS)

  it('has half a floor and a hole no jump crosses', () => {
    expect(share(measured.floorSolid)).toBe(0.48)
    const [hole] = measured.gaps
    expect(measured.gaps).toHaveLength(1)
    expect(hole?.width).toBe(500)
    expect(hole?.jumpable).toBe(false)
    expect(hole?.width ?? 0).toBeGreaterThan(runFor(3, TUNING.player))
    expect(measured.oneWayCrossings).toBe(1)
    expect(measured.fallCost).toBe(3)
  })

  it('is five ledges, three of them moving, and thirteen coins', () => {
    expect(measured.ledges).toBe(5)
    expect(measured.narrowestLedge).toBe(120)
    expect(measured.movers).toBe(3)
    expect(measured.coinCount).toBe(13)
  })

  it('lets him reach every coin, because riding counts as standing', () => {
    expect(measured.everyCoinReachable).toBe(true)
  })

  it('makes most of its coins something you ride to, not jump to', () => {
    expect(measured.forcedRides).toBe(10)
  })

  it('has the kindest jumps in the whole game', () => {
    expect(share(measured.hardestHop)).toBe(0.24)
    expect(measured.routeDepth).toBe(6)
  })

  it('gives you a couple of seconds in every six to catch the first ferry', () => {
    // The one that took three goes to park. Its trip is six seconds there and
    // back, and this says a bit over two of them are a chance to get on.
    const [ferry] = measured.ferries
    expect(measured.ferries).toHaveLength(3)
    expect(ferry?.platform).toBe(2)
    expect(ferry?.boardingWindowSeconds).toBeCloseTo(2.28, 2)

    // "Every hop on and off a moving ledge is kept well inside ONE jump" —
    // the comment at the top of level3.ts, now measured rather than believed.
    for (const ferry of measured.ferries) {
      expect(ferry.boardingJumps).toBe(1)
      expect(ferry.boardingWindowSeconds).toBeGreaterThan(1)
    }
  })
})

describe('the three hand-made levels together', () => {
  const one = measureLevel(LEVEL_1, OPTIONS)
  const two = measureLevel(LEVEL_2, OPTIONS)
  const three = measureLevel(LEVEL_3, OPTIONS)

  it('never asks for much more than a third of a triple jump', () => {
    for (const measured of [one, two, three]) {
      expect(measured.hardestHop).toBeLessThan(0.4)
    }
  })

  it('saves its kindest jumps for its hardest level', () => {
    // The surprise the whole difficulty curve is built on: level 3 is the
    // hardest to play and the EASIEST to aim. What makes it hard is waiting.
    expect(three.hardestHop).toBeLessThan(two.hardestHop)
    expect(three.hardestHop).toBeLessThan(one.hardestHop)
  })

  it('gets less floor as it goes', () => {
    expect(one.floorSolid).toBeGreaterThan(two.floorSolid)
    expect(two.floorSolid).toBeGreaterThan(three.floorSolid)
  })
})

/** A one-ledge level to build little made-up cases on top of. */
function tinyLevel(extra: Partial<Level> = {}): Level {
  return {
    name: 'Test Level',
    playerStart: { x: 80, y: 400 },
    platforms: [{ x: 480, y: 520, width: 960, height: 40 }],
    coins: [],
    ...extra,
  }
}

describe('a coin nobody can reach', () => {
  const measured = measureLevel(
    tinyLevel({
      platforms: [
        { x: 480, y: 520, width: 960, height: 40 },
        // A ledge up in the roof of the level with no way up to it.
        { x: 480, y: 60, width: 120, height: 24 },
      ],
      coins: [{ x: 480, y: 20 }],
    }),
    OPTIONS,
  )

  it('is called out rather than quietly priced', () => {
    expect(measured.everyCoinReachable).toBe(false)
    expect(measured.coins[0]?.reachable).toBe(false)
    expect(measured.coins[0]?.cost).toBe(Number.POSITIVE_INFINITY)
    expect(measured.hardestHop).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('riding a platform is a way of standing on it', () => {
  const ferried = tinyLevel({
    platforms: [
      { x: 150, y: 520, width: 300, height: 40 },
      { x: 390, y: 430, width: 170, height: 24, moves: { moveX: 370, seconds: 3 } },
    ],
    // Hanging over the far end of the ferry's trip, and out of reach of both
    // the ground and the ferry sitting at home.
    coins: [{ x: 940, y: 390 }],
  })

  it('reaches a coin that only the far end of the trip goes under', () => {
    const measured = measureLevel(ferried, OPTIONS)
    expect(measured.everyCoinReachable).toBe(true)
    expect(measured.coins[0]?.forcedRide).toBe(true)
    expect(measured.forcedRides).toBe(1)
  })

  it('loses that coin when the movers are frozen', () => {
    // `platforms.movingSpeed: 0` in tuning.ts stops every ferry dead, which is
    // exactly what it says on the tin — and the coin over the far end goes
    // with it.
    const frozen = measureLevel(ferried, { ...OPTIONS, movingSpeed: 0 })
    expect(frozen.everyCoinReachable).toBe(false)
    expect(frozen.ferries).toEqual([])
  })
})

describe('the boarding window', () => {
  const ferried = tinyLevel({
    platforms: [
      { x: 150, y: 520, width: 300, height: 40 },
      { x: 390, y: 430, width: 170, height: 24, moves: { moveX: 370, seconds: 3 } },
    ],
    coins: [{ x: 940, y: 390 }],
  })

  it('is shorter when the same ferry runs faster', () => {
    const normal = measureLevel(ferried, OPTIONS)
    const brisk = measureLevel(ferried, { ...OPTIONS, movingSpeed: 2 })
    expect(brisk.ferries[0]?.boardingWindowSeconds ?? 0).toBeLessThan(
      normal.ferries[0]?.boardingWindowSeconds ?? 0,
    )
  })

  it('is nothing at all for a ferry that never comes near', () => {
    const unreachable = measureLevel(
      tinyLevel({
        platforms: [
          { x: 150, y: 520, width: 300, height: 40 },
          { x: 700, y: 100, width: 120, height: 24, moves: { moveX: 100, seconds: 3 } },
        ],
      }),
      OPTIONS,
    )
    expect(unreachable.ferries[0]?.boardingWindowSeconds).toBe(0)
    expect(unreachable.ferries[0]?.boardingJumps).toBe(0)
  })
})

describe('a level with nothing in it', () => {
  const measured = measureLevel(tinyLevel(), OPTIONS)

  it('has no hardest hop and no route, and says so with zeroes', () => {
    expect(measured.everyCoinReachable).toBe(true)
    expect(measured.hardestHop).toBe(0)
    expect(measured.routeDepth).toBe(0)
    expect(measured.narrowestLedge).toBe(0)
  })
})

describe('ground in more than one piece', () => {
  const measured = measureLevel(
    tinyLevel({
      platforms: [
        // Two pieces laid end to end, which is really one piece of floor.
        { x: 150, y: 520, width: 300, height: 40 },
        { x: 450, y: 520, width: 300, height: 40 },
        // Then three more pieces with a hole between each, so the widest hole
        // is neither the first one nor the last one.
        { x: 675, y: 520, width: 50, height: 40 },
        { x: 830, y: 520, width: 60, height: 40 },
        { x: 940, y: 520, width: 40, height: 40 },
      ],
    }),
    OPTIONS,
  )

  it('counts two pieces that touch as one, and finds both holes', () => {
    expect(share(measured.floorSolid)).toBe(0.78)
    expect(measured.gaps.map((gap) => gap.width)).toEqual([50, 100, 60])
  })

  it('measures falling against the widest hole, not the first or the last', () => {
    // The widest is the middle one, and getting back to the far side of it is
    // four hops from where he starts.
    expect(measured.fallCost).toBe(4)
  })
})

describe('with the jump turned off in tuning.ts', () => {
  // `maxJumps: 0` is a silly number someone is entitled to type into the
  // control panel. He can still walk off things and land on whatever is below
  // him — but there is no catching a ferry without a jump, and this says so
  // rather than pretending there is a window.
  const measured = measureLevel(
    tinyLevel({
      platforms: [
        { x: 150, y: 520, width: 300, height: 40 },
        { x: 200, y: 480, width: 120, height: 24, moves: { moveX: 300, seconds: 3 } },
      ],
    }),
    { ...OPTIONS, maxJumps: 0 },
  )

  it('says there is no window on a ferry he cannot jump onto', () => {
    expect(measured.ferries).toHaveLength(1)
    expect(measured.ferries[0]?.boardingWindowSeconds).toBe(0)
    expect(measured.ferries[0]?.boardingJumps).toBe(0)
  })
})

describe('a ferry parked higher than one jump', () => {
  const measured = measureLevel(
    tinyLevel({
      platforms: [
        { x: 150, y: 520, width: 300, height: 40 },
        // Its deck sits 150 above the ground, and one jump only lifts him 113.
        { x: 400, y: 362, width: 120, height: 24, moves: { moveX: 200, seconds: 3 } },
      ],
    }),
    OPTIONS,
  )

  it('is boarded with two jumps, and the window is measured with two', () => {
    expect(measured.ferries[0]?.boardingJumps).toBe(2)
    expect(measured.ferries[0]?.boardingWindowSeconds ?? 0).toBeGreaterThan(0)
  })
})
