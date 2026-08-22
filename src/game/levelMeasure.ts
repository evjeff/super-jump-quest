/**
 * What a level is LIKE TO PLAY — pure sums, no Phaser, no browser.
 *
 * Hand it any level, hand-made or made up by the game, and it walks it the way
 * a player would: stand where he starts, hop to somewhere he can stand, hop
 * again, and keep going until it has been everywhere the level can take him.
 * Then it writes down what it found — is every coin gettable, which single jump
 * is the meanest one the level makes you do, how much floor there is, how long
 * you get to catch each ferry.
 *
 * It is worth having on its own, before any of it is used to build levels: it
 * is a machine that reads a level and tells you what you actually built. Every
 * check that gets written about a level is built on what it reports — including
 * the one that would have spotted level 2's coin sitting exactly where a phone
 * draws its ▶ button, which took a person playing it on a phone to notice.
 *
 * Two things it is deliberately generous about, both said out loud here so
 * nobody mistakes the answers for promises:
 *
 *   - It lets him run to the very end of a ledge and land on the very end of
 *     the next one. A real player leaves themselves more room than that.
 *   - A ledge that SLIDES counts as somewhere to stand along its whole trip,
 *     because riding it is the whole point of it. So level 3's ferry is
 *     "standable" for the entire 500-pixel hole it crosses.
 *
 * And one thing it cannot see at all: WAITING. It knows the ferry gets there;
 * it does not know you stood at the edge for four seconds first. That is why
 * `docs/adr/20260822-random-endless-levels/plan.md` keeps timing as its own
 * family of dials instead of folding it into one difficulty number.
 *
 * Remember y counts DOWNWARDS: higher up the screen is a SMALLER y.
 */

import type { Level, Platform } from '../levels'
import { platformPosition } from './movingPlatform'
import { airtimeFor, hopCost, type JumpPhysics, type Point, runFor } from './reach'

/** Everything the tape measure needs to know about the game it is measuring. */
export interface MeasureOptions {
  /** How fast he runs, how hard he jumps, how hard the world pulls. */
  physics: JumpPhysics

  /** How many jumps he gets before touching the ground again. */
  maxJumps: number

  /** How big the screen is. */
  world: { width: number; height: number }

  /** `platforms.movingSpeed` from `tuning.ts`. 0 freezes every ferry. */
  movingSpeed: number
}

/**
 * Somewhere he can stand, and everywhere it goes.
 *
 * For an ordinary ledge this is just the top of it. For one that slides, it is
 * the whole span its deck sweeps over the course of a trip — because if he can
 * ride it, he can be anywhere along that span.
 */
export interface StandingArea {
  left: number
  right: number

  /** The highest the deck ever gets. The SMALLEST y, because y counts down. */
  highest: number

  /** The lowest the deck ever gets. */
  lowest: number
}

/** A hole in the floor. */
export interface Gap {
  left: number
  right: number
  width: number

  /** Can he clear it with everything he's got? A hole wider than this needs a ferry. */
  jumpable: boolean
}

/** What it takes to get one coin. */
export interface CoinReport {
  x: number
  y: number

  /** Can he get it at all? If this is ever false the level is broken. */
  reachable: boolean

  /**
   * The meanest single hop on the kindest route to it, as a share of a full
   * triple jump. See `hopCost` in `reach.ts` for what the share means.
   */
  cost: number

  /** How many hops that route is, counting the last one onto the coin itself. */
  hops: number

  /** Is the last place he stands before taking it a ledge that MOVES? */
  forcedRide: boolean
}

/** How catchable one sliding ledge is. */
export interface FerryReport {
  /** Its place in the level's list of platforms. */
  platform: number

  /**
   * How long, in real seconds out of one there-and-back trip, a jump onto its
   * deck exists from the place you would be standing when you jumped.
   *
   * This is the number level 3's ferry took three goes to get right: park it
   * out in the middle and there is a blink of a chance in every trip, and you
   * have to already know it is coming.
   */
  boardingWindowSeconds: number

  /** How many jumps that catch takes. 0 means there is no catching it. */
  boardingJumps: number
}

/** Everything the tape measure found. */
export interface LevelMeasurement {
  /** The one that matters most. False means the level is broken. */
  everyCoinReachable: boolean

  /**
   * The meanest hop the level makes you do, as a share of a triple jump.
   * Infinity if there is a coin nothing can reach — see `hopCost` in `reach.ts`.
   */
  hardestHop: number

  /**
   * How many hops it takes to get to the coin that is furthest along the route,
   * counting the drop off the spot he starts in and the last hop onto the coin.
   */
  routeDepth: number

  coins: CoinReport[]
  coinCount: number

  /**
   * How many coins the kindest route takes off a moving deck — the ones where
   * standing still IS the trick, like the three hanging over level 3's hole.
   */
  forcedRides: number

  /** How much of the bottom of the screen is ground, from 0 (none) to 1 (all). */
  floorSolid: number

  gaps: Gap[]

  /** Every hole too wide to jump back over. Cross one and you are committed. */
  oneWayCrossings: number

  /** Platforms that are not the floor. */
  ledges: number

  /** The width of the smallest one. Pip is 32 wide. 0 means there are none. */
  narrowestLedge: number

  /**
   * How many of the platforms slide — what the level is MADE of, so this still
   * counts them when `movingSpeed: 0` has frozen every one of them.
   */
  movers: number

  /** How many hops you redo to get back over the widest hole after falling in. */
  fallCost: number

  ferries: FerryReport[]

  /** Everywhere he can stand: the start, then one per platform, in order. */
  standingAreas: StandingArea[]
}

/**
 * How finely the ferry's trip is chopped up when timing the boarding window.
 *
 * 720 slices of a three-second trip is a little over four milliseconds each,
 * which is finer than the game draws and far finer than anyone's thumb.
 */
const WINDOW_SLICES = 720

/** Reaching a hop's theoretical limit exactly is a 1. Past that is out of reach. */
const WITHIN_REACH = 1

/**
 * Measure a level: the one function in this file anyone else calls.
 */
export function measureLevel(level: Level, options: MeasureOptions): LevelMeasurement {
  const { world, maxJumps, physics, movingSpeed } = options

  const spots = spotsIn(level, movingSpeed)
  walkTheLevel(spots, options)

  const coins = level.coins.map((coin) => routeToCoin(coin, spots, options))
  const reached = coins.filter((coin) => coin.reachable)

  const floor = level.platforms.filter((platform) => isFloor(platform, world))
  const ledges = level.platforms.filter((platform) => !isFloor(platform, world))
  const covered = mergeSpans(floor.map((piece) => spanOf(piece, world)))
  const gaps = gapsBetween(covered, world.width, runFor(maxJumps, physics))

  return {
    everyCoinReachable: reached.length === coins.length,
    hardestHop: biggest(coins.map((coin) => coin.cost)),
    routeDepth: biggest(reached.map((coin) => coin.hops)),
    coins,
    coinCount: coins.length,
    forcedRides: coins.filter((coin) => coin.forcedRide).length,
    floorSolid: covered.reduce((total, span) => total + span.right - span.left, 0) / world.width,
    gaps,
    oneWayCrossings: gaps.filter((gap) => !gap.jumpable).length,
    ledges: ledges.length,
    narrowestLedge: ledges.length === 0 ? 0 : Math.min(...ledges.map((ledge) => ledge.width)),
    movers: level.platforms.filter((platform) => platform.moves !== undefined).length,
    fallCost: hopsBackOver(gaps, spots),
    ferries: measureFerries(spots, options),
    standingAreas: spots.map((spot) => spot.area),
  }
}

/** The biggest of a list of numbers, or 0 if the list is empty. */
function biggest(values: number[]): number {
  return values.reduce((most, value) => Math.max(most, value), 0)
}

/**
 * Every place in this level he could be standing: the spot he starts in, which
 * he only occupies for the half second before he lands, and then the top of
 * every platform.
 */
function spotsIn(level: Level, movingSpeed: number): Spot[] {
  const start = level.playerStart
  const here: Spot = {
    area: { left: start.x, right: start.x, highest: start.y, lowest: start.y },
    cost: 0,
    hops: 0,
  }

  return [
    here,
    ...level.platforms.map((platform, index) => ({
      area: standingArea(platform, movingSpeed),
      ferry: slides(platform, movingSpeed) ? { index, deck: platform } : undefined,
      cost: Number.POSITIVE_INFINITY,
      hops: 0,
    })),
  ]
}

/** Does this platform actually go anywhere, with the game tuned as it is? */
function slides(platform: Platform, movingSpeed: number): boolean {
  const moves = platform.moves
  return moves !== undefined && moves.seconds > 0 && movingSpeed !== 0
}

/**
 * Everywhere the top of this platform ever is.
 *
 * A platform that stands still is its own deck and nothing more. One that
 * slides sweeps a span, and the two ends of that span come from the game's own
 * `platformPosition` rather than from doing the sums again here — one copy of
 * how a ferry moves, and this agrees with it by construction.
 */
export function standingArea(platform: Platform, movingSpeed: number): StandingArea {
  const [home, far] = tripEnds(platform, movingSpeed)
  const halfWidth = platform.width / 2
  const halfHeight = platform.height / 2

  return {
    left: Math.min(home.x, far.x) - halfWidth,
    right: Math.max(home.x, far.x) + halfWidth,
    highest: Math.min(home.y, far.y) - halfHeight,
    lowest: Math.max(home.y, far.y) - halfHeight,
  }
}

/**
 * The two ends of a platform's trip.
 *
 * With `movingSpeed` at 0 the game's clock for platforms never ticks, so every
 * ferry sits exactly where it starts forever — and both ends of its trip are
 * that one spot.
 */
function tripEnds(platform: Platform, movingSpeed: number): [Point, Point] {
  const stopped = platformPosition(platform, 0)
  const moves = platform.moves
  if (!moves || !(moves.seconds > 0) || movingSpeed === 0) return [stopped, stopped]

  // `startAt` says where in the trip the level begins, so wind the clock back
  // by that much to see the home end and forward a whole trip for the far one.
  const startAt = moves.startAt ?? 0
  const at = (phase: number) => platformPosition(platform, (phase - startAt) * moves.seconds * 1000)
  return [at(0), at(1)]
}

/** Is this platform part of the ground along the bottom of the screen? */
function isFloor(platform: Platform, world: { height: number }): boolean {
  return platform.moves === undefined && platform.y + platform.height / 2 >= world.height
}

interface Span {
  left: number
  right: number
}

function spanOf(platform: Platform, world: { width: number }): Span {
  return {
    left: Math.max(0, platform.x - platform.width / 2),
    right: Math.min(world.width, platform.x + platform.width / 2),
  }
}

/** Squash overlapping and touching spans together into as few as possible. */
function mergeSpans(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.left - b.left)
  const merged: Span[] = []

  for (const span of sorted) {
    const last = merged[merged.length - 1]
    if (last && span.left <= last.right) last.right = Math.max(last.right, span.right)
    else merged.push({ ...span })
  }

  return merged
}

/** Everywhere along the bottom of the screen that is NOT ground. */
function gapsBetween(covered: Span[], width: number, tripleJump: number): Gap[] {
  const gaps: Gap[] = []
  let edge = 0

  for (const span of [...covered, { left: width, right: width }]) {
    if (span.left > edge) {
      gaps.push({
        left: edge,
        right: span.left,
        width: span.left - edge,
        jumpable: span.left - edge <= tripleJump,
      })
    }
    edge = Math.max(edge, span.right)
  }

  return gaps
}

/**
 * Somewhere he can stand, and the kindest way of getting there.
 *
 * The `cost`, `hops` and `from` are filled in by `walkTheLevel` below; before
 * it runs they say "no idea how to get here".
 */
interface Spot {
  area: StandingArea

  /**
   * Set only when this spot is a ledge that SLIDES: which platform it is in the
   * level's list, and the platform itself. Anything without this stays put.
   */
  ferry?: { index: number; deck: Platform }

  /** The meanest hop on the way here, as a share of a triple jump. */
  cost: number

  /** How many hops it took to get here. */
  hops: number

  /** Where he hopped from. Nothing at all for the spot he starts in. */
  from?: Spot
}

/**
 * The gap between two standing areas, measured edge to edge. 0 if they overlap.
 */
function spanGap(a: StandingArea, b: StandingArea): number {
  return Math.max(0, a.left - b.right, b.left - a.right)
}

/**
 * What it costs to hop from one standing area to another.
 *
 * The kindest version of the hop: leave from the highest the first deck ever
 * gets, land on the lowest the second one ever gets, and go edge to edge. Every
 * one of those choices makes the hop cheaper, which is the generosity this file
 * owns up to at the top.
 */
function hopBetween(from: StandingArea, to: StandingArea, options: MeasureOptions): number {
  const target = { x: spanGap(from, to), y: to.lowest }
  return hopCost({ x: 0, y: from.highest }, target, options.maxJumps, options.physics)
}

/** What it costs to hop from a standing area to one exact spot, like a coin. */
function hopTo(from: StandingArea, target: Point, options: MeasureOptions): number {
  const across = Math.max(0, from.left - target.x, target.x - from.right)
  return hopCost(
    { x: 0, y: from.highest },
    { x: across, y: target.y },
    options.maxJumps,
    options.physics,
  )
}

/**
 * Walk the whole level from where he starts, and work out the KINDEST way to
 * every place he can stand.
 *
 * Kindest means the route whose single worst hop is as easy as possible — not
 * the shortest route. That is the honest question to ask about a platformer: a
 * long amble is not what beats you, one horrible jump in the middle of it is.
 *
 * Level 1 shows why. The reward ledge up in the sky can be lunged at from the
 * first stepping stone, and that one jump asks for nearly four fifths of
 * everything he has. Go the long way round over the other stepping stones and
 * it is four hops, none of them harder than about a third. The long way is the
 * one a person takes, so it is the one this counts. Ties go to fewer hops.
 */
function walkTheLevel(spots: Spot[], options: MeasureOptions): void {
  const settled = new Set<Spot>()

  for (;;) {
    // Wherever he can get to most easily and hasn't been worked out yet.
    let here: Spot | undefined
    for (const spot of spots) {
      if (settled.has(spot) || spot.cost > WITHIN_REACH) continue
      if (!here || kinder(spot, here)) here = spot
    }
    if (!here) break
    settled.add(here)

    for (const spot of spots) {
      if (settled.has(spot)) continue
      const hop = hopBetween(here.area, spot.area, options)
      const candidate = { cost: Math.max(here.cost, hop), hops: here.hops + 1, from: here }
      if (candidate.cost <= WITHIN_REACH && kinder(candidate, spot)) Object.assign(spot, candidate)
    }
  }
}

/** Easiest worst hop wins; if two routes tie on that, the shorter one wins. */
function kinder(candidate: { cost: number; hops: number }, best: { cost: number; hops: number }) {
  if (candidate.cost !== best.cost) return candidate.cost < best.cost
  return candidate.hops < best.hops
}

/** The kindest way to one coin: the best place to take it from, and what that costs. */
function routeToCoin(coin: Point, spots: Spot[], options: MeasureOptions): CoinReport {
  let best = { cost: Number.POSITIVE_INFINITY, hops: 0, from: undefined as Spot | undefined }

  for (const spot of spots) {
    if (spot.cost > WITHIN_REACH) continue
    const candidate = {
      cost: Math.max(spot.cost, hopTo(spot.area, coin, options)),
      hops: spot.hops + 1,
      from: spot,
    }
    if (candidate.cost <= WITHIN_REACH && kinder(candidate, best)) best = candidate
  }

  const reachable = best.cost <= WITHIN_REACH

  return {
    x: coin.x,
    y: coin.y,
    reachable,
    cost: best.cost,
    hops: reachable ? best.hops : 0,
    forcedRide: reachable && best.from?.ferry !== undefined,
  }
}

/**
 * How many hops of your route you redo after falling in the biggest hole.
 *
 * Falling costs you no coins and stops no clock — the game puts you back at the
 * start with everything you had. What it costs is the walk back, so that is
 * what this counts: the hops it takes to be standing on the far side of the
 * widest hole in the floor again. A level with a solid floor costs nothing,
 * because there is nowhere to fall.
 */
function hopsBackOver(gaps: Gap[], spots: Spot[]): number {
  const widest = gaps.reduce(
    (worst: Gap | undefined, gap) => (!worst || gap.width > worst.width ? gap : worst),
    undefined,
  )
  if (!widest) return 0

  let redo = 0

  for (const spot of spots) {
    if (spot.area.left < widest.right || spot.cost > WITHIN_REACH) continue
    if (redo === 0 || spot.hops < redo) redo = spot.hops
  }

  return redo
}

function measureFerries(spots: Spot[], options: MeasureOptions): FerryReport[] {
  const ferries: FerryReport[] = []

  for (const spot of spots) {
    if (!spot.ferry) continue
    ferries.push({
      platform: spot.ferry.index,
      ...boardingWindow(spot.ferry.deck, spot.from?.area, options),
    })
  }

  return ferries
}

/**
 * How long the chance to jump onto this ferry lasts, out of one whole trip.
 *
 * It watches the ferry go all the way there and all the way back, using the
 * game's own `platformPosition` so this is where the deck really is and not an
 * idea of where it ought to be. At each moment it asks: if he jumped now, would
 * the deck be under him when he came down? The answer counts the flight time,
 * because a ferry sliding away from you is somewhere else by the time you land.
 *
 * He catches it with the fewest jumps that ever catch it. Nobody triple-jumps
 * at a ferry that is coming to them anyway, and level 3's own note says every
 * hop on and off a mover there is kept well inside one jump.
 *
 * One place it is generous twice over: if the kindest route has him boarding
 * this ferry FROM another ferry, it uses that one's whole swept span, so it
 * never asks whether the two decks are ever side by side at the same moment.
 */
function boardingWindow(
  platform: Platform,
  anchor: StandingArea | undefined,
  options: MeasureOptions,
): { boardingWindowSeconds: number; boardingJumps: number } {
  const moves = platform.moves
  if (!anchor || !moves) return { boardingWindowSeconds: 0, boardingJumps: 0 }

  // One there-and-back, in the seconds a person waiting at the edge would count
  // — which is why `movingSpeed` comes into it. Double the speed, half the wait.
  const tripSeconds = (2 * moves.seconds) / options.movingSpeed

  for (let jumps = 1; jumps <= options.maxJumps; jumps++) {
    const flightSeconds = airtimeFor(jumps, options.physics)
    let caught = 0

    for (let slice = 0; slice < WINDOW_SLICES; slice++) {
      const jumpAt = (slice / WINDOW_SLICES) * tripSeconds
      const landAt = (jumpAt + flightSeconds) * 1000 * options.movingSpeed
      const deck = deckAt(platform, landAt)
      const across = Math.max(0, anchor.left - deck.right, deck.left - anchor.right)
      const cost = hopCost(
        { x: 0, y: anchor.highest },
        { x: across, y: deck.highest },
        jumps,
        options.physics,
      )
      if (cost <= WITHIN_REACH) caught++
    }

    if (caught > 0) {
      return {
        boardingWindowSeconds: (caught / WINDOW_SLICES) * tripSeconds,
        boardingJumps: jumps,
      }
    }
  }

  return { boardingWindowSeconds: 0, boardingJumps: 0 }
}

/** Where this platform's deck is, this far into the level. */
function deckAt(platform: Platform, elapsedMs: number): StandingArea {
  const here = platformPosition(platform, elapsedMs)
  const top = here.y - platform.height / 2
  return {
    left: here.x - platform.width / 2,
    right: here.x + platform.width / 2,
    highest: top,
    lowest: top,
  }
}
