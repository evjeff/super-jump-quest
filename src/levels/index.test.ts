import { describe, expect, it } from 'vitest'
import { bestTimeFor } from '../game/timer'
import { TUNING } from '../tuning'
import { LEVELS, type Level, levelFor, recordKeyFor } from './index'
import { LEVEL_1 } from './level1'
import { LEVEL_2 } from './level2'
import { LEVEL_3 } from './level3'

/** The three-level game exactly as it was before any of this. */
const OLD_GAME = { ...TUNING.levels, endless: false }

/** A world of made-up levels that isn't the one the game ships with. */
const OTHER_WORLD = { ...TUNING.levels, worldSeed: 2 }

describe('levelFor', () => {
  it('hands back our own three levels, exactly as we drew them', () => {
    // Not "looks the same as" — the very same object. Levels 1 to 3 are not
    // allowed to go anywhere near the level-making machinery.
    expect(levelFor(0)).toBe(LEVEL_1)
    expect(levelFor(1)).toBe(LEVEL_2)
    expect(levelFor(2)).toBe(LEVEL_3)
    expect(LEVELS).toEqual([LEVEL_1, LEVEL_2, LEVEL_3])
  })

  it('keeps our own levels filed in the record book under their name', () => {
    // This is what stops a best time set last Saturday from disappearing.
    const saved = { 'First Steps': 12_300 }
    const level = levelFor(0)

    expect(level.recordKey).toBeUndefined()
    expect(bestTimeFor(saved, level.recordKey ?? level.name)).toBe(12_300)
  })

  it('makes up level 4, and it is a real level', () => {
    const level = levelFor(3)

    expect(level.name.length).toBeGreaterThan(0)
    expect(level.platforms.length).toBeGreaterThan(0)
    expect(level.coins.length).toBeGreaterThan(0)
  })

  it('makes the same level 4 today as it did last Saturday', () => {
    expect(levelFor(3)).toEqual(levelFor(3))
    expect(levelFor(50)).toEqual(levelFor(50))
  })

  it('gives every made-up level its own page in the record book', () => {
    const keys = [3, 4, 5, 6, 7, 8, 9, 10].map((index) => levelFor(index).recordKey)

    for (const key of keys) expect(key).toBeTruthy()
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('is the old three-level game again when endless is turned off', () => {
    // Nothing past level 3 exists, so asking for it gets you level 1 back —
    // which is what the game did before there were made-up levels at all.
    expect(levelFor(3, OLD_GAME)).toBe(LEVEL_1)
    expect(levelFor(0, OLD_GAME)).toBe(LEVEL_1)
    expect(levelFor(2, OLD_GAME)).toBe(LEVEL_3)
  })

  it('hands back level 1 for a level number that makes no sense', () => {
    expect(levelFor(-1)).toBe(LEVEL_1)
    expect(levelFor(1.5)).toBe(LEVEL_1)
  })

  it('builds a different level 4 in a different world', () => {
    const ours = levelFor(3)
    const theirs = levelFor(3, OTHER_WORLD)

    expect(theirs).not.toEqual(ours)
    expect(theirs.recordKey).not.toBe(ours.recordKey)
  })
})

describe('recordKeyFor', () => {
  const ground = { x: 480, y: 520, width: 960, height: 40 }
  const level: Level = {
    name: 'Star Hoard',
    playerStart: { x: 80, y: 400 },
    platforms: [ground],
    coins: [{ x: 200, y: 460 }],
  }

  it('is the same key for the same level, every time', () => {
    expect(recordKeyFor(level, 4)).toBe(recordKeyFor(level, 4))
  })

  it('is a different key once the level changes shape', () => {
    const moved = { ...level, coins: [{ x: 201, y: 460 }] }

    expect(recordKeyFor(moved, 4)).not.toBe(recordKeyFor(level, 4))
  })

  it('is a different key for the same shape on a different level number', () => {
    expect(recordKeyFor(level, 5)).not.toBe(recordKeyFor(level, 4))
  })

  it('notices a ledge that has started moving', () => {
    const sliding: Level = {
      ...level,
      platforms: [{ ...ground, moves: { moveX: 300, seconds: 3 } }],
    }

    expect(recordKeyFor(sliding, 4)).not.toBe(recordKeyFor(level, 4))
  })

  it('is short enough to read', () => {
    expect(recordKeyFor(level, 4).length).toBeLessThanOrEqual(20)
  })
})
