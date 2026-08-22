import { describe, expect, it } from 'vitest'
import type { Level, Platform } from '../levels'
import { TUNING } from '../tuning'
import { CHECKS, checkLevel, type Finding } from './levelCheck'
import { difficultyFor, draftLevel, type GenerateOptions, generateLevel } from './levelGen'
import { measureLevel, standingArea } from './levelMeasure'
import { touchButtonLayout } from './touchControls'

/**
 * The game exactly as `tuning.ts` has it today, which is the game a child is
 * actually holding. Every claim below is a claim about THIS game — turn the
 * jump up and the levels change, which is a promise of its own and has its own
 * test at the bottom.
 */
const OPTIONS: GenerateOptions = {
  physics: TUNING.player,
  maxJumps: TUNING.player.maxJumps,
  world: TUNING.world,
  movingSpeed: TUNING.platforms.movingSpeed,
  deathDepth: TUNING.world.deathDepth,
  playerWidth: 32,
  playerHeight: 48,
  touchButtons: touchButtonLayout({
    width: TUNING.world.width,
    height: TUNING.world.height,
    radius: TUNING.touch.buttonRadius,
    jumpRadius: TUNING.touch.jumpButtonRadius,
    restartRadius: TUNING.touch.restartButtonRadius,
    margin: TUNING.touch.edgeMargin,
    directionGap: TUNING.touch.directionGap,
  }),
  worldSeed: 1,
}

/**
 * Every level a child could plausibly reach in a lifetime of Saturdays. The
 * whole ladder is checked, not a sample of it: a generator that is right about
 * level 12 and wrong about level 137 has still shipped a broken level to
 * somebody.
 */
const FIRST = 4
const LAST = 200
const NUMBERS = Array.from({ length: LAST - FIRST + 1 }, (_, i) => FIRST + i)

/** The levels the game would really hand out, re-rolls and all. */
const PLAYED = NUMBERS.map((number) => generateLevel(number, OPTIONS))

/** The FIRST thing the builder made for each number, before any re-rolling. */
const FIRST_DRAFTS = NUMBERS.map((number) => draftLevel(number, 0, OPTIONS))

const brokenIn = (level: Level, options: GenerateOptions = OPTIONS): Finding[] =>
  checkLevel(level, options).filter((finding) => finding.severity === 'broken')

const measured = (level: Level) => measureLevel(level, OPTIONS)

/** Everywhere a ledge ever gets to, and how tall it is, as one rectangle. */
const spaceTakenBy = (platform: Platform, options: GenerateOptions) => {
  const deck = standingArea(platform, options.movingSpeed)
  return {
    left: deck.left,
    right: deck.right,
    top: deck.highest,
    bottom: deck.lowest + platform.height,
  }
}

/**
 * Ledges with a ceiling lower than Pip is tall over them.
 *
 * A deck with less than 48 pixels of air above it is not somewhere to stand,
 * it is a shelf he cannot get into — so it is decoration at best, and at worst
 * it is the only way up to a coin and the level quietly stops there.
 */
const noRoomToStandOn = (level: Level, options: GenerateOptions) => {
  const boxes = level.platforms.map((platform) => spaceTakenBy(platform, options))
  const complaints: string[] = []

  for (const [index, deck] of boxes.entries()) {
    for (const [other, above] of boxes.entries()) {
      if (index === other) continue
      if (above.right <= deck.left || above.left >= deck.right) continue
      if (above.bottom > deck.top) continue
      const room = deck.top - above.bottom
      if (room >= options.playerHeight) continue
      complaints.push(
        `the ledge at ${deck.left}, ${deck.top} has only ${Math.round(room)} above it`,
      )
    }
  }

  return complaints
}

/** Ledges standing in the space Pip's own body fills as the level opens. */
const standingInsideHim = (level: Level, options: GenerateOptions) => {
  const him = {
    left: level.playerStart.x - options.playerWidth / 2,
    right: level.playerStart.x + options.playerWidth / 2,
    top: level.playerStart.y - options.playerHeight / 2,
    bottom: level.playerStart.y + options.playerHeight / 2,
  }

  return level.platforms
    .map((platform) => spaceTakenBy(platform, options))
    .filter(
      (box) =>
        box.left < him.right &&
        box.right > him.left &&
        box.top < him.bottom &&
        box.bottom > him.top,
    )
    .map((box) => `a ledge fills ${box.left}, ${box.top} where he is standing`)
}

/** The average of a list, for the "does this dial actually move" questions. */
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

describe('the same level number is always the same level', () => {
  it('builds level 7 identically every time it is asked', () => {
    expect(generateLevel(7, OPTIONS)).toEqual(generateLevel(7, OPTIONS))
  })

  it('gives a different world a different level 7', () => {
    const otherWorld = generateLevel(7, { ...OPTIONS, worldSeed: 2 })
    expect(otherWorld).not.toEqual(generateLevel(7, OPTIONS))
  })

  it('gives the old level 7 back when the world seed goes back', () => {
    const before = generateLevel(7, OPTIONS)
    generateLevel(7, { ...OPTIONS, worldSeed: 99 })
    expect(generateLevel(7, { ...OPTIONS, worldSeed: 1 })).toEqual(before)
  })

  it('is the same plain data a hand-made level file is', () => {
    const level = generateLevel(12, OPTIONS)
    expect(JSON.parse(JSON.stringify(level))).toEqual(level)
  })

  it('never runs out: level 4 and level 200 are both real levels', () => {
    expect(PLAYED[0]?.coins.length).toBeGreaterThan(0)
    expect(PLAYED[PLAYED.length - 1]?.coins.length).toBeGreaterThan(0)
  })
})

describe('every level from 4 to 200 is one somebody can finish', () => {
  it('breaks not one of the never-ship rules', () => {
    const complaints = NUMBERS.flatMap((number, index) =>
      brokenIn(PLAYED[index] as Level).map((finding) => `level ${number}: ${finding.complaint}`),
    )
    expect(complaints).toEqual([])
  })

  /**
   * The re-roll is there for levels that are BORING, not for levels that are
   * broken. Building a level walks the route the player will walk, so a broken
   * first draft is a bug in the builder — being saved by attempt seven would
   * only hide it.
   */
  it('gets it right first time, with no re-roll needed to make it legal', () => {
    const complaints = NUMBERS.flatMap((number, index) =>
      brokenIn(FIRST_DRAFTS[index]?.level as Level).map(
        (finding) => `level ${number}, first draft: ${finding.complaint}`,
      ),
    )
    expect(complaints).toEqual([])
  })

  it('can get every single coin in every single level', () => {
    for (const level of PLAYED) expect(measured(level).everyCoinReachable).toBe(true)
  })

  /**
   * He drops into the level at a spot, and that spot has to be empty air.
   * Put a ledge where his body already is and the game shoves him out of it on
   * the very first frame — he pops sideways or upward before anybody has
   * touched a key, which looks exactly like a bug because it is one.
   */
  it('never stands a ledge in the space he opens the level in', () => {
    const complaints = NUMBERS.flatMap((number, index) => [
      ...standingInsideHim(PLAYED[index] as Level, OPTIONS).map(
        (said) => `level ${number}: ${said}`,
      ),
      ...standingInsideHim(FIRST_DRAFTS[index]?.level as Level, OPTIONS).map(
        (said) => `level ${number}, first draft: ${said}`,
      ),
    ])
    expect(complaints).toEqual([])
  })

  /**
   * Pip is 48 tall, so a ledge with 40 pixels of air over it is a shelf, not a
   * platform. He cannot get into the gap, which makes the ledge a lie — and
   * when it is the only way up to a coin, the level stops there without ever
   * looking broken.
   */
  it('leaves him room to stand up on every ledge it builds', () => {
    const complaints = NUMBERS.flatMap((number, index) => [
      ...noRoomToStandOn(PLAYED[index] as Level, OPTIONS).map((said) => `level ${number}: ${said}`),
      ...noRoomToStandOn(FIRST_DRAFTS[index]?.level as Level, OPTIONS).map(
        (said) => `level ${number}, first draft: ${said}`,
      ),
    ])
    expect(complaints).toEqual([])
  })

  it('never asks for a harder jump than the level said it would', () => {
    for (const draft of FIRST_DRAFTS) {
      expect(measured(draft.level).hardestHop).toBeLessThanOrEqual(draft.dials.hardestHop + 0.01)
    }
  })
})

describe('the dials land where the curve promised', () => {
  it('climbs from a breather after level 3 and never stops climbing', () => {
    expect(difficultyFor(4)).toBeCloseTo(0.36, 2)
    expect(difficultyFor(8)).toBeCloseTo(0.56, 2)
    expect(difficultyFor(23)).toBeCloseTo(0.79, 2)
    expect(difficultyFor(203)).toBeCloseTo(0.97, 2)
    expect(difficultyFor(4)).toBeLessThan(difficultyFor(5))
    expect(difficultyFor(199)).toBeLessThan(difficultyFor(200))
  })

  it('stays inside every dial: coins, movers, floor and ledges', () => {
    for (const level of PLAYED) {
      const found = measured(level)
      expect(found.coinCount).toBeGreaterThanOrEqual(8)
      expect(found.coinCount).toBeLessThanOrEqual(24)
      expect(found.movers).toBeLessThanOrEqual(6)
      expect(found.floorSolid).toBeGreaterThanOrEqual(0.29)
      expect(found.floorSolid).toBeLessThanOrEqual(1)
      expect(found.narrowestLedge).toBeGreaterThanOrEqual(90)
    }
  })

  it('leaves somewhere to stand on every last piece of it', () => {
    for (const level of PLAYED) {
      for (const platform of level.platforms) {
        expect(platform.width).toBeGreaterThanOrEqual(90)
      }
    }
  })

  it('takes the floor away, and adds coins and movers, as the ladder climbs', () => {
    const early = PLAYED.slice(0, 17).map((level) => measured(level))
    const late = PLAYED.slice(-40).map((level) => measured(level))

    expect(mean(late.map((m) => m.floorSolid))).toBeLessThan(mean(early.map((m) => m.floorSolid)))
    expect(mean(late.map((m) => m.coinCount))).toBeGreaterThan(mean(early.map((m) => m.coinCount)))
    expect(mean(late.map((m) => m.movers))).toBeGreaterThan(mean(early.map((m) => m.movers)))
  })

  it('asks a little more of a jump, and leaves a little less to land on', () => {
    const early = PLAYED.slice(0, 17).map((level) => measured(level))
    const late = PLAYED.slice(-40).map((level) => measured(level))

    expect(mean(late.map((m) => m.hardestHop))).toBeGreaterThan(
      mean(early.map((m) => m.hardestHop)),
    )
    expect(mean(late.map((m) => m.narrowestLedge))).toBeLessThan(
      mean(early.map((m) => m.narrowestLedge)),
    )
  })

  it('makes you ride for your coins more and more often', () => {
    const early = PLAYED.slice(0, 17).map((level) => measured(level))
    const late = PLAYED.slice(-40).map((level) => measured(level))

    expect(mean(late.map((m) => m.forcedRides))).toBeGreaterThan(
      mean(early.map((m) => m.forcedRides)),
    )
  })

  it('scatters: a ladder where every rung is the same is not random', () => {
    const coinCounts = new Set(PLAYED.map((level) => level.coins.length))
    const floors = new Set(PLAYED.map((level) => Math.round(measured(level).floorSolid * 20)))
    expect(coinCounts.size).toBeGreaterThan(5)
    expect(floors.size).toBeGreaterThan(5)
  })

  it('gives every level one thing it is ABOUT, and is kinder everywhere else', () => {
    for (const draft of FIRST_DRAFTS) {
      const weights = Object.values(draft.weights)
      const shares = Object.values(draft.shares)
      expect(Math.max(...weights)).toBeGreaterThan(mean(weights) * 1.5)
      expect(Math.max(...shares)).toBeGreaterThan(mean(shares) * 1.25)
      expect(draft.weights[draft.job]).toBe(Math.max(...weights))
    }
  })

  it('never gives a level the same job as the level before it', () => {
    for (let index = 1; index < FIRST_DRAFTS.length; index++) {
      expect(FIRST_DRAFTS[index]?.job).not.toBe(FIRST_DRAFTS[index - 1]?.job)
    }
  })
})

describe('the two boring rules, and how much of the ladder they throw away', () => {
  /**
   * A rule that rejects more than about a quarter of the ladder is not taste,
   * it is a bug — in the rule or in the builder. This is the number `spec.md`
   * asks the test suite to report for every rule.
   */
  it('rejects only a small minority of first drafts', () => {
    const rejected = new Map<string, number>()
    for (const check of CHECKS) {
      if (check.severity === 'dull') rejected.set(check.rule, 0)
    }

    let cleanFirstDrafts = 0
    for (const draft of FIRST_DRAFTS) {
      const findings = checkLevel(draft.level, OPTIONS)
      if (findings.length === 0) cleanFirstDrafts++
      for (const finding of findings) {
        if (finding.severity !== 'dull') continue
        rejected.set(finding.rule, (rejected.get(finding.rule) ?? 0) + 1)
      }
    }

    // Spelled out in the failure message so the number gets READ, not guessed.
    const shares = [...rejected].map(
      ([rule, count]) => `${rule}: ${Math.round((count / FIRST_DRAFTS.length) * 100)}%`,
    )

    for (const [rule, count] of rejected) {
      const share = count / FIRST_DRAFTS.length
      expect(share, `${rule} throws away too much of the ladder — ${shares}`).toBeLessThan(0.25)
    }

    // And the re-roll is a safety net rather than the way levels get made: the
    // very first thing the builder puts together is nearly always playable.
    expect(cleanFirstDrafts / FIRST_DRAFTS.length).toBeGreaterThan(0.9)
  })

  it('hands out a level even when every try is a bad one', () => {
    // A jump so enormous that nothing which fits on a 540-tall screen is more
    // than two jumps above the ground — so "never leaves the ground" is true of
    // every level that could possibly be built here, and all twelve tries come
    // back boring. The builder still has to hand one over, because the game
    // always needs a next level.
    const puddle: GenerateOptions = {
      ...OPTIONS,
      physics: { ...TUNING.player, jumpVelocity: 1400 },
    }

    const level = generateLevel(9, puddle)
    expect(level.platforms.length).toBeGreaterThan(0)
    expect(level.coins.length).toBeGreaterThan(0)
    expect(brokenIn(level, puddle)).toEqual([])
  })
})

describe('the levels are built out of what tuning.ts says he can do', () => {
  const moonJump: GenerateOptions = {
    ...OPTIONS,
    physics: { ...TUNING.player, jumpVelocity: TUNING.player.jumpVelocity * 2 },
  }

  const sample = Array.from({ length: 40 }, (_, i) => 4 + i)

  it('spreads the levels out when the jump gets bigger', () => {
    const normal = sample.map((n) => mean(draftLevel(n, 0, OPTIONS).hops))
    const bigger = sample.map((n) => mean(draftLevel(n, 0, moonJump).hops))

    expect(mean(bigger)).toBeGreaterThan(mean(normal) * 1.4)
  })

  it('still breaks no never-ship rule with a jump twice the size', () => {
    for (const number of sample) {
      expect(brokenIn(generateLevel(number, moonJump), moonJump)).toEqual([])
    }
  })

  it('still breaks no never-ship rule with every ferry frozen solid', () => {
    const frozen: GenerateOptions = { ...OPTIONS, movingSpeed: 0 }
    for (const number of NUMBERS) {
      expect(brokenIn(generateLevel(number, frozen), frozen)).toEqual([])
    }
  })

  /**
   * A feeble jump and heavy gravity at the same time: he barely gets off the
   * floor and comes down like a brick. This is the pair of knobs that used to
   * stack the ledges 40 apart — closer together than Pip is tall — so half the
   * level was shelves he could not climb into and the coins up there were gone.
   */
  it('still leaves him room to stand when the jump is feeble and gravity is heavy', () => {
    const leaden: GenerateOptions = {
      ...OPTIONS,
      physics: { ...TUNING.player, jumpVelocity: 400, gravity: 2400 },
    }
    for (const number of sample) {
      const level = generateLevel(number, leaden)
      expect(noRoomToStandOn(level, leaden)).toEqual([])
      expect(standingInsideHim(level, leaden)).toEqual([])
      expect(brokenIn(level, leaden)).toEqual([])
    }
  })

  /**
   * A hole sized to exactly two one-jump reaches with a bridge in the middle
   * of it, and then the bridge nudged eight pixels sideways: the far bank went
   * out of reach and every one of the twelve tries came back with a hole
   * nothing crosses. This is that level.
   */
  it('leaves a bridge you can get on to from both banks, even at full stretch', () => {
    const frozenElsewhere: GenerateOptions = { ...OPTIONS, movingSpeed: 0, worldSeed: 2 }
    expect(brokenIn(generateLevel(1765, frozenElsewhere), frozenElsewhere)).toEqual([])
  })

  it('still breaks no never-ship rule when he is floaty and slow', () => {
    const floaty: GenerateOptions = {
      ...OPTIONS,
      physics: { speed: 90, jumpVelocity: 300, gravity: 400 },
      maxJumps: 2,
    }
    for (const number of sample) {
      expect(brokenIn(generateLevel(number, floaty), floaty)).toEqual([])
    }
  })

  /**
   * Fast legs and a feeble jump: he can run the width of the screen but he can
   * barely get off the floor. There is no height to stand a bridge at and none
   * to park a ferry at, so the levels come out as flat ground with holes small
   * enough to step over — and where even that will not fit, no holes at all.
   * Dull as ditchwater, and still a legal level every time.
   */
  it('lays flat ground when he can run but not jump', () => {
    const scuttling: GenerateOptions = {
      ...OPTIONS,
      physics: { speed: 300, jumpVelocity: 220, gravity: 1200 },
    }
    for (const number of sample) {
      expect(brokenIn(generateLevel(number, scuttling), scuttling)).toEqual([])
    }
  })

  /**
   * Enormous phone buttons — `touch.buttonRadius` turned right up, which
   * `tuning.ts` invites you to do. Nothing may hide underneath one: not a coin,
   * and not a whole ledge you would have to land on blind.
   */
  it('keeps out from under the buttons even when they are huge', () => {
    const bigThumbs: GenerateOptions = {
      ...OPTIONS,
      touchButtons: touchButtonLayout({
        width: TUNING.world.width,
        height: TUNING.world.height,
        radius: 130,
        jumpRadius: 150,
        restartRadius: 60,
        margin: TUNING.touch.edgeMargin,
        directionGap: TUNING.touch.directionGap,
      }),
    }
    for (const number of sample) {
      expect(brokenIn(generateLevel(number, bigThumbs), bigThumbs)).toEqual([])
    }
  })
})

describe('every level gets a name worth saying out loud', () => {
  it('is two words, and the same two words every time', () => {
    for (const level of PLAYED) {
      expect(level.name.split(' ')).toHaveLength(2)
    }
    expect(generateLevel(14, OPTIONS).name).toBe(generateLevel(14, OPTIONS).name)
  })

  it('is not the same name for every level', () => {
    expect(new Set(PLAYED.map((level) => level.name)).size).toBeGreaterThan(20)
  })

  it('says what the level is about: a floor full of holes is a Canyon', () => {
    const floorLevels = FIRST_DRAFTS.filter((draft) => draft.job === 'floorSolid')
    expect(floorLevels.length).toBeGreaterThan(0)
    for (const draft of floorLevels) {
      expect(['Canyon', 'Crossing']).toContain(draft.level.name.split(' ')[1])
    }
  })
})
