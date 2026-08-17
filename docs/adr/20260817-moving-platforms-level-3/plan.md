# Plan — Moving platforms, and a level 3 built around them

## Current Status

- **State:** `[COMPLETE]`
- **Last updated:** 2026-08-17
- **Next action:** Built. See `tasks.md` for what changed along the way.

Read `spec.md` first for what is being built and why.

## Shape of the change

| File | What happens to it |
|---|---|
| `src/game/movingPlatform.ts` | **New.** One pure rule: where a platform is at a given moment. |
| `src/game/movingPlatform.test.ts` | **New.** Written first. |
| `src/levels/index.ts` | `Platform` gains an optional `moves` block. |
| `src/levels/level3.ts` | **New.** The level, as data. |
| `src/tuning.ts` | One speed knob, one colour. |
| `src/scenes/BootScene.ts` | A second platform texture in the new colour. |
| `src/scenes/GameScene.ts` | Build moving platforms into their own group and set their position each frame. |
| `tests/probe.ts`, `tests/smoke.spec.ts` | Extend the level walk to three levels; add a riding test. |
| `README.md`, `IDEAS.md` | Say the game has three levels and a new knob. |

Levels 1 and 2 are not touched.

## The data: a platform that also moves

A moving platform *is* a platform, so it stays in the same list rather than
getting a second one. `moves` is optional, which is what keeps levels 1 and 2
untouched and their files unchanged.

```ts
export interface PlatformMotion {
  /** How far right it slides before coming back. Negative goes left first. */
  moveX?: number
  /** How far DOWN it goes before coming back. Negative goes up first. */
  moveY?: number
  /** How long one trip takes, in seconds. Bigger = slower and gentler. */
  seconds: number
  /** Where in its trip it starts, 0 to 1. Use it so two ferries aren't in step. */
  startAt?: number
}
```

`x`/`y` on the platform stay what they already mean: where it sits. That is now
**one end of its trip**, not the middle — "it starts here and goes 300 to the
right and comes back" is the sentence a nine-year-old can write. The middle
would need mental arithmetic before you can place anything.

## The rule (pure, in `src/game/`)

One function. No Phaser, no browser:

```ts
platformPosition(platform, elapsedMs) → { x, y }
```

A there-and-back triangle wave. Phase = `(elapsedMs / 1000 / seconds + startAt)`
wrapped into `0..2`; the fraction travelled is `phase` on the way out and
`2 - phase` on the way back. So the platform sits at its home position at the
start, at the far end after `seconds`, and home again after `2 × seconds`. A
platform with no `moves` block simply returns where it already is.

**Position comes from elapsed time, not from adding up frames.** This is the
decision here worth arguing about, and the spec's reason is best times: a
platform whose phase drifts with frame rate makes level 3 a different level on a
slow phone than on a fast laptop. Time-driven also makes the platform exactly
testable — "at 1.5 seconds it is exactly here" is a sentence a unit test can
hold; "wherever it drifted to" is not.

The elapsed time handed in is the level clock `levelTimeMs` that `GameScene`
already keeps. Two consequences come free, and both are the behaviour we want:
platforms freeze when the finish banner goes up (the clock stops there), and
they freeze while the tab is hidden (the clock counts the game's own frames, and
a hidden tab draws none).

## The wiring (in `GameScene`)

**Two groups.** Still platforms stay in the static group they already use.
Moving ones go into a `physics.add.group({ allowGravity: false, immovable: true })`
with a second collider against the player. Immovable so the player cannot shove
a ferry off course; no gravity so it does not fall out of the sky.

**Phaser is told we are driving the position ourselves.** Each moving
platform's body gets `directControl = true`, and every frame the scene sets the
sprite's position to whatever `platformPosition` says. That is Arcade's
supported mode for exactly this: it derives the body's velocity from the
distance moved since the last frame, so collision separation still behaves as if
the platform were moving under its own steam.

**We carry the rider, and we keep carrying him in mid-air.** `updateRide` picks
out whichever moving platform he is standing on and remembers it; `movePlatforms`
moves that platform to where the clock says, and moves him by the same step.

> This section is the one the playtest rewrote. The original plan handed the
> carry to Phaser — Arcade does it for free in `ProcessY`, via
> `body1.x += distance * friction.x`, and it is exact. It is also only true
> while his feet are down, and a jump is nearly a second of not-down. Three
> paragraphs of reasoning could not see that; thirty seconds of playing could.
> The ADR has the full story.

Three details are load-bearing, and all three have been a bug at some point:

- **`frictionX: 0` on the group**, to switch Phaser's own carry off. Both
  defaults have bitten here: a `Body` defaults `friction.x` to `1`, a
  `PhysicsGroup` to `0`.
- **Move him by the platform's step, not by its speed.** The speed version is
  integrated by the physics accumulator while the platform runs off the level
  clock, and on a loaded machine they disagree — seven pixels in three jumps,
  with nothing correcting it. The step version cannot drift; it is the same
  number.
- **End the ride on `blocked.down`, never `touching.down`.** `touching` comes
  back true for stray frames mid-fall.

Sideways only. Up and down is ordinary collision separation: a rising platform
pushes the resting player up, and on a falling one gravity keeps him in contact.

**Task 6 proves this in a browser before the level is designed around it.** A
running game is the only thing that settles claims about feel.

## Tuning and colour

```ts
platforms: {
  /** How fast the moving platforms go. 1 is normal. 0.5 is half speed. 0 freezes them. */
  movingSpeed: 1,
},
```

Applied by scaling the elapsed time handed to the rule, so it changes everything
about the motion at once and `0` stops the world without dividing by anything.

There are now two ways to change a platform's speed — this knob and `seconds` in
the level file. That is deliberate: the level file is where a *design* decision
lives, `tuning.ts` is where "level 3 is too hard for me today" lives, and the
comment on each says so.

`colors.movingPlatform` gets a distinctly different colour, and `BootScene`
generates a second rectangle texture from it. A kid needs to see which ledges
move before trusting one, and the alternative — telling them — does not work at
speed.

## Level 3 — "The Sky Ferry"

A first sketch, to be played and adjusted rather than trusted:

- **The crossing.** Ground in two pieces with a pit between them far wider than
  the ~190 a single jump covers. A ferry slides back and forth across it.
- **The lift.** On the right, a ledge that rises into the sky, with coins
  hanging in the air along its path so riding it up pays.
- **The sky ferry.** From a shelf at the top, a second slider carries you back
  left along the roof of the level to the last coin.

Distances stay inside what `tuning.ts` allows today: he rises about 113 per
jump, 225 for two, and covers about 190 sideways during one. Every hop on and
off a platform is kept well inside a single jump, because the level is already
asking a kid to time it as well as aim it.

Coins keep clear of where the phone buttons sit — bottom-left about x 24–232 /
y 412–516, bottom-right about x 816–936 / y 396–516.

## What this will break, and the honest fix

The browser test `finishing a level starts the next one, and finishing the last
one wins` walks level 1 → level 2 → `YOU WIN!`. With three levels, finishing
level 2 says `LEVEL 2 DONE!` and that test goes red. **That is the test doing
its job**, and the fix is to extend the walk through level 3 — not to weaken it.
It gets one more `N`, and the same "nothing leaked across" checks on level 3
that it already makes on level 2.

`collectCoins` in `tests/probe.ts` teleports the player onto each coin one frame
apart. Coins do not move, so a level of moving platforms does not disturb it.

## Alternatives considered

- **A separate `movingPlatforms` list in the level file.** Rejected: two lists
  to hold in your head, and a level file that reads less like a map.
- **Phaser tweens with `yoyo: true`.** The obvious Phaser answer, and it does
  the motion for you. Rejected because the position then lives inside Phaser
  where a unit test cannot see it, and this repo's whole bet is that the rules
  stay testable in milliseconds without a browser.
- **Velocity, with the platform turned around when it reaches the end.** The
  other obvious answer. Rejected because where the platform is then depends on
  every frame that came before it, which is the drift the spec rules out.
- **Chasing the analytic position by setting velocity each frame**
  (`(target − current) / dt`). Works, and was this plan's first answer, but
  `directControl` is the same idea supported by the engine, with the riding
  maths already wired to it.
- **Letting Phaser carry the rider.** This plan's original answer, and it is
  exact — but only while his feet are on the deck, so every jump cost him a
  hundred pixels of it. Replaced after the first playtest. Doing both at once is
  a real bug, not a belt and braces: double speed, off the front.
- **Handing the rider the platform's velocity** instead of moving him by its
  step. Simpler to read, and wrong on a busy machine — the two are integrated by
  different clocks.
