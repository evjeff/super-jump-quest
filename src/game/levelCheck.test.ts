import { describe, expect, it } from 'vitest'
import type { Level, Platform } from '../levels'
import { LEVEL_1 } from '../levels/level1'
import { LEVEL_2 } from '../levels/level2'
import { LEVEL_3 } from '../levels/level3'
import { TUNING } from '../tuning'
import { CHECKS, type CheckContext, checkLevel, type Finding, levelScore } from './levelCheck'
import { measureLevel } from './levelMeasure'
import { touchButtonLayout } from './touchControls'

/**
 * The three hand-made levels are the ruler. A child has finished all three, so
 * a `broken` rule that fires on one of them is a wrong rule — not a wrong
 * level — with exactly one exception, and it is written down below.
 */
const CONTEXT: CheckContext = {
  physics: TUNING.player,
  maxJumps: TUNING.player.maxJumps,
  world: TUNING.world,
  movingSpeed: TUNING.platforms.movingSpeed,
  deathDepth: TUNING.world.deathDepth,
  playerWidth: 32,
  touchButtons: touchButtonLayout({
    width: TUNING.world.width,
    height: TUNING.world.height,
    radius: TUNING.touch.buttonRadius,
    jumpRadius: TUNING.touch.jumpButtonRadius,
    restartRadius: TUNING.touch.restartButtonRadius,
    margin: TUNING.touch.edgeMargin,
    directionGap: TUNING.touch.directionGap,
  }),
}

const rules = (findings: Finding[]) => findings.map((finding) => finding.rule)

const broken = (level: Level) =>
  rules(checkLevel(level, CONTEXT).filter((finding) => finding.severity === 'broken'))

const dull = (level: Level) =>
  rules(checkLevel(level, CONTEXT).filter((finding) => finding.severity === 'dull'))

/** The ground all the way across, so a made-up test level has somewhere to stand. */
const GROUND: Platform = { x: 480, y: 520, width: 960, height: 40 }

/** A level that is fine, plus whatever this test wants to go wrong in it. */
function levelWith(bits: Partial<Level>): Level {
  return {
    name: 'A Made-Up Level',
    playerStart: { x: 80, y: 400 },
    platforms: [GROUND],
    coins: [{ x: 300, y: 460 }],
    ...bits,
  }
}

describe('the three hand-made levels', () => {
  it('level 1 breaks no rule at all', () => {
    expect(broken(LEVEL_1)).toEqual([])
  })

  it('level 3 breaks no rule at all — the best level in the game passes', () => {
    expect(broken(LEVEL_3)).toEqual([])
  })

  /**
   * THIS IS A REAL FINDING, NOT A WRONG RULE.
   *
   * Level 2's first coin — the "free one, right where you start" at (200, 460)
   * — sits under where a phone draws its ▶ button. It has been there since
   * level 2 was written, long before any of this, and it is exactly the thing
   * `plan.md` §9 said a checker would have caught. Nothing here weakens the
   * rule and nothing here edits level 2; the test writes down what is true
   * today so that fixing the coin is a deliberate decision someone makes, and
   * this line turns red when they make it.
   */
  it('level 2 has exactly one broken thing: the coin hiding under the ▶ button', () => {
    const findings = checkLevel(LEVEL_2, CONTEXT).filter((f) => f.severity === 'broken')

    expect(findings).toHaveLength(1)
    expect(findings[0]?.rule).toBe('coin-under-a-button')
    expect(findings[0]?.where).toEqual({ x: 200, y: 460 })
    expect(findings[0]?.complaint).toContain('▶')
  })

  it('finds none of them dull — they are the levels people actually play', () => {
    expect(dull(LEVEL_1)).toEqual([])
    expect(dull(LEVEL_2)).toEqual([])
    expect(dull(LEVEL_3)).toEqual([])
  })
})

describe('coins nobody can have', () => {
  it('spots a coin hung higher than a triple jump above anywhere to stand', () => {
    expect(broken(levelWith({ coins: [{ x: 480, y: 20 }] }))).toContain('unreachable-coin')
  })

  it('spots a coin sitting exactly where he lands at the start', () => {
    expect(broken(levelWith({ coins: [{ x: 80, y: 400 }] }))).toContain('coin-on-the-start')
  })

  it('leaves level 3 alone, whose nearest coin is 40 away and has to be walked to', () => {
    expect(broken(LEVEL_3)).not.toContain('coin-on-the-start')
  })

  it('spots a coin buried inside a ledge', () => {
    expect(broken(levelWith({ coins: [{ x: 480, y: 520 }] }))).toContain('coin-inside-a-platform')
  })
})

describe('holes with no way across', () => {
  const shores: Platform[] = [
    { x: 150, y: 520, width: 300, height: 40 },
    { x: 880, y: 520, width: 160, height: 40 },
  ]

  it('spots a 500-wide hole with nothing crossing it', () => {
    const findings = broken(levelWith({ platforms: shores, coins: [{ x: 200, y: 400 }] }))
    expect(findings).toContain('hole-with-no-way-across')
  })

  it('spots a ferry parked too far out to be jumped onto from the near shore', () => {
    const tooFarOut: Platform = {
      x: 700,
      y: 430,
      width: 170,
      height: 24,
      moves: { moveX: 100, seconds: 3 },
    }
    const level = levelWith({ platforms: [...shores, tooFarOut], coins: [{ x: 200, y: 400 }] })
    expect(broken(level)).toContain('hole-with-no-way-across')
  })

  it('spots a ferry hung so high there is no catching it', () => {
    const outOfReach: Platform = {
      x: 390,
      y: 60,
      width: 170,
      height: 24,
      moves: { moveX: 370, seconds: 3 },
    }
    const level = levelWith({ platforms: [...shores, outOfReach], coins: [{ x: 200, y: 400 }] })
    expect(broken(level)).toContain('hole-with-no-way-across')
  })

  it('is happy with level 3, whose ferry waits at the near edge for two seconds', () => {
    expect(broken(LEVEL_3)).not.toContain('hole-with-no-way-across')
  })

  it('spots a bridge over the hole that is too high in the sky to jump on to', () => {
    const upThere: Platform = { x: 550, y: 90, width: 500, height: 24 }
    const level = levelWith({ platforms: [...shores, upThere], coins: [{ x: 200, y: 400 }] })
    expect(broken(level)).toContain('hole-with-no-way-across')
  })

  it('is happy with a still ledge long enough to bridge the hole', () => {
    const bridge: Platform = { x: 550, y: 430, width: 500, height: 24 }
    const level = levelWith({ platforms: [...shores, bridge], coins: [{ x: 200, y: 400 }] })
    expect(broken(level)).not.toContain('hole-with-no-way-across')
  })

  it('treats a ferry frozen by movingSpeed: 0 as that same bridge', () => {
    const parked: Platform = {
      x: 550,
      y: 430,
      width: 500,
      height: 24,
      moves: { moveX: 10, seconds: 3 },
    }
    const level = levelWith({ platforms: [...shores, parked], coins: [{ x: 200, y: 400 }] })
    const frozen = { ...CONTEXT, movingSpeed: 0 }
    expect(rules(checkLevel(level, frozen))).not.toContain('hole-with-no-way-across')
  })
})

describe('things a phone thumb sits on', () => {
  it('spots a whole ledge hidden under the ▲ button', () => {
    const hidden: Platform = { x: 876, y: 456, width: 40, height: 24 }
    expect(broken(levelWith({ platforms: [GROUND, hidden] }))).toContain('ledge-under-a-button')
  })

  it('leaves the ground and level 3 alone — a button drawn over the floor is fine', () => {
    expect(broken(LEVEL_3)).not.toContain('ledge-under-a-button')
    expect(broken(levelWith({}))).not.toContain('ledge-under-a-button')
  })
})

describe('ledges and where they are', () => {
  it('spots a ledge narrower than Pip', () => {
    const sliver: Platform = { x: 480, y: 400, width: 20, height: 24 }
    expect(broken(levelWith({ platforms: [GROUND, sliver] }))).toContain('ledge-too-narrow')
  })

  it('spots a ledge hanging off the right-hand edge of the screen', () => {
    const overhang: Platform = { x: 940, y: 400, width: 100, height: 24 }
    expect(broken(levelWith({ platforms: [GROUND, overhang] }))).toContain('off-the-screen')
  })

  it('spots a coin dropped off the bottom of the screen', () => {
    expect(broken(levelWith({ coins: [{ x: 480, y: 560 }] }))).toContain('off-the-screen')
  })

  it('spots two ledges standing in the same place', () => {
    const here: Platform = { x: 480, y: 400, width: 120, height: 24 }
    const alsoHere: Platform = { x: 520, y: 404, width: 120, height: 24 }
    const level = levelWith({ platforms: [GROUND, here, alsoHere] })
    expect(broken(level)).toContain('platforms-overlapping')
  })

  it('spots a sliding ledge parked over his head at the start', () => {
    const ceiling: Platform = {
      x: 80,
      y: 330,
      width: 120,
      height: 24,
      moves: { moveY: -60, seconds: 2 },
    }
    expect(broken(levelWith({ platforms: [GROUND, ceiling] }))).toContain('ceiling-over-the-start')
  })

  it('leaves level 3 alone, where every slider waits somewhere he is not', () => {
    expect(broken(LEVEL_3)).not.toContain('ceiling-over-the-start')
  })

  it('spots nothing at all under where he starts', () => {
    const shore: Platform = { x: 150, y: 520, width: 300, height: 40 }
    const level = levelWith({ platforms: [shore], playerStart: { x: 900, y: 400 } })
    expect(broken(level)).toContain('no-ground-under-the-start')
  })
})

describe('the two things he said make a level boring', () => {
  it('spots coins strung along at one height', () => {
    const corridor = levelWith({
      coins: [
        { x: 300, y: 460 },
        { x: 450, y: 460 },
        { x: 600, y: 460 },
        { x: 750, y: 460 },
      ],
    })
    expect(dull(corridor)).toContain('all-in-a-row')
    expect(dull(corridor)).toContain('never-leaves-the-ground')
    expect(broken(corridor)).toEqual([])
  })

  it('spots coins evenly spaced up one straight line, even a slanted one', () => {
    const staircase = levelWith({
      coins: [
        { x: 200, y: 460 },
        { x: 350, y: 370 },
        { x: 500, y: 280 },
        { x: 650, y: 190 },
      ],
    })
    expect(dull(staircase)).toContain('all-in-a-row')
    expect(dull(staircase)).not.toContain('never-leaves-the-ground')
  })

  it('lets a scattered handful of coins off', () => {
    const scattered = levelWith({
      coins: [
        { x: 200, y: 460 },
        { x: 350, y: 200 },
        { x: 500, y: 430 },
        { x: 900, y: 120 },
      ],
    })
    expect(dull(scattered)).not.toContain('all-in-a-row')
  })

  it('says nothing about a level with one coin in it', () => {
    expect(dull(levelWith({ coins: [{ x: 300, y: 200 }] }))).not.toContain('all-in-a-row')
  })

  it('spots a level the third jump is never needed for', () => {
    const low = levelWith({
      coins: [
        { x: 300, y: 460 },
        { x: 400, y: 300 },
        { x: 600, y: 455 },
      ],
    })
    expect(dull(low)).toEqual(['never-leaves-the-ground'])
  })
})

describe('picking the least-bad of several levels', () => {
  it('scores a clean level at nothing', () => {
    expect(levelScore(checkLevel(LEVEL_1, CONTEXT))).toBe(0)
  })

  it('adds up the dull findings so two boring levels can be told apart', () => {
    const corridor = levelWith({
      coins: [
        { x: 300, y: 460 },
        { x: 450, y: 460 },
        { x: 600, y: 460 },
        { x: 750, y: 460 },
      ],
    })
    const low = levelWith({
      coins: [
        { x: 300, y: 460 },
        { x: 400, y: 300 },
        { x: 600, y: 455 },
      ],
    })

    expect(levelScore(checkLevel(low, CONTEXT))).toBeGreaterThan(0)
    expect(levelScore(checkLevel(corridor, CONTEXT))).toBeGreaterThan(
      levelScore(checkLevel(low, CONTEXT)),
    )
  })

  it('makes one broken thing cost more than every dull thing put together', () => {
    const everythingDull = CHECKS.filter((check) => check.severity === 'dull')
    const allTheDullness = everythingDull.reduce((total, check) => total + check.weight, 0)
    const cheapestBroken = Math.min(
      ...CHECKS.filter((check) => check.severity === 'broken').map((check) => check.weight),
    )

    expect(cheapestBroken).toBeGreaterThan(allTheDullness)
  })
})

describe('the list of checks itself', () => {
  it('starts with exactly the two dull rules he named, and no invented ones', () => {
    expect(CHECKS.filter((check) => check.severity === 'dull').map((check) => check.rule)).toEqual([
      'all-in-a-row',
      'never-leaves-the-ground',
    ])
  })

  it('gives every check its own name', () => {
    const names = CHECKS.map((check) => check.rule)
    expect(new Set(names).size).toBe(names.length)
  })

  it('gives every check a complaint a player would recognise', () => {
    for (const finding of checkLevel(LEVEL_2, CONTEXT)) {
      expect(finding.complaint.length).toBeGreaterThan(20)
    }
  })

  it('takes a measurement someone else has already made', () => {
    const measured = measureLevel(LEVEL_3, CONTEXT)
    expect(checkLevel(LEVEL_3, { ...CONTEXT, measurement: measured })).toEqual(
      checkLevel(LEVEL_3, CONTEXT),
    )
  })
})
