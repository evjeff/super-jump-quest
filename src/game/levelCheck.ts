/**
 * What is WRONG with a level — pure sums, no Phaser, no browser.
 *
 * `levelMeasure.ts` says what a level is like to play. This file says whether
 * anyone should be asked to play it, and it answers in two very different
 * grades:
 *
 *   BROKEN — the level cannot be played properly. A coin nothing can reach, a
 *            hole with no way over, a ledge you cannot see because a phone
 *            draws a button on top of it. These are never shipped to a child:
 *            a kid who meets one does not think "unlucky", they think the game
 *            is broken, and they are right.
 *   DULL   — the level is perfectly legal and nobody wants to play it. These
 *            are guesses about fun rather than facts, so they cost a level a
 *            re-roll and never a refusal. Each one carries a WEIGHT, so when
 *            twelve tries have all come back a bit boring, the least boring of
 *            them can still be picked and played.
 *
 * The whole shape of this file is "a list that grows". Every check is one small
 * named function and one line in `CHECKS`, so the next time somebody puts the
 * game down and says "ugh, that level was annoying BECAUSE…", the answer is one
 * function and one test, in one sitting. That is the point of it, and it is why
 * the checks are a list rather than one big clever function.
 *
 * The two dull rules here are the two the nine-year-old who designs this game
 * named when he was asked what makes a level boring, in his words: "coins all
 * in a straight line" and "never leaving the ground". Rules invented at a desk
 * are worth less than rules that came from somebody actually being bored, so
 * the others that were thought of are written down at the bottom as CANDIDATES
 * and deliberately not switched on.
 *
 * See `docs/adr/20260822-random-endless-levels/` — `spec.md` has the full
 * never-ship list, and `plan.md` §6 has why two grades rather than pass/fail.
 *
 * Remember y counts DOWNWARDS: higher up the screen is a SMALLER y.
 */

import type { Coin, Level, Platform } from '../levels'
import {
  type LevelMeasurement,
  type MeasureOptions,
  measureLevel,
  standingArea,
} from './levelMeasure'
import { hopCost, type Point, riseFor, runFor } from './reach'
import { isOnButton, type TouchButton } from './touchControls'

/** How bad a thing is. See the two paragraphs at the top of this file. */
export type Severity = 'broken' | 'dull'

/** One thing wrong with a level. */
export interface Finding {
  /** Which check found it, the way you would name it in a bug report. */
  rule: string

  severity: Severity

  /** How much this costs the level when picking the least-bad of several. */
  weight: number

  /** What a player would complain about, in a sentence. */
  complaint: string

  /** Where on the screen the trouble is, when there is one place. */
  where?: Point
}

/** Everything a check needs to know about the game the level belongs to. */
export interface CheckContext extends MeasureOptions {
  /**
   * Where a phone draws its buttons, from `touchButtonLayout` in
   * `touchControls.ts` — the one place that decides where they go, so that
   * moving a button moves this rule with it.
   */
  touchButtons: readonly TouchButton[]

  /** Fall below this and you are dead. `TUNING.world.deathDepth`. */
  deathDepth: number

  /** How wide Pip is on the screen. 32 today. */
  playerWidth: number

  /** A measurement someone has already taken, to save taking it twice. */
  measurement?: LevelMeasurement
}

/** One thing one check found. `checkLevel` turns these into `Finding`s. */
interface Complaint {
  complaint: string
  where?: Point
}

/** One rule about levels. Add one of these and a test, and the library grew. */
export interface Check {
  rule: string
  severity: Severity
  weight: number
  look: (level: Level, context: CheckContext, measured: LevelMeasurement) => Complaint[]
}

/**
 * What one broken thing costs.
 *
 * Deliberately more than every dull rule added together: a level with one thing
 * genuinely wrong with it must always lose to a level that is merely boring,
 * however many ways it is boring. `levelCheck.test.ts` holds this to that.
 */
const BROKEN_WEIGHT = 100

/**
 * How long a chance to jump onto a ferry has to last to count as a way across
 * a hole, in seconds.
 *
 * Level 3's tightest ferry gives you a bit over two seconds, and that was
 * judged fair for somebody who had never seen the level. The version of it that
 * got thrown away gave about a third of a second in every eight: catchable, but
 * only if you already knew it was coming, which is not a thing you can know the
 * first time. One second is the line between those two.
 */
const FAIR_BOARDING_SECONDS = 1

/**
 * How straight is a straight line.
 *
 * Coins this much off the line through the two end ones still count as being on
 * it — about Pip's own width, so "you never have to leave the line to get one".
 */
const LINE_TOLERANCE = 32

/** How uneven "evenly spaced" is allowed to be: a quarter of the usual step. */
const EVEN_ENOUGH = 0.25

/** A rule about levels that must never ship. They all cost the same: everything. */
function broken(rule: string, look: Check['look']): Check {
  return { rule, severity: 'broken', weight: BROKEN_WEIGHT, look }
}

/** A rule about levels that are no fun. The weight is how much no fun it is. */
function dull(rule: string, weight: number, look: Check['look']): Check {
  return { rule, severity: 'dull', weight, look }
}

/**
 * Everything that can be wrong with a level, worst first.
 *
 * ADDING A RULE IS ADDING A LINE HERE, plus the little function it names, plus
 * one test. Nothing else in the game needs to know. That is the whole design of
 * this file, because the list is meant to grow every time a level annoys
 * somebody.
 *
 * The last two are the dull ones, and they are his, word for word. Never
 * leaving the ground is the worse of the two — a level where the coins line up
 * at least still lets you jump — so it costs a little more.
 */
export const CHECKS: readonly Check[] = [
  broken('unreachable-coin', unreachableCoins),
  broken('hole-with-no-way-across', holesNothingCrosses),
  broken('coin-on-the-start', coinsOnTheStart),
  broken('coin-under-a-button', coinsUnderAButton),
  broken('ledge-under-a-button', ledgesUnderAButton),
  broken('ledge-too-narrow', ledgesTooNarrow),
  broken('ceiling-over-the-start', ceilingsOverTheStart),
  broken('off-the-screen', thingsOffTheScreen),
  broken('coin-inside-a-platform', coinsInsideAPlatform),
  broken('platforms-overlapping', platformsOverlapping),
  broken('no-ground-under-the-start', nothingUnderTheStart),
  dull('all-in-a-row', 2, coinsAllInARow),
  dull('never-leaves-the-ground', 3, neverLeavesTheGround),
]

/**
 * Everything wrong with this level: the one function in this file anyone else
 * calls. An empty list means it is worth playing.
 */
export function checkLevel(level: Level, context: CheckContext): Finding[] {
  const measured = context.measurement ?? measureLevel(level, context)

  return CHECKS.flatMap((check) =>
    check.look(level, context, measured).map((found) => ({
      rule: check.rule,
      severity: check.severity,
      weight: check.weight,
      ...found,
    })),
  )
}

/**
 * How bad a level is, all in: 0 is a level with nothing wrong with it.
 *
 * This is what lets the game pick the least-bad of a dozen tries instead of
 * giving up. Pass or fail on its own gives you no way to choose between twelve
 * failures, and between levels there is no time to keep rolling the dice.
 */
export function levelScore(findings: readonly Finding[]): number {
  return findings.reduce((total, finding) => total + finding.weight, 0)
}

// ===========================================================
//  THE BROKEN RULES — spec.md's "Never, in any generated level"
// ===========================================================

/** A coin that cannot be reached. The one that ends the feature if it ships. */
function unreachableCoins(_level: Level, _context: CheckContext, measured: LevelMeasurement) {
  return measured.coins
    .filter((coin) => !coin.reachable)
    .map((coin) => ({
      complaint: `The coin at ${at(coin)} cannot be got to from anywhere — you can see it, and you can never have it.`,
      where: { x: coin.x, y: coin.y },
    }))
}

/**
 * A hole wider than a triple jump with no way over it.
 *
 * Something has to cross it and be got on and off again: a ledge reaching from
 * within a jump of the near edge to within a jump of the far one. A ledge that
 * stands still is simply a bridge, and it is there whenever you arrive. A ledge
 * that SLIDES has one more thing to do — stay catchable long enough to be
 * caught by somebody who has never seen the level before, which is what
 * `FAIR_BOARDING_SECONDS` is about.
 */
function holesNothingCrosses(level: Level, context: CheckContext, measured: LevelMeasurement) {
  const oneJump = runFor(1, context.physics)
  const edge = (x: number) => ({ x, y: groundLineOf(measured) })
  const canHop = (from: Point, to: Point) =>
    hopCost(from, to, context.maxJumps, context.physics) <= 1

  return measured.gaps
    .filter((gap) => !gap.jumpable)
    .filter(
      (gap) =>
        !level.platforms.some((platform, index) => {
          const swept = sweptBox(platform, context.movingSpeed)

          // Does it cross the hole, and can he get on to it from the near
          // edge? Only getting ON is asked about: coming off the far end is a
          // drop, and a drop buys extra time in the air rather than costing it.
          if (swept.left > gap.left + oneJump || swept.right < gap.right - oneJump) return false
          if (!canHop(edge(gap.left), { x: swept.left, y: swept.top })) return false

          // No report means this deck is not going anywhere — either it never
          // moved, or `movingSpeed: 0` has frozen every ferry in the game — so
          // it is a bridge, and you can step on to it whenever you like.
          const ferry = measured.ferries.find((report) => report.platform === index)
          if (!ferry) return true

          return ferry.boardingWindowSeconds >= FAIR_BOARDING_SECONDS
        }),
    )
    .map((gap) => ({
      complaint: `The hole from ${Math.round(gap.left)} to ${Math.round(gap.right)} is ${Math.round(gap.width)} wide, and there is no ferry over it you could catch — the level stops there.`,
      where: { x: gap.left + gap.width / 2, y: context.world.height },
    }))
}

/**
 * A coin where he starts, which he collects before touching a key.
 *
 * Level 3 opened on "COINS 1/13" the first time for exactly this, and it looked
 * like the game had already been played. Anything closer than his own width is
 * his the moment the level appears.
 */
function coinsOnTheStart(level: Level, context: CheckContext) {
  return level.coins
    .filter((coin) => distance(coin, level.playerStart) <= context.playerWidth)
    .map((coin) => ({
      complaint: `The coin at ${at(coin)} is where he starts, so the level opens with one already collected.`,
      where: { x: coin.x, y: coin.y },
    }))
}

/**
 * A coin under one of the buttons a phone draws.
 *
 * On a computer this coin is fine. On a phone it is behind a thumb, and you
 * finish the level on 12 out of 13 with no idea which one you missed.
 */
function coinsUnderAButton(level: Level, context: CheckContext) {
  const found: Complaint[] = []

  for (const coin of level.coins) {
    for (const button of context.touchButtons) {
      if (!isOnButton(button, coin)) continue
      found.push({
        complaint: `The coin at ${at(coin)} hides under the ${button.label} button on a phone, behind a thumb.`,
        where: { x: coin.x, y: coin.y },
      })
    }
  }

  return found
}

/**
 * A ledge you cannot see, because a button is drawn over the whole of it.
 *
 * Only the ones swallowed WHOLE. The buttons are see-through and the ground
 * runs underneath them in every level in the game — that is fine, you can watch
 * him run right through one. What is not fine is a small ledge with a button
 * exactly on top of it: you have to land on a thing you cannot see, with your
 * thumb in the way. Level 3's lift passes behind the ▲ button and comes out the
 * other side, and that is fine too, which is why this asks about EVERYWHERE the
 * deck goes rather than where it happens to be parked.
 */
function ledgesUnderAButton(level: Level, context: CheckContext) {
  const found: Complaint[] = []

  for (const platform of level.platforms) {
    const swept = sweptBox(platform, context.movingSpeed)
    for (const button of context.touchButtons) {
      if (!boxInsideButton(swept, button)) continue
      found.push({
        complaint: `The ledge at ${at(platform)} is completely hidden under the ${button.label} button on a phone.`,
        where: { x: platform.x, y: platform.y },
      })
    }
  }

  return found
}

/** A ledge too narrow to stand on. Pip is 32 wide. */
function ledgesTooNarrow(level: Level, context: CheckContext) {
  return level.platforms
    .filter((platform) => platform.width < context.playerWidth)
    .map((platform) => ({
      complaint: `The ledge at ${at(platform)} is ${platform.width} wide and Pip is ${context.playerWidth} — there is nowhere to stand on it.`,
      where: { x: platform.x, y: platform.y },
    }))
}

/**
 * A sliding ledge over the spot he starts in.
 *
 * Straight from a comment in `level3.ts` that cost three attempts to earn: "a
 * platform you are standing under is a ceiling, not a lift". Park a ferry above
 * his head so he can ride from a standing start, and pressing jump just bonks
 * him on its underside — over and over, with no clue why.
 */
function ceilingsOverTheStart(level: Level, context: CheckContext) {
  const start = level.playerStart
  const half = context.playerWidth / 2
  const asHighAsHeGets = riseFor(context.maxJumps, context.physics)

  return level.platforms
    .filter((platform) => platform.moves !== undefined)
    .filter((platform) => {
      const swept = sweptBox(platform, context.movingSpeed)
      const overHim = swept.left <= start.x + half && swept.right >= start.x - half
      return overHim && swept.bottom <= start.y && swept.top >= start.y - asHighAsHeGets
    })
    .map((platform) => ({
      complaint: `The sliding ledge at ${at(platform)} hangs over his head where he starts, so jumping just bonks him on its underside.`,
      where: { x: platform.x, y: platform.y },
    }))
}

/**
 * Anything off the 960 × 540 screen, or below the death line.
 *
 * The screen runs out long before the death line does today, so in practice
 * this is the screen — but a ledge below the death line would be one you die on
 * the moment you land, which is worth catching if `deathDepth` ever moves.
 */
function thingsOffTheScreen(level: Level, context: CheckContext) {
  const { width, height } = context.world
  const bottom = Math.min(height, context.deathDepth)
  const found: Complaint[] = []

  for (const platform of level.platforms) {
    const swept = sweptBox(platform, context.movingSpeed)
    if (swept.left >= 0 && swept.right <= width && swept.top >= 0 && swept.bottom <= bottom)
      continue
    found.push({
      complaint: `The ledge at ${at(platform)} goes off the edge of the world, where nobody can get to it.`,
      where: { x: platform.x, y: platform.y },
    })
  }

  for (const coin of level.coins) {
    if (coin.x >= 0 && coin.x <= width && coin.y >= 0 && coin.y <= bottom) continue
    found.push({
      complaint: `The coin at ${at(coin)} is off the edge of the world, where nobody can get to it.`,
      where: { x: coin.x, y: coin.y },
    })
  }

  return found
}

/**
 * A coin buried inside a ledge, where he can never touch it.
 *
 * Only ledges that STAND STILL, because a coin in a slider's way is not buried
 * — the deck slides out from under it and you pick it up on the ride, which is
 * how three of level 3's coins work.
 */
function coinsInsideAPlatform(level: Level) {
  const found: Complaint[] = []

  for (const coin of level.coins) {
    for (const platform of level.platforms) {
      if (platform.moves !== undefined || !insideBox(coin, boxOf(platform))) continue
      found.push({
        complaint: `The coin at ${at(coin)} is buried inside the ledge at ${at(platform)}.`,
        where: { x: coin.x, y: coin.y },
      })
    }
  }

  return found
}

/**
 * Two platforms in the same place.
 *
 * Where each one STARTS, rather than everywhere it goes: two ferries can share
 * a lane happily as long as they are never there at the same moment, and level
 * 3's ferry and its lift do exactly that. A box round the whole of a trip would
 * call that a crash and it is not one.
 */
function platformsOverlapping(level: Level) {
  const found: Complaint[] = []

  for (let i = 0; i < level.platforms.length; i++) {
    for (let j = i + 1; j < level.platforms.length; j++) {
      const one = level.platforms[i] as Platform
      const other = level.platforms[j] as Platform
      if (!boxesOverlap(boxOf(one), boxOf(other))) continue
      found.push({
        complaint: `The ledges at ${at(one)} and ${at(other)} are standing in the same place as each other.`,
        where: { x: other.x, y: other.y },
      })
    }
  }

  return found
}

/** Nothing under him where he starts: the level begins by dropping him out of it. */
function nothingUnderTheStart(level: Level, context: CheckContext) {
  const start = level.playerStart
  const half = context.playerWidth / 2

  const caught = level.platforms.some((platform) => {
    const box = boxOf(platform)
    const under =
      box.top >= start.y && box.top <= Math.min(context.world.height, context.deathDepth)
    return under && box.left <= start.x + half && box.right >= start.x - half
  })

  if (caught) return []

  return [
    {
      complaint:
        'There is nothing under him where he starts, so the level begins by dropping him out of the world.',
      where: { x: start.x, y: start.y },
    },
  ]
}

// ===========================================================
//  THE DULL RULES — his two, and only his two
// ===========================================================

/**
 * "Coins all in a straight line."
 *
 * Two ways for that to be true, and he meant both: every coin at the same
 * height, so you run along the ground hoovering them up; or every coin evenly
 * spaced along one line, even a slanted one, so once you have found the rhythm
 * there is nothing left to work out. Either way the level is a corridor.
 *
 * "The same height" means inside a single jump of each other — if changing
 * height never needs a jump, it is not really a change of height.
 */
function coinsAllInARow(level: Level, context: CheckContext) {
  const coins = level.coins
  if (coins.length < 3) return []

  const heights = coins.map((coin) => coin.y)
  if (Math.max(...heights) - Math.min(...heights) < riseFor(1, context.physics)) {
    return [
      {
        complaint:
          'Every coin is at the same height, so you run along and hoover them up without thinking.',
      },
    ]
  }

  if (evenlySpacedAlongOneLine(coins)) {
    return [
      {
        complaint:
          'The coins are evenly spaced along one straight line, so once you find the rhythm there is nothing left to work out.',
      },
    ]
  }

  return []
}

/** Are these coins strung along one line, at one step each? */
function evenlySpacedAlongOneLine(coins: readonly Coin[]): boolean {
  const ends = [...coins].sort((a, b) => a.x - b.x || a.y - b.y)
  const first = ends[0] as Coin
  const last = ends[ends.length - 1] as Coin

  const length = distance(first, last)

  // How far along the line each coin is, and how far off it to the side.
  const along = (coin: Coin) =>
    ((coin.x - first.x) * (last.x - first.x) + (coin.y - first.y) * (last.y - first.y)) / length
  const aside = (coin: Coin) =>
    Math.abs((coin.x - first.x) * (last.y - first.y) - (coin.y - first.y) * (last.x - first.x)) /
    length

  if (coins.some((coin) => aside(coin) > LINE_TOLERANCE)) return false

  const steps: number[] = []
  const order = [...coins].sort((a, b) => along(a) - along(b))
  for (let i = 1; i < order.length; i++) {
    steps.push(along(order[i] as Coin) - along(order[i - 1] as Coin))
  }

  const usual = length / steps.length
  return steps.every((step) => Math.abs(step - usual) <= usual * EVEN_ENOUGH)
}

/**
 * "Never leaving the ground."
 *
 * If everything in the level is within two jumps of the lowest place there is
 * to stand, the third jump never gets used and the whole triple jump — the best
 * thing Pip can do — goes to waste. It is a level you walk.
 */
function neverLeavesTheGround(level: Level, context: CheckContext, measured: LevelMeasurement) {
  const highest = Math.min(...level.coins.map((coin) => coin.y))
  const climb = groundLineOf(measured) - highest

  if (climb > riseFor(context.maxJumps - 1, context.physics)) return []

  return [
    {
      complaint: `Nothing in the level is more than ${Math.round(climb)} above the ground, so the triple jump never gets used.`,
    },
  ]
}

// ===========================================================
//  BOXES AND OTHER SMALL SUMS
// ===========================================================

/** The bottom of the level: the lowest place in it there is to stand. */
function groundLineOf(measured: LevelMeasurement): number {
  return Math.max(...measured.standingAreas.map((area) => area.lowest))
}

/** A rectangle on the screen. `top` is the small y, because y counts down. */
interface Box {
  left: number
  right: number
  top: number
  bottom: number
}

/** Where a platform is right now, at the start of the level. */
function boxOf(platform: Platform): Box {
  return {
    left: platform.x - platform.width / 2,
    right: platform.x + platform.width / 2,
    top: platform.y - platform.height / 2,
    bottom: platform.y + platform.height / 2,
  }
}

/**
 * Everywhere a platform ever gets to, from `standingArea` in `levelMeasure.ts`
 * — so this agrees with the tape measure and with the game itself about where a
 * ferry goes, rather than doing the sums a third time.
 */
function sweptBox(platform: Platform, movingSpeed: number): Box {
  const deck = standingArea(platform, movingSpeed)
  return {
    left: deck.left,
    right: deck.right,
    top: deck.highest,
    bottom: deck.lowest + platform.height,
  }
}

/** Do these two rectangles share any space? Edges touching does not count. */
function boxesOverlap(one: Box, other: Box): boolean {
  return (
    one.left < other.right &&
    one.right > other.left &&
    one.top < other.bottom &&
    one.bottom > other.top
  )
}

function insideBox(point: Point, box: Box): boolean {
  return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom
}

/** Is every corner of this rectangle inside this round button? */
function boxInsideButton(box: Box, button: TouchButton): boolean {
  return [
    { x: box.left, y: box.top },
    { x: box.right, y: box.top },
    { x: box.left, y: box.bottom },
    { x: box.right, y: box.bottom },
  ].every((corner) => isOnButton(button, corner))
}

function distance(one: Point, other: Point): number {
  return Math.hypot(one.x - other.x, one.y - other.y)
}

/** "480, 520" — for reading out loud when something is wrong there. */
function at(thing: Point): string {
  return `${Math.round(thing.x)}, ${Math.round(thing.y)}`
}

// ===========================================================
//  CANDIDATE RULES — thought of, offered, NOT switched on
// ===========================================================
//
// Each of these was suggested and not picked, so each waits for somebody to
// actually be annoyed by a level before it costs every later level a re-roll.
// A dull rule is a guess about fun, and a wrong guess quietly makes every level
// after it worse. They are written down here so they are not thought of twice:
//
//   no spike          — every dial sitting on the trend: a level with no
//                       personality. Generation already spends its budget
//                       unevenly, so this may simply never fire.
//   same job twice    — this level being the same SHAPE as the one before.
//                       Better fixed when the level is built than by rejecting
//                       it afterwards: a check can only say no, while the
//                       builder can choose.
//   ferry you never need — a slider the route never touches. Scenery pretending
//                       to be a mechanic.
//   too front-loaded  — the last coin two hops from the start and the other
//                       eighteen crammed in before it.
