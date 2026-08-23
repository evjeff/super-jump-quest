import { describe, expect, it } from 'vitest'
import { TUNING } from '../tuning'
import { airtimeFor, hopCost, riseFor, runFor } from './reach'

/**
 * The numbers this file pins are not invented here. They are the ones written
 * by hand at the top of `src/levels/level3.ts`, worked out by a person laying
 * out that level and then checked by playing it:
 *
 *   "he rises about 113 pixels in one jump, 225 in two, 338 in three, and moves
 *    about 190 sideways during a single jump"
 *   "Three jumps in a row only carry him about 450"
 *
 * If this file and that comment ever disagree, one of them is lying to a level
 * designer, and it matters which.
 */
const PIP = TUNING.player

describe('riseFor — how high he gets', () => {
  it('matches the heights level 3 was designed around', () => {
    expect(Math.round(riseFor(1, PIP))).toBe(113)
    expect(Math.round(riseFor(2, PIP))).toBe(225)
    expect(Math.round(riseFor(3, PIP))).toBe(338)
  })

  it('gives nothing to someone who does not jump', () => {
    expect(riseFor(0, PIP)).toBe(0)
  })

  it('stacks evenly, because every jump starts from a standstill', () => {
    expect(riseFor(2, PIP)).toBeCloseTo(riseFor(1, PIP) * 2)
  })

  it('goes up with the square of the jump, so a small change is a big one', () => {
    // The moon-jump in tuning.ts: twice the launch is FOUR times the height,
    // which is why 900 feels so wild after 520.
    const stronger = { ...PIP, jumpVelocity: PIP.jumpVelocity * 2 }
    expect(riseFor(1, stronger)).toBeCloseTo(riseFor(1, PIP) * 4)
  })

  it('goes down as the world pulls harder', () => {
    const heavy = { ...PIP, gravity: PIP.gravity * 2 }
    expect(riseFor(1, heavy)).toBeCloseTo(riseFor(1, PIP) / 2)
  })
})

describe('runFor — how far he gets sideways in one go', () => {
  it('matches the distances level 3 was designed around', () => {
    // One jump: "about 190 sideways".
    expect(Math.round(runFor(1, PIP))).toBe(191)
    // Three: "about 450" — the number the 500-wide hole was chosen against.
    expect(Math.round(runFor(3, PIP))).toBe(451)
  })

  it('is exactly running speed times how long he is off the ground', () => {
    expect(runFor(2, PIP)).toBeCloseTo(PIP.speed * airtimeFor(2, PIP))
  })

  it('is zero for someone standing still on the ground', () => {
    expect(runFor(0, PIP)).toBe(0)
  })
})

describe('airtimeFor — how long he hangs there', () => {
  it('is up and down again for a single jump', () => {
    // Up takes jumpVelocity / gravity, and coming down takes exactly as long.
    expect(airtimeFor(1, PIP)).toBeCloseTo((PIP.jumpVelocity / PIP.gravity) * 2)
  })

  it('grows with each extra jump, but by less each time', () => {
    const first = airtimeFor(1, PIP)
    const second = airtimeFor(2, PIP) - first
    const third = airtimeFor(3, PIP) - airtimeFor(2, PIP)
    expect(second).toBeGreaterThan(0)
    expect(third).toBeGreaterThan(0)
    // The climb is the same each time; only the fall at the end gets longer,
    // and a fall from twice the height does not take twice as long.
    expect(third).toBeLessThan(second)
  })
})

describe('hopCost — how much of a jump a hop uses up', () => {
  const HERE = { x: 400, y: 400 }

  it('costs nothing to stay where you are', () => {
    expect(hopCost(HERE, HERE, 3, PIP)).toBe(0)
  })

  it('costs everything at exactly the furthest he can go', () => {
    const far = { x: HERE.x + runFor(3, PIP), y: HERE.y }
    expect(hopCost(HERE, far, 3, PIP)).toBeCloseTo(1)
  })

  it('costs half as much at half the distance', () => {
    const halfway = { x: HERE.x + runFor(3, PIP) / 2, y: HERE.y }
    expect(hopCost(HERE, halfway, 3, PIP)).toBeCloseTo(0.5)
  })

  it('does not care which way he is going', () => {
    const right = { x: HERE.x + 200, y: HERE.y }
    const left = { x: HERE.x - 200, y: HERE.y }
    expect(hopCost(HERE, right, 3, PIP)).toBeCloseTo(hopCost(HERE, left, 3, PIP))
  })

  it('costs everything at exactly the highest he can get', () => {
    // y counts DOWNWARDS, so higher up the screen is a smaller y.
    const ceiling = { x: HERE.x, y: HERE.y - riseFor(3, PIP) }
    expect(hopCost(HERE, ceiling, 3, PIP)).toBeCloseTo(1)
  })

  it('says out of reach when it is out of reach', () => {
    const tooHigh = { x: HERE.x, y: HERE.y - riseFor(3, PIP) - 1 }
    expect(hopCost(HERE, tooHigh, 3, PIP)).toBe(Number.POSITIVE_INFINITY)

    const tooFar = { x: HERE.x + runFor(3, PIP) + 1, y: HERE.y }
    expect(hopCost(HERE, tooFar, 3, PIP)).toBeGreaterThan(1)
  })

  it('leaves less room sideways once a hop also has to climb', () => {
    const across = { x: HERE.x + 300, y: HERE.y }
    const acrossAndUp = { x: HERE.x + 300, y: HERE.y - 200 }
    expect(hopCost(HERE, acrossAndUp, 3, PIP)).toBeGreaterThan(hopCost(HERE, across, 3, PIP))
  })

  it('gives him more room sideways when he is dropping', () => {
    // Falling buys time in the air, which is why a long jump DOWN off a high
    // ledge is the easy one.
    const across = { x: HERE.x + 300, y: HERE.y }
    const acrossAndDown = { x: HERE.x + 300, y: HERE.y + 200 }
    expect(hopCost(HERE, acrossAndDown, 3, PIP)).toBeLessThan(hopCost(HERE, across, 3, PIP))
  })

  it('is dearer with fewer jumps to spend', () => {
    const target = { x: HERE.x + 250, y: HERE.y - 100 }
    expect(hopCost(HERE, target, 1, PIP)).toBeGreaterThan(hopCost(HERE, target, 3, PIP))
  })

  it('grows when the jump is turned down, and shrinks when it is turned up', () => {
    // This is the promise that makes generated levels safe: change tuning.ts and
    // the same hop is honestly re-priced, rather than quietly becoming a lie.
    const target = { x: HERE.x + 300, y: HERE.y - 150 }
    const feeble = { ...PIP, jumpVelocity: 400 }
    const mighty = { ...PIP, jumpVelocity: 900 }
    expect(hopCost(HERE, target, 3, feeble)).toBeGreaterThan(hopCost(HERE, target, 3, PIP))
    expect(hopCost(HERE, target, 3, mighty)).toBeLessThan(hopCost(HERE, target, 3, PIP))
  })
})
