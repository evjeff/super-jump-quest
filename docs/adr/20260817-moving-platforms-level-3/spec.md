# Spec — Moving platforms, and a level 3 built around them

## Current Status

- **State:** `[DRAFT]`
- **Last updated:** 2026-08-17
- **Next action:** Review with the person who asked for it, then work `plan.md`.

## The ask

> "Add moving platforms to level 3."

Level 3 did not exist when this was asked. So this is one idea with two halves
that only make sense together: a **platform that moves**, and a **level whose
whole personality is moving platforms**. Building the mechanic without a level
to use it in would ship a feature nobody plays; building a level 3 without the
mechanic would use up the level slot the mechanic wanted.

Both kinds of movement are in scope: platforms that **slide side to side**
(ferries across a gap) and platforms that **carry you up and down** (lifts).

## What a player should experience

A kid plays level 3 and, without being told anything:

1. Runs to the edge of the ground and finds a gap far too wide to jump.
2. Notices a ledge sliding back and forth across it.
3. **Waits** — this is the new skill the level teaches — hops on as it arrives,
   and feels themselves being carried instead of standing still.
4. Hops off at the far side.
5. Finds a ledge that goes up and down, rides it into the sky, and grabs coins
   that are simply hanging in the air on the way up.
6. Rides one last ferry along the top of the sky to the final coin.

The feeling to protect is **being carried**. If he stands on a sliding platform
and stays where he is while the platform slides out from under him, the feature
has failed even if nothing crashes.

## Must have

- A platform in a level file can be given movement by adding numbers to it:
  how far it travels, in which direction, and how long the trip takes.
  A platform with no movement numbers behaves exactly as it does today.
- Standing on a sliding platform carries the player sideways with it.
- Standing on a rising platform lifts the player; standing on a falling one
  lowers them, without the player bouncing, stuttering, or repeatedly playing
  the landing thud.
- The player can still run and jump normally while riding.
- Moving platforms look different from ordinary ones at a glance, so a kid can
  see which ones move before stepping on one.
- A new level 3 that uses both kinds, reachable by finishing level 2, with the
  score carrying across as it already does between 1 and 2.
- Where a platform is at any moment is decided by **how long this level has been
  running**, not by how many frames have been drawn. Two players on different
  machines, and the same player on a phone and a laptop, must get the same
  level — the game records best times, and a level that runs slower on a slow
  device would make those times meaningless.
- Levels 1 and 2 play exactly as they do today. No pixel of them changes.

## Should have

- One number in `tuning.ts` that makes every moving platform faster or slower at
  once, so "level 3 is too hard" is a one-number answer. `0` freezes them.
- Coins hanging in the air along a lift's path, so riding it up is rewarded.

## Out of scope

- Platforms that fall away when you stand on them, disappear, tilt, or speed up.
- Platforms that move along a path with corners. One straight there-and-back
  trip only.
- Enemies, and every other line in `IDEAS.md`. One idea at a time.
- Redesigning levels 1 or 2 to use the new mechanic.

## How we will know it works

- Unit tests, in `src/game/`, for where a platform is at a given moment, how
  fast it is going, and whether the player is standing on it.
- A browser test that watches a platform in the running game actually change
  position, and — the real check — that a player standing on it **moves with
  it** without pressing a key.
- The existing browser test that walks level 1 → level 2 → "YOU WIN!" is
  extended to walk through level 3, because with a third level the win no
  longer arrives after level 2.
- A person plays level 3 and gets across the gap.

## Risks

- **Riding is fiddly in Arcade physics.** Phaser does not carry a rider on a
  moving body for free; that has to be done deliberately. This is the part most
  likely to need a second attempt, so it is built and proven before the level is
  designed around it.
- **A level nobody can finish.** Distances that look fine on the grid can be
  unjumpable in the hand. The layout gets played, not just typed.
- **The buttons on a phone cover the bottom corners.** Level 3's coins should
  keep out of them — level 2 already has a coin hiding under `▶`.
