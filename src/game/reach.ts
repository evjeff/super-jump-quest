/**
 * How far Pip can actually get — pure sums, no Phaser, no browser.
 *
 * Everything here is worked out from the numbers in `src/tuning.ts` rather than
 * typed in, so if someone turns the jump up to 900 for a moon-jump, these
 * answers change with it and every level built on them changes to match.
 *
 * The four numbers that matter, with today's tuning (jump 520, gravity 1200,
 * running 220, three jumps):
 *
 *   one jump   rises 113, and carries him 191 sideways
 *   two jumps  rise  225, and carry  him 326 sideways
 *   three      rise  338, and carry  him 451 sideways
 *
 * Those are the same numbers written by hand at the top of `level3.ts`, worked
 * out by a person and then checked by playing. That level's 500-wide hole was
 * chosen because it is bigger than 451: there is NO jumping it, so you have to
 * wait for the ferry. `reach.test.ts` holds this file to those numbers.
 *
 * Remember that y counts DOWNWARDS, like everywhere else in the game: higher up
 * the screen is a SMALLER y.
 */

/** A point on the game's 960 × 540 grid. */
export interface Point {
  x: number
  y: number
}

/**
 * The bits of `TUNING.player` that decide what he can reach.
 *
 * `TUNING.player` fits this as it is, so callers pass it straight in.
 */
export interface JumpPhysics {
  /** Sideways running speed, in pixels per second. */
  speed: number
  /** How hard he launches upward, in pixels per second. */
  jumpVelocity: number
  /** How hard the world pulls him down, in pixels per second per second. */
  gravity: number
}

/**
 * How high he gets using this many jumps, in pixels.
 *
 * One jump is `v² / 2g`. Every jump after the first starts from a standstill —
 * pressing jump sets his upward speed rather than adding to it — so three jumps
 * is simply three times one jump, which is why the triple jump feels so
 * generous.
 *
 * Note this goes up with the SQUARE of the jump: doubling `jumpVelocity` in
 * `tuning.ts` makes him go four times as high, not twice.
 */
export function riseFor(jumps: number, physics: JumpPhysics): number {
  if (jumps <= 0) return 0
  const { jumpVelocity, gravity } = physics
  return (jumps * jumpVelocity * jumpVelocity) / (2 * gravity)
}

/**
 * How long he is off the ground using this many jumps, in seconds, if he lands
 * back at the height he started.
 *
 * Each jump's climb takes `v / g`, and the fall at the end takes as long as
 * falling from the top does. So an extra jump adds a whole climb but only a
 * little extra fall — the fourth jump buys less hang time than the second.
 */
export function airtimeFor(jumps: number, physics: JumpPhysics): number {
  if (jumps <= 0) return 0
  const { jumpVelocity, gravity } = physics
  const climbing = (jumpVelocity / gravity) * jumps
  const falling = Math.sqrt((2 * riseFor(jumps, physics)) / gravity)
  return climbing + falling
}

/**
 * How far he travels sideways in one go, in pixels, landing level with where he
 * started. He runs at full speed the whole time he is in the air, so this is
 * just speed × airtime.
 */
export function runFor(jumps: number, physics: JumpPhysics): number {
  return physics.speed * airtimeFor(jumps, physics)
}

/**
 * How much of a jump it takes to get from one place to another.
 *
 * 0 means he is already there. 1 means it is exactly the furthest he could
 * possibly go — a jump pressed on the very frame he leaves the ledge, with no
 * bounce and no squash, which is not something a person does twice. Anything
 * above 1 is out of reach, and straight-up-out-of-reach comes back as Infinity.
 *
 * So a level asking for 0.3 is comfortable, 0.5 wants aiming, and 0.9 is
 * unkind. For what our own three levels ask for, see
 * `docs/adr/20260822-random-endless-levels/plan.md` — the answer surprised us.
 *
 * Two things it deliberately gets a little wrong, both in the safe direction:
 * it charges for the climb and the crossing separately and takes whichever is
 * dearer, and it assumes he spends every jump climbing. Both make a hop look
 * slightly harder than it is, which is the right way round for something that
 * decides whether a child can finish a level.
 */
export function hopCost(from: Point, to: Point, jumps: number, physics: JumpPhysics): number {
  const climb = from.y - to.y
  const rise = riseFor(jumps, physics)

  // Higher than he can get, however long he runs at it.
  if (climb > rise) return Number.POSITIVE_INFINITY

  // How far he falls from the top of his jump down to wherever he is landing —
  // which is further, and so takes longer, when he is dropping to a lower ledge.
  const fall = rise - climb
  const { gravity, speed, jumpVelocity } = physics
  const airtime = (jumpVelocity / gravity) * jumps + Math.sqrt((2 * fall) / gravity)

  const acrossShare = Math.abs(to.x - from.x) / (speed * airtime)
  const upShare = climb > 0 ? climb / rise : 0
  return Math.max(acrossShare, upShare)
}
