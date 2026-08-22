/**
 * Levels the game makes up for itself — pure sums, no Phaser, no browser.
 *
 * Levels 1, 2 and 3 are ours. Level 4 onwards is this file, and it never runs
 * out. Hand it a level number and it hands back exactly the same list of
 * platforms and coins that `src/levels/level1.ts` is written out by hand: there
 * is no second kind of level, and a generated one could be pasted into a file
 * and kept if it turned out to be good.
 *
 * Three ideas, and they are the whole thing:
 *
 * THE DICE COME FROM THE LEVEL NUMBER. Level 7 is the same level 7 on every
 * machine, today and next Saturday, forever — same ledges, same coins, same
 * name. That is what lets a best time mean something, and what lets somebody
 * say "try level 12, it's the one with the massive hole". Change `worldSeed`
 * and the whole ladder becomes a different ladder; change it back and the old
 * one returns exactly as it was.
 *
 * IT IS BUILT REACHABLE, NEVER SEARCHED. The builder pretends to be Pip. It
 * stands where he stands, and the next ledge only ever goes somewhere the sums
 * in `reach.ts` say he can really get to from there. So there is never a coin
 * you cannot have — not because a clever search proved it afterwards, but
 * because the route was walked while the level was being made.
 *
 * EACH LEVEL IS ABOUT ONE THING. Difficulty is a budget, and it is spent nearly
 * all on one dial — the level's JOB — while the others are refunded and made
 * KINDER than the trend. That is what our own three levels do: level 3 spends
 * everything on the floor and has the gentlest jumps in the game. A level that
 * is a bit harder at everything is the wallpaper level, and nobody remembers
 * it. The job is never the same two levels running.
 *
 * What it cannot do is be funny. Level 3 has a joke in it — a hole you cannot
 * jump, and the answer is to stand still and wait. This file makes competent
 * ground, not jokes, which is exactly why levels 1 to 3 stay hand-made.
 *
 * See `docs/adr/20260822-random-endless-levels/` — `README.md` for why, and
 * `plan.md` §4 and §5 for the dials and the six steps below.
 *
 * Remember y counts DOWNWARDS: higher up the screen is a SMALLER y.
 */

import type { Coin, Level, Platform } from '../levels'
import { type CheckContext, checkLevel, levelScore } from './levelCheck'
import { measureLevel } from './levelMeasure'
import { type PlatformMotion, platformPosition } from './movingPlatform'
import { hopCost, type JumpPhysics, riseFor, runFor } from './reach'
import { isOnButton, type TouchButton } from './touchControls'

/** Everything the builder needs to know about the game it is building for. */
export interface GenerateOptions extends CheckContext {
  /**
   * Change this and every level past 3 becomes a different level — a whole new
   * ladder. Change it back and the old one returns, exactly as it was.
   */
  worldSeed: number

  /** How fast the ladder gets mean. Bigger = a gentler climb. */
  ramp?: number
}

/**
 * The seven things a level can be hard AT.
 *
 * They are not a wish list, they are what `levelMeasure.ts` can measure about
 * a level that has been built, so every one of them can be checked afterwards
 * rather than merely intended.
 */
export type DialName =
  | 'hardestHop'
  | 'narrowestLedge'
  | 'boardingWindow'
  | 'movers'
  | 'floorSolid'
  | 'coins'
  | 'routeDepth'

/** What each dial is set to for one particular level. */
export type Dials = Record<DialName, number>

/** One try at a level, with the workings kept so the tests can read them. */
export interface Draft {
  /** The level itself: the same plain data a hand-made level file exports. */
  level: Level

  /** How hard this level number is meant to be, from 0 to nearly 1. */
  difficulty: number

  /** The one dial this level spends its budget on — what it is ABOUT. */
  job: DialName

  /** How much of the budget each dial got. The job's is about twice the rest. */
  weights: Dials

  /** How far along its own gentle→limit run each dial ended up, 0 to 1. */
  shares: Dials

  /** What each dial actually came out as, in the units of that dial. */
  dials: Dials

  /** How far each hop of the route carries him, in pixels. */
  hops: number[]
}

/**
 * Where each dial starts out and where it stops meaning "harder".
 *
 * `gentle` is a kind level; `limit` is as far as the dial can go before it
 * stops being difficulty and starts being either impossible or silly. The ones
 * anchored to a measured hand-made level are marked; see `plan.md` §4.4.
 */
const RANGES: Record<DialName, { gentle: number; limit: number }> = {
  /** How much of a full triple jump the meanest hop asks for. Level 1 asks .36. */
  hardestHop: { gentle: 0.3, limit: 0.6 },

  /** How wide the smallest ledge is. Pip is 32 wide; below about 90 it is a dare. */
  narrowestLedge: { gentle: 160, limit: 90 },

  /** How long you get to catch a ferry, in seconds. Level 3's kindest is 1.8. */
  boardingWindow: { gentle: 1.8, limit: 0.7 },

  /** How many ledges slide about. Level 3 has three. */
  movers: { gentle: 0, limit: 6 },

  /** How much of the bottom of the screen is ground. Level 3 keeps under half. */
  floorSolid: { gentle: 1, limit: 0.3 },

  /** How many coins there are to collect. Level 3 has thirteen. */
  coins: { gentle: 8, limit: 24 },

  /** How many ledges the climb is made of. */
  routeDepth: { gentle: 4, limit: 12 },
}

const DIAL_NAMES = Object.keys(RANGES) as DialName[]

/**
 * How the budget is shared out, from the level's job down to the kindest dial.
 *
 * The job gets about double, one other dial gets a bit over its share, and the
 * remaining five are REFUNDED — deliberately below the trend, so the level is
 * noticeably kind everywhere except the one place it is mean. That refund is
 * what makes the spike readable: level 3 is remembered as "the ferry one"
 * because its jumps are easier than level 1's, not in spite of it.
 */
const SPIKE = [2, 1.2, 0.7, 0.6, 0.55, 0.5, 0.4]

/** How much the dice are allowed to wobble one dial's share of the budget. */
const WOBBLE = { low: 0.75, high: 1.25 }

/** Level 4 is a breather after the ferry level, not a collapse back to level 1. */
const BASE_DIFFICULTY = 0.28

/** How fast the ladder gets mean. Bigger = a gentler climb. */
const DEFAULT_RAMP = 8

/** The last level a person made. Everything past this one is built here. */
const HANDMADE_LEVELS = 3

/** How many goes the builder gets at a level before it plays the best one. */
const ATTEMPTS = 12

/** A stream of dice all of its own, so which job a level has never re-rolls. */
const JOB_STREAM = 977

const GROUND_HEIGHT = 40
const LEDGE_HEIGHT = 24
const PLAYER_START = { x: 80, y: 400 }

/** The ground he lands on at the start. Wide enough to land on and turn round. */
const START_GROUND = 160

/** Any other piece of ground. Somewhere to stand, not just somewhere to bounce. */
const MIN_GROUND = 90

/**
 * Smaller than this and a hole is not a hole, it is a crack in the pavement.
 *
 * One jump carries him about 190, so 120 is a hole he really does have to jump
 * rather than one he steps over without noticing. A level whose whole share of
 * missing floor comes to less than this keeps its floor in one piece, the way
 * level 1 does.
 */
const MIN_HOLE = 120

/** Nothing goes above this, so there is always room for a coin over it. */
const SKY_MARGIN = 70

/** How far a ledge keeps clear of the floor, so the two do not look welded. */
const FLOOR_CLEARANCE = 30

/** Breathing room between any two platforms. */
const ELBOW_ROOM = 14

/** How close to the edge of the screen anything is allowed to get. */
const SCREEN_MARGIN = 4

/** How high a coin floats above the thing you stand on to get it. */
const COIN_LIFT = 40

/** How far apart two coins have to be so they read as two coins. */
const COIN_SPACING = 40

/** How wide a piece of ledge one coin wants to itself. */
const COIN_ELBOW = 60

/** How many goes the walk gets at one ledge before it stops early. */
const TRIES = 12

/** How high the whole climb goes, from the ground up. */
const CLIMB = { least: 260, most: 400 }

/** A trip that takes less than this is a blur; more than this is a nap. */
const TRIP_SECONDS = { least: 1.5, most: 8 }

/**
 * How long a chance to board a ferry has to last, in seconds.
 *
 * `crossing` is for the one kind of ferry that is the ONLY way over a hole:
 * miss it and the level stops, so it is held well clear of the one second
 * `levelCheck.ts` calls fair. `least` is for every other slider, where missing
 * it just means waiting for it to come round again.
 */
const WINDOW = { crossing: 1.6, least: 0.6 }

/** How far past the end of the ground a ferry parks. Level 3's parks five past. */
const FERRY_NUDGE = 5

/** How far past the far edge a ferry carries him, so he walks off rather than jumps. */
const FERRY_OVERSHOOT = 40

/** A hole narrower than this has no room for a ferry to park AND still travel. */
const FERRY_HOLE = 200

/** The highest a ferry's deck sits above the ground it is boarded from. */
const FERRY_RISE = 110

/** Numbers between 0 and 1 that look scattered but are the same every time. */
interface Dice {
  next(): number
  between(low: number, high: number): number
  whole(low: number, high: number): number
  pick<T>(list: readonly T[]): T
}

/**
 * The same four lines of dice that scatter the stars in `starfield.ts`.
 *
 * Copied rather than shared on purpose: `starfield.ts` works, and four
 * duplicated lines are cheaper than reaching into a file that is not broken.
 * The first two numbers are thrown away because the very first thing this kind
 * of dice says is a bit too close to the seed it was handed.
 */
function diceFor(seed: number): Dice {
  let value = seed >>> 0
  const next = () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }

  next()
  next()

  return {
    next,
    between: (low, high) => low + next() * (high - low),
    whole: (low, high) => low + Math.floor(next() * (high - low + 1)),
    pick: <T>(list: readonly T[]) => list[Math.floor(next() * list.length)] as T,
  }
}

/**
 * The one seed everything about a level comes from: which world, which level,
 * and which of the twelve tries this is.
 *
 * The three are stirred with big odd numbers so that neighbouring levels are
 * nowhere near each other in dice-land — otherwise level 8 would come out
 * looking like a slightly nudged level 7.
 */
function seedFor(worldSeed: number, levelNumber: number, attempt: number): number {
  return (
    (Math.imul(worldSeed, 2654435761) +
      Math.imul(levelNumber, 2246822519) +
      Math.imul(attempt, 3266489917)) >>>
    0
  )
}

/**
 * How hard level `n` is meant to be, from a breather at level 4 up towards 1
 * and never quite getting there.
 *
 * Our own three levels measure 0.07, 0.19 and 0.39, so the ladder starts just
 * below where level 3 left off — one beat of relief after the win screen — and
 * climbs forever. It never stops climbing and it never reaches 1: the steps
 * simply get smaller, because past a point "harder" would mean "impossible",
 * and a level nobody can finish is not difficulty, it is a bug.
 */
export function difficultyFor(levelNumber: number, ramp: number = DEFAULT_RAMP): number {
  const past = Math.max(0, levelNumber - HANDMADE_LEVELS)
  return BASE_DIFFICULTY + (1 - BASE_DIFFICULTY) * (1 - 1 / (1 + past / ramp))
}

/**
 * What this level is ABOUT — the one dial it spends its budget on.
 *
 * Each level's job is one step on from the level before it, and the size of
 * the step comes from the dice. That is the whole trick: a step is never zero,
 * so a level is never about the same thing as the level you just played, and
 * nobody has to remember anything to make that true.
 *
 * It is drawn from the level number alone and not from which of the twelve
 * tries this is, so re-rolling a level for being boring never changes what it
 * is about — and "level 12 is the ferry one" survives adding a new rule.
 */
function jobFor(levelNumber: number, worldSeed: number): DialName {
  const start = diceFor(seedFor(worldSeed, 0, JOB_STREAM)).whole(0, DIAL_NAMES.length - 1)
  let index = start

  for (let number = HANDMADE_LEVELS + 1; number <= levelNumber; number++) {
    const step = diceFor(seedFor(worldSeed, number, JOB_STREAM)).whole(1, DIAL_NAMES.length - 1)
    index = (index + step) % DIAL_NAMES.length
  }

  return DIAL_NAMES[index] as DialName
}

/**
 * How much of the budget each dial gets: about double for the job, a little
 * over for one runner-up, and a refund for the other five.
 *
 * The dice decide the pecking order below the job and wobble every rung of it,
 * so two levels with the same job still spend their budget differently.
 */
function weightsFor(dice: Dice, job: DialName): Dials {
  const drawn = new Map<DialName, number>()
  for (const name of DIAL_NAMES) drawn.set(name, dice.between(WOBBLE.low, WOBBLE.high))

  const average = [...drawn.values()].reduce((sum, value) => sum + value, 0) / DIAL_NAMES.length
  for (const [name, value] of drawn) drawn.set(name, value / average)

  const rest = DIAL_NAMES.filter((name) => name !== job)
  rest.sort((one, other) => (drawn.get(other) as number) - (drawn.get(one) as number))

  const weights = {} as Dials
  for (const [rank, name] of [job, ...rest].entries()) {
    weights[name] = (SPIKE[rank] as number) * (drawn.get(name) as number)
  }

  return weights
}

/**
 * Build a level and hand back the workings as well as the level.
 *
 * `attempt` is which of the twelve tries this is — see `generateLevel` below,
 * which throws away the boring ones.
 */
export function draftLevel(levelNumber: number, attempt: number, options: GenerateOptions): Draft {
  const dice = diceFor(seedFor(options.worldSeed, levelNumber, attempt))
  const difficulty = difficultyFor(levelNumber, options.ramp)
  const job = jobFor(levelNumber, options.worldSeed)
  const weights = weightsFor(dice, job)

  const shares = {} as Dials
  const dials = {} as Dials
  for (const name of DIAL_NAMES) {
    const share = Math.min(1, Math.max(0, difficulty * weights[name]))
    const { gentle, limit } = RANGES[name]
    shares[name] = share
    dials[name] = gentle + (limit - gentle) * share
  }

  const name = `${dice.pick(FIRST_WORDS)} ${dice.pick(JOB_WORDS[job])}`
  const site = layTheLevel(name, dice, dials, options)

  return {
    level: site.level,
    difficulty,
    job,
    weights,
    shares,
    dials,
    hops: site.hops,
  }
}

/**
 * The level the game actually hands the player.
 *
 * Twelve goes, all drawn from the same seed with the try number stirred in, so
 * the ones thrown away are as fixed as the one that is kept. The first clean
 * one wins; if all twelve have something wrong with them, the least-bad one is
 * played anyway. It is bounded because "keep rolling until it is perfect" is
 * how a game freezes for eight seconds on a phone between levels, and it
 * cannot fail because there always has to be a next level to hand somebody.
 */
export function generateLevel(levelNumber: number, options: GenerateOptions): Level {
  let best = draftLevel(levelNumber, 0, options).level
  let complaints = levelScore(checkLevel(best, options))

  for (let attempt = 1; complaints > 0 && attempt < ATTEMPTS; attempt++) {
    const tried = draftLevel(levelNumber, attempt, options).level
    const score = levelScore(checkLevel(tried, options))
    if (score >= complaints) continue
    best = tried
    complaints = score
  }

  return best
}

// ===========================================================
//  BUILDING ONE LEVEL, IN THE ORDER THE PIECES DEPEND ON EACH OTHER
// ===========================================================

/** Somewhere he can stand: how wide it is, and how high its top is. */
interface Ledge {
  left: number
  right: number
  top: number
}

/** A rectangle on the screen. `top` is the small y, because y counts down. */
interface Box {
  left: number
  right: number
  top: number
  bottom: number
}

/** A hole in the floor, and what you are meant to do about it. */
interface Hole {
  left: number
  right: number
  crossing: 'jump' | 'bridge' | 'ferry'
}

/** The level being built, and everything the tests want to know about it. */
interface Site {
  level: Level
  hops: number[]
}

/**
 * The six steps, in the order they depend on each other (`plan.md` §4.4).
 *
 * The order is not tidiness. The floor cannot be laid until it is known
 * whether there is a ferry to spend on a hole, because a hole wider than a
 * triple jump is only allowed to exist if something crosses it. The coins
 * cannot go anywhere until there is somewhere to stand under them.
 */
function layTheLevel(name: string, dice: Dice, dials: Dials, options: GenerateOptions): Site {
  const groundTop = options.world.height - GROUND_HEIGHT

  // b. The mover budget comes first: the floor's legality leans on it. With
  //    every ferry frozen by `movingSpeed: 0` there are no movers to spend.
  const movers = options.movingSpeed > 0 ? Math.round(dials.movers) : 0

  // c and d. The floor, and whatever crosses the holes in it.
  const floor = planTheFloor(dice, dials, options, movers)
  const platforms: Platform[] = floor.pieces.map((piece) => ({
    x: (piece.left + piece.right) / 2,
    y: groundTop + GROUND_HEIGHT / 2,
    width: piece.right - piece.left,
    height: GROUND_HEIGHT,
  }))

  const crossings = new Set<Platform>()
  for (const hole of floor.holes) {
    if (hole.crossing === 'bridge') platforms.push(bridgeOver(hole, dice, dials, options))
    if (hole.crossing !== 'ferry') continue
    const ferry = ferryOver(hole, dice, dials, options)
    platforms.push(ferry)
    crossings.add(ferry)
  }

  // e. The route: stand where he stands, and only ever put the next ledge
  //    somewhere he can really get to from there.
  const start = floor.pieces[0] as Ledge
  const route = walkTheRoute({ left: start.left, right: start.right, top: groundTop }, platforms, {
    dice,
    dials,
    options,
  })

  // f. Turn some of those ledges into ledges that slide.
  makeMovers(route, platforms, { dice, dials, options }, movers - crossings.size)

  // g. Hang the coins on everything there is to stand on.
  const level: Level = {
    name,
    playerStart: { ...PLAYER_START },
    platforms,
    coins: hangCoins(platforms, dice, dials, options),
  }

  // h. Measure what was built, and slow down any ferry that turned out to be
  //    harder to catch than it was meant to be.
  tuneTheFerries(level, crossings, dials, options)

  return { level, hops: route.map((step) => step.hop) }
}

/**
 * Time every ferry's trip by the real tape measure, not by the plan.
 *
 * Each ferry was already given a trip time worked out from where its deck will
 * be — but that sum assumes he jumps from the ledge the builder had in mind,
 * and `levelMeasure.ts` walks the whole level and may well find a kinder place
 * to jump from, further away, where the same ferry is harder to catch.
 *
 * The fix is exact rather than a guess, which is why it can be done once and
 * trusted: how long the chance lasts is simply the trip time times the slice of
 * the trip the deck spends within reach, and slowing the trip down does not
 * move anything. So the trip time it should have had is the one it has now,
 * scaled by how far out the answer came.
 *
 * A ferry that is the only way over a hole is held to the longest window of the
 * lot: miss that one and the level stops.
 */
function tuneTheFerries(
  level: Level,
  crossings: ReadonlySet<Platform>,
  dials: Dials,
  options: GenerateOptions,
): void {
  if (options.movingSpeed <= 0) return

  for (const report of measureLevel(level, options).ferries) {
    const platform = level.platforms[report.platform] as Platform
    const moves = platform.moves as PlatformMotion
    const wanted = Math.max(
      dials.boardingWindow,
      crossings.has(platform) ? WINDOW.crossing : WINDOW.least,
    )

    // A ferry nothing can catch at all comes back as a window of zero, and
    // dividing by it asks for an infinitely slow trip — which is then held to
    // the longest trip there is, exactly as it should be.
    const seconds = moves.seconds * (wanted / report.boardingWindowSeconds)
    const settled = Math.min(TRIP_SECONDS.most, Math.max(TRIP_SECONDS.least, seconds))
    platform.moves = { ...moves, seconds: Math.round(settled * 100) / 100 }
  }
}

/**
 * How far sideways one hop of this price can carry him while it also climbs
 * this much.
 *
 * The same sum `hopCost` in `reach.ts` does, turned round: it prices a hop,
 * this one asks how big a hop that price buys. Climbing eats the budget first
 * — a hop that goes nearly as high as it can has almost nothing left over to
 * travel with, which is exactly how it feels in the hand.
 */
function acrossFor(climb: number, jumps: number, cost: number, physics: JumpPhysics): number {
  const rise = riseFor(jumps, physics)
  if (climb > rise * cost) return 0

  const falling = Math.sqrt((2 * Math.max(0, rise - climb)) / physics.gravity)
  const airtime = (physics.jumpVelocity / physics.gravity) * jumps + falling
  return cost * physics.speed * airtime
}

/**
 * The floor: how much ground there is, where the holes in it are, and what
 * each hole expects you to do about it.
 *
 * Three kinds of hole, and the taxonomy is copied straight off our own levels:
 * one you JUMP (level 1 has none), one BRIDGED by a ledge standing in it
 * (level 2's 360-wide one), and one only a FERRY crosses (level 3's 500-wide
 * one). Only the last kind is allowed to be wider than a triple jump, and only
 * when a mover is really spent on it — otherwise the level stops there.
 */
function planTheFloor(
  dice: Dice,
  dials: Dials,
  options: GenerateOptions,
  ferries: number,
): { pieces: Ledge[]; holes: Hole[] } {
  const { width, height } = options.world
  const groundTop = height - GROUND_HEIGHT
  const jumpable = acrossFor(0, options.maxJumps, dials.hardestHop, options.physics)
  const bridgeable = bridgeSpan(dials, options)

  const wanted = Math.max(0, (1 - dials.floorSolid) * width)

  // Can this level make a ferry at all? With a jump this feeble there is no
  // height to park a deck at, and with every ferry frozen there is no ferry.
  const ferryable = ferries > 0 && ferryRise(dials, options) >= LEDGE_HEIGHT + ELBOW_ROOM

  // The widest one hole is allowed to be: a ferry crosses almost anything, a
  // bridge only reaches so far, and without either it has to be jumped.
  const widest = ferryable ? width : Math.max(jumpable, bridgeable)

  // A hole nothing can get over is not a hole, it is the end of the level, so
  // a level with no way of crossing anything simply keeps its floor.
  if (wanted < MIN_HOLE || widest < MIN_HOLE) {
    return { pieces: [{ left: 0, right: width, top: groundTop }], holes: [] }
  }

  const fits = (pieces: number) => width - START_GROUND - pieces * MIN_GROUND >= wanted
  let count = dice.whole(1, 4)
  // Not so many pieces of ground that there is no room left for the hole.
  while (count > 1 && !fits(count)) count--
  // Not so few that one hole would be wider than anything we have to cross it.
  while (count < 4 && wanted / count > widest && fits(count + 1)) count++
  // And never more holes than there is missing floor to make them out of, or
  // the last piece of ground gets eaten to pay for them.
  while (count > 1 && count * MIN_HOLE > wanted) count--

  const room = width - START_GROUND - count * MIN_GROUND
  const widths = shareOut(dice, Math.min(wanted, room), count, MIN_HOLE)

  let ferriesLeft = ferries
  const crossings = widths.map((hole, index): Hole['crossing'] => {
    if (hole <= jumpable) return 'jump'
    if (
      ferriesLeft > 0 &&
      ferryable &&
      hole >= FERRY_HOLE &&
      (hole > bridgeable || dice.next() < 0.4)
    ) {
      ferriesLeft--
      return 'ferry'
    }
    if (hole <= bridgeable) return 'bridge'

    // Nothing here crosses a hole this wide, so it stops being one: it shrinks
    // to the widest hole this level really does have an answer to.
    widths[index] = Math.max(jumpable, bridgeable)
    return bridgeable > jumpable ? 'bridge' : 'jump'
  })

  const solid = width - widths.reduce((total, hole) => total + hole, 0)
  const ground = shareOut(dice, solid - START_GROUND + MIN_GROUND, count + 1, MIN_GROUND)
  ground[0] = (ground[0] as number) + START_GROUND - MIN_GROUND

  const pieces: Ledge[] = []
  const holes: Hole[] = []
  let edge = 0

  for (const [index, piece] of ground.entries()) {
    const right = index === count ? width : Math.round(edge + piece)
    pieces.push({ left: edge, right, top: groundTop })
    edge = right
    if (index === count) break
    const hole = Math.round(widths[index] as number)
    holes.push({ left: edge, right: edge + hole, crossing: crossings[index] as Hole['crossing'] })
    edge += hole
  }

  return { pieces, holes }
}

/** How wide a hole one still ledge standing in it can bridge. */
function bridgeSpan(dials: Dials, options: GenerateOptions): number {
  const side = bridgeSide(dials, options)
  return side <= ELBOW_ROOM ? 0 : 2 * side + bridgeWidth(dials)
}

function bridgeWidth(dials: Dials): number {
  return Math.round(dials.narrowestLedge + 20)
}

/**
 * How high a bridge stands above the floor of the hole it is in.
 *
 * High enough to be clear of the ground either side of it, and no dearer to
 * jump on to than this level is willing to ask for. If those two want opposite
 * things — which happens when the jump in `tuning.ts` is turned right down —
 * the height wins and `bridgeSide` comes back as nothing, so nothing is
 * bridged and the holes are made small enough to jump instead.
 */
function bridgeRise(dials: Dials, options: GenerateOptions): number {
  const asked = Math.min(100, dials.hardestHop * riseFor(options.maxJumps, options.physics) * 0.6)
  return Math.max(asked, LEDGE_HEIGHT + ELBOW_ROOM)
}

/**
 * How far out from the edge of the hole a bridge is allowed to start.
 *
 * Two rules at once, and the tighter of them wins: it has to be a hop this
 * level is willing to ask for, and it has to be inside ONE jump, because the
 * checker will not call a bridge a way across unless a single jump reaches it.
 */
function bridgeSide(dials: Dials, options: GenerateOptions): number {
  return Math.min(
    acrossFor(bridgeRise(dials, options), options.maxJumps, dials.hardestHop, options.physics),
    runFor(1, options.physics),
  )
}

/** A ledge standing in the middle of a hole, so the hole has a middle. */
function bridgeOver(hole: Hole, dice: Dice, dials: Dials, options: GenerateOptions): Platform {
  const width = Math.min(bridgeWidth(dials), hole.right - hole.left - 2 * ELBOW_ROOM)
  const rise = bridgeRise(dials, options)
  const groundTop = options.world.height - GROUND_HEIGHT

  return {
    x: Math.round((hole.left + hole.right) / 2 + dice.between(-8, 8)),
    y: Math.round(groundTop - rise + LEDGE_HEIGHT / 2),
    width: Math.round(width),
    height: LEDGE_HEIGHT,
  }
}

/**
 * A ferry across a hole nothing else crosses — level 3's whole idea.
 *
 * It waits at the near end, five pixels past where the ground stops, because
 * level 3 learned both wrong answers the hard way: parked out in the middle
 * there is a blink of a chance in every trip and you have to already know it is
 * coming, and parked over the ground it sits directly above his head, where
 * jumping just bonks him on its underside. A platform you are standing under is
 * a ceiling, not a lift.
 *
 * How long the trip takes is then worked backwards from how long a chance to
 * board it should last — the window is *computed*, never assumed, because
 * getting one ferry's parking spot right by eye took three goes.
 */
function ferryOver(hole: Hole, dice: Dice, dials: Dials, options: GenerateOptions): Platform {
  const groundTop = options.world.height - GROUND_HEIGHT

  // Narrow enough that there is a real trip left over once it has parked at
  // the near end. A hole only gets a ferry if it is wide enough for both.
  const room = hole.right - hole.left + FERRY_OVERSHOOT - FERRY_NUDGE - MIN_HOLE
  const deck = Math.round(Math.min(dials.narrowestLedge + dice.between(20, 60), room))

  const top = groundTop - ferryRise(dials, options)
  const home = hole.left + FERRY_NUDGE + deck / 2
  const moveX = Math.round(hole.right + FERRY_OVERSHOOT - (home + deck / 2))

  const ferry: Platform = {
    x: Math.round(home),
    y: Math.round(top + LEDGE_HEIGHT / 2),
    width: deck,
    height: LEDGE_HEIGHT,
    moves: { moveX, seconds: 1 },
  }

  const bank = { left: 0, right: hole.left, top: groundTop }
  const wanted = Math.max(dials.boardingWindow, WINDOW.crossing)
  ferry.moves = { moveX, seconds: tripSecondsFor(ferry, bank, wanted, options) }
  return ferry
}

/**
 * How high a ferry's deck sits above the ground it is boarded from.
 *
 * Low enough to be a ONE-jump board — level 3's note says every hop on and off
 * a mover there is kept well inside one jump, because the level is already
 * asking you to time it as well as aim it — and never a dearer hop than this
 * level asks for anywhere else.
 */
function ferryRise(dials: Dials, options: GenerateOptions): number {
  return Math.min(
    FERRY_RISE,
    riseFor(1, options.physics) * 0.8,
    dials.hardestHop * riseFor(options.maxJumps, options.physics) * 0.9,
  )
}

/**
 * How far along its trip a deck can get and still be caught in ONE jump from
 * the place you are standing when you jump.
 *
 * Every generated ferry is boardable in a single jump on purpose — level 3's
 * own note says every hop on and off a mover there is kept well inside one
 * jump, because the level is already asking you to time it as well as aim it.
 * It also means this agrees with the tape measure, which always tries one jump
 * first.
 *
 * Where the deck is comes from the game's own `platformPosition`, so this is
 * where the deck really will be and not an idea of where it ought to be.
 */
function catchableFraction(deck: Platform, from: Ledge, options: GenerateOptions): number {
  const moves = deck.moves as PlatformMotion

  const canCatch = (along: number) => {
    const where = platformPosition(deck, along * moves.seconds * 1000)
    const across = Math.max(
      0,
      from.left - (where.x + deck.width / 2),
      where.x - deck.width / 2 - from.right,
    )
    const target = { x: across, y: where.y - deck.height / 2 }
    return hopCost({ x: 0, y: from.top }, target, 1, options.physics) <= 1
  }

  if (!canCatch(0)) return 0
  if (canCatch(1)) return 1

  // It gets further away the whole way out, so there is one place it stops
  // being catchable and this finds it.
  let caught = 0
  let gone = 1
  for (let halving = 0; halving < 20; halving++) {
    const middle = (caught + gone) / 2
    if (canCatch(middle)) caught = middle
    else gone = middle
  }

  return caught
}

/**
 * How long one there-and-back has to take for the chance to board it to last
 * as long as this level wants.
 *
 * The deck is catchable for the same slice of every trip, out and back, so a
 * slower trip is a longer chance — that is the whole of the timing dial, and
 * it is the one dial that can keep getting harder forever.
 */
function tripSecondsFor(
  deck: Platform,
  from: Ledge,
  wanted: number,
  options: GenerateOptions,
): number {
  const caught = catchableFraction(deck, from, options)
  if (caught <= 0) return TRIP_SECONDS.most

  const speed = Math.max(options.movingSpeed, 0.01)
  const seconds = (wanted * speed) / (2 * caught)
  return Math.round(Math.min(TRIP_SECONDS.most, Math.max(TRIP_SECONDS.least, seconds)) * 100) / 100
}

/** How long the chance to board this deck really lasts, once the trip is set. */
function windowSecondsFor(
  deck: Platform,
  from: Ledge,
  seconds: number,
  options: GenerateOptions,
): number {
  const speed = Math.max(options.movingSpeed, 0.01)
  return (2 * catchableFraction(deck, from, options) * seconds) / speed
}

/** Hand out `total` between `parts` of them, none smaller than `minimum`. */
function shareOut(dice: Dice, total: number, parts: number, minimum: number): number[] {
  const spare = Math.max(0, total - parts * minimum)
  const weights = Array.from({ length: parts }, () => dice.next() + 0.25)
  const sum = weights.reduce((running, weight) => running + weight, 0)
  return weights.map((weight) => minimum + (spare * weight) / sum)
}

// ===========================================================
//  THE ROUTE — the part that makes the level finishable
// ===========================================================

/** One rung of the climb: the ledge, and where he jumped from to reach it. */
interface Step {
  platform: Platform
  from: Ledge
  hop: number
}

interface Workshop {
  dice: Dice
  dials: Dials
  options: GenerateOptions
}

/**
 * Walk the route, standing where Pip stands.
 *
 * This is the promise the whole feature rests on. Every ledge goes somewhere
 * `hopCost` says he can really get to from the last one, at a price this level
 * has decided it is willing to ask for. Nothing is scattered and then checked;
 * the route is there because it was walked.
 *
 * The climb is aimed at a height chosen up front, so the level always goes far
 * enough up to need the triple jump — a level you can walk is one of the two
 * things the nine-year-old who designs this game called boring.
 *
 * If a ledge simply will not fit — off the screen, on top of something else,
 * swallowed by a phone button — it shrinks the hop and tries again, and after
 * a dozen goes it stops climbing and the level is however tall it got. Short
 * is fine. Stuck is not: there is no loop here that can fail to finish.
 */
function walkTheRoute(start: Ledge, platforms: Platform[], shop: Workshop): Step[] {
  const { dice, dials, options } = shop
  const groundTop = options.world.height - GROUND_HEIGHT
  const depth = Math.round(dials.routeDepth)
  const roof = Math.max(SKY_MARGIN, groundTop - dice.between(CLIMB.least, CLIMB.most))

  const route: Step[] = []
  let from = start

  for (let rung = 0; rung < depth; rung++) {
    // Head for whichever side of him has more screen left on it, so the climb
    // zigzags up the level instead of running out of room against one wall.
    const heading = options.world.width - from.right >= from.left ? 1 : -1
    const step = nextRung(from, roof, depth - rung, heading, platforms, shop)
    if (!step) break

    platforms.push(step.platform)
    route.push(step)
    from = deckOf(step.platform)
  }

  return route
}

/** The top of a platform, as somewhere to stand. */
function deckOf(platform: Platform): Ledge {
  return {
    left: platform.x - platform.width / 2,
    right: platform.x + platform.width / 2,
    top: platform.y - platform.height / 2,
  }
}

/**
 * One more ledge, within one hop of the last one.
 *
 * A dozen goes, each a little less ambitious than the last, heading the other
 * way every other try, and reaching for the whole climb every third one. Then
 * it gives up rather than looping forever: a level that is shorter than it
 * meant to be is a fine level, and a builder that never finishes is not.
 */
function nextRung(
  from: Ledge,
  roof: number,
  rungsLeft: number,
  heading: number,
  placed: Platform[],
  shop: Workshop,
): Step | undefined {
  const { dice, dials, options } = shop
  const cost = dials.hardestHop
  const ceiling = cost * riseFor(options.maxJumps, options.physics)

  // The band a ledge is allowed to sit in: never so high there is no room for
  // a coin over it, never so low it looks welded to the floor.
  const groundTop = options.world.height - GROUND_HEIGHT
  const lowest = groundTop - FLOOR_CLEARANCE - LEDGE_HEIGHT

  for (let go = 0; go < TRIES; go++) {
    const shrink = 1 - go / TRIES
    const width = Math.round(dice.between(dials.narrowestLedge, dials.narrowestLedge + 70))

    // How high this rung goes, kept inside the level's own ceiling and always
    // clear of the floor, so a ledge never ends up welded to the ground.
    //
    // Every third go reaches for the whole climb this level can afford rather
    // than the share of it this rung is due. That is what gets the route over
    // a ferry sliding across the middle of the screen: without it, every try
    // is a SMALLER hop than the last one, and a small hop is exactly the one
    // that lands in the ferry's lane.
    const share = ((from.top - roof) / rungsLeft) * dice.between(0.7, 1.3) * shrink
    const asked = Math.min(ceiling * 0.95, go % 3 === 2 ? ceiling * 0.95 : share)
    const top = Math.round(Math.min(lowest, Math.max(SKY_MARGIN, from.top - asked)))
    const climb = from.top - top

    // How far sideways that leaves him, and where along the screen it can go.
    const reach = acrossFor(Math.max(0, climb), options.maxJumps, cost, options.physics)
    const spread = Math.max(
      climb >= LEDGE_HEIGHT + ELBOW_ROOM ? 0 : ELBOW_ROOM * 2,
      reach * dice.between(0.4, 1) * shrink,
    )

    const way = go % 2 === 0 ? heading : -heading
    const aim = way > 0 ? from.right + spread : from.left - spread - width
    const nearest = Math.max(SCREEN_MARGIN, from.left - reach - width)
    const furthest = Math.min(options.world.width - SCREEN_MARGIN - width, from.right + reach)
    const left = Math.min(furthest, Math.max(nearest, aim + dice.between(-40, 40)))

    const platform: Platform = {
      x: Math.round(left + width / 2),
      y: top + LEDGE_HEIGHT / 2,
      width,
      height: LEDGE_HEIGHT,
    }

    const deck = deckOf(platform)
    const reallyAcross = Math.max(0, from.left - deck.right, deck.left - from.right)
    const price = hopCost(
      { x: 0, y: from.top },
      { x: reallyAcross, y: deck.top },
      options.maxJumps,
      options.physics,
    )

    if (price > cost) continue
    if (!thereIsRoom(boxOf(platform), placed, options)) continue

    return { platform, from, hop: Math.hypot(reallyAcross, from.top - deck.top) }
  }

  return undefined
}

/**
 * Is there room for this, across the screen and clear of everything already
 * placed?
 *
 * How HIGH a thing goes is decided by whoever is placing it — a ledge is put
 * inside the band above, and a deck only ever slides sideways or climbs as far
 * as there is sky for. What is left for this to say is: does it fit across the
 * screen, is it standing on top of something else, and would a phone draw a
 * button right over the whole of it. The last one matters because a ledge
 * hidden under a thumb is one you have to land on without being able to see it.
 */
function thereIsRoom(box: Box, placed: Platform[], options: GenerateOptions): boolean {
  if (box.left < SCREEN_MARGIN || box.right > options.world.width - SCREEN_MARGIN) return false
  if (options.touchButtons.some((button) => hiddenUnder(box, button))) return false

  return !placed.some((platform) => overlaps(grown(box, ELBOW_ROOM), sweptBoxOf(platform, options)))
}

// ===========================================================
//  THE MOVERS — ledges that slide, and can really be caught
// ===========================================================

/**
 * Turn some of the ledges the route already uses into ledges that slide.
 *
 * Turning a ledge into a ferry never breaks the route: it still starts exactly
 * where the still ledge was, so the hop on to it is the hop that was already
 * checked, and everywhere it goes from there is somewhere new he can stand.
 *
 * Two rules it will not bend. It never gives a deck to a ledge sitting over
 * the place you jump from, because a platform you are standing under is a
 * ceiling and not a lift. And it works the trip time backwards from how long
 * the chance to board should last, so no generated ferry is ever the one that
 * can only be caught by somebody who already knows it is coming.
 */
function makeMovers(route: Step[], platforms: Platform[], shop: Workshop, budget: number): void {
  const { dice, dials, options } = shop
  let made = 0

  for (const step of shuffled(route, dice)) {
    if (made >= budget) break

    const deck = deckOf(step.platform)
    if (deck.left <= step.from.right && deck.right >= step.from.left) continue

    const away = deck.left >= step.from.right ? 1 : -1
    const others = platforms.filter((platform) => platform !== step.platform)

    for (const moves of travelsFor(deck, away, dice)) {
      const trial = { ...step.platform, moves }
      const swept = sweptBoxOf(trial, options)
      const seconds = tripSecondsFor(trial, step.from, dials.boardingWindow, options)

      if (!thereIsRoom(swept, others, options)) continue
      if (aCeilingOverTheStart(swept, options)) continue
      if (windowSecondsFor(trial, step.from, seconds, options) < WINDOW.least) continue

      step.platform.moves = { ...moves, seconds }
      made++
      break
    }
  }
}

/** The ways one deck might travel, biggest trip first. */
function travelsFor(deck: Ledge, away: number, dice: Dice): PlatformMotion[] {
  const lift = Math.round(dice.between(70, 180))
  const slide = Math.round(dice.between(110, 260))
  const climb = Math.min(lift, deck.top - SKY_MARGIN - ELBOW_ROOM)
  const gentler = Math.round(slide * 0.55)

  const ways = [
    { moves: { moveX: slide * away, seconds: 1 }, distance: slide },
    { moves: { moveY: -climb, seconds: 1 }, distance: climb },
    { moves: { moveX: gentler * away, seconds: 1 }, distance: gentler },
  ]

  // A deck that barely moves is a ledge pretending to be a ferry.
  return ways.filter((way) => way.distance >= 50).map((way) => way.moves)
}

/** A deck hanging over his head where he starts is a thing to bonk, not to ride. */
function aCeilingOverTheStart(swept: Box, options: GenerateOptions): boolean {
  const reach = riseFor(options.maxJumps, options.physics)
  const overHim =
    swept.left <= PLAYER_START.x + options.playerWidth &&
    swept.right >= PLAYER_START.x - options.playerWidth

  return overHim && swept.bottom <= PLAYER_START.y && swept.top >= PLAYER_START.y - reach
}

/** The same list, shuffled the same way every time for the same dice. */
function shuffled<T>(list: readonly T[], dice: Dice): T[] {
  const shuffle = [...list]
  for (let index = shuffle.length - 1; index > 0; index--) {
    const swap = dice.whole(0, index)
    const held = shuffle[index] as T
    shuffle[index] = shuffle[swap] as T
    shuffle[swap] = held
  }
  return shuffle
}

// ===========================================================
//  THE COINS — the thing you are actually here for
// ===========================================================

/**
 * Hang the coins on everything there is to stand on.
 *
 * Every coin floats a little way above somewhere he can stand, which is what
 * makes it reachable — no coin is ever placed anywhere that was not already
 * proved to be part of the route. Coins over a ferry's path are the ones you
 * can only get by riding: standing still IS the trick, the way three of level
 * 3's coins work.
 *
 * The highest one goes on first, on purpose. It guarantees the level has a
 * reason to use the third jump, which is the other thing he called boring.
 */
function hangCoins(
  platforms: readonly Platform[],
  dice: Dice,
  dials: Dials,
  options: GenerateOptions,
): Coin[] {
  const spots = platforms.flatMap((platform) => spotsOver(platform, options))
  spots.sort((one, other) => one.y - other.y)

  const highest = spots.slice(0, 1)
  const order = [...highest, ...shuffled(spots.slice(1), dice)]
  const wanted = Math.round(dials.coins)
  const coins: Coin[] = []

  for (const spot of order) {
    if (coins.length >= wanted) break
    if (!aGoodSpotForACoin(spot, coins, platforms, options)) continue
    coins.push(spot)
  }

  return coins
}

/** The places a coin could float above one platform, wherever that platform goes. */
function spotsOver(platform: Platform, options: GenerateOptions): Coin[] {
  const lanes = Math.min(3, Math.max(1, Math.floor(platform.width / COIN_ELBOW)))
  const moves = platform.moves

  if (moves && options.movingSpeed > 0) {
    // Along its trip, at the height of somebody riding it: the coins come to
    // you, and there is no other way to be up there.
    return Array.from({ length: 3 }, (_, index) => {
      const along = (index + 1) / 4
      const where = platformPosition(platform, along * moves.seconds * 1000)
      return { x: Math.round(where.x), y: Math.round(where.y - platform.height / 2 - COIN_LIFT) }
    })
  }

  const deck = deckOf(platform)
  return Array.from({ length: lanes }, (_, index) => ({
    x: Math.round(deck.left + (platform.width * (index + 0.5)) / lanes),
    y: Math.round(deck.top - COIN_LIFT),
  }))
}

/** Is this a place a coin can actually be? */
function aGoodSpotForACoin(
  spot: Coin,
  taken: readonly Coin[],
  platforms: readonly Platform[],
  options: GenerateOptions,
): boolean {
  const { width } = options.world

  if (spot.x < COIN_LIFT || spot.x > width - COIN_LIFT) return false

  // Where he stands at the start, so the level never opens on "COINS 1/13".
  if (Math.hypot(spot.x - PLAYER_START.x, spot.y - PLAYER_START.y) <= options.playerWidth * 1.5)
    return false

  // Behind a thumb on a phone, where you finish on 12 out of 13 not knowing why.
  if (options.touchButtons.some((button) => isOnButton(button, spot))) return false

  if (taken.some((coin) => Math.hypot(coin.x - spot.x, coin.y - spot.y) < COIN_SPACING))
    return false

  return !platforms.some(
    (platform) => platform.moves === undefined && inside(spot, grown(boxOf(platform), 4)),
  )
}

// ===========================================================
//  NAMES, BOXES, AND OTHER SMALL SUMS
// ===========================================================

/**
 * Made-up names, because "I got to Star Crossing" is worth saying at the dinner
 * table and "I got to 14" is not.
 *
 * The second word says what the level is ABOUT, so the name is a warning as
 * well as a name: a Canyon has a floor full of holes, a Wait has a ferry you
 * have to be patient with, a Climb goes a long way up.
 */
const FIRST_WORDS = [
  'Sky',
  'Coin',
  'Star',
  'Long',
  'Quiet',
  'Night',
  'Moon',
  'Far',
  'Old',
  'Lost',
] as const

const JOB_WORDS: Record<DialName, readonly string[]> = {
  hardestHop: ['Leap', 'Lunge'],
  narrowestLedge: ['Perch', 'Toehold'],
  boardingWindow: ['Wait', 'Patience'],
  movers: ['Ferry', 'Parade'],
  floorSolid: ['Canyon', 'Crossing'],
  coins: ['Hoard', 'Haul'],
  routeDepth: ['Climb', 'Stairs'],
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

/** Everywhere a platform ever gets to over the course of one trip. */
function sweptBoxOf(platform: Platform, options: GenerateOptions): Box {
  const box = boxOf(platform)
  const moves = platform.moves
  if (!moves || options.movingSpeed === 0) return box

  const far = platformPosition(platform, moves.seconds * 1000)
  const moveX = far.x - platform.x
  const moveY = far.y - platform.y

  return {
    left: box.left + Math.min(0, moveX),
    right: box.right + Math.max(0, moveX),
    top: box.top + Math.min(0, moveY),
    bottom: box.bottom + Math.max(0, moveY),
  }
}

function grown(box: Box, by: number): Box {
  return { left: box.left - by, right: box.right + by, top: box.top - by, bottom: box.bottom + by }
}

function overlaps(one: Box, other: Box): boolean {
  return (
    one.left < other.right &&
    one.right > other.left &&
    one.top < other.bottom &&
    one.bottom > other.top
  )
}

function inside(point: Coin, box: Box): boolean {
  return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom
}

/** Is every corner of this rectangle inside this round button? */
function hiddenUnder(box: Box, button: TouchButton): boolean {
  return [
    { x: box.left, y: box.top },
    { x: box.right, y: box.top },
    { x: box.left, y: box.bottom },
    { x: box.right, y: box.bottom },
  ].every((corner) => isOnButton(button, corner))
}
