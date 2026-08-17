# Platforms move by clock time, and Phaser carries the rider

- **Date:** 2026-08-17
- **Status:** Proposed

> Proposed until level 3 has been played by hand. See `tasks.md`.

## Documents in this package

- [spec.md](spec.md) `[DRAFT]` - What a moving platform has to feel like, and
  what level 3 asks of a player. Read when arguing about scope.
- [plan.md](plan.md) `[DRAFT]` - The data shape, the one pure rule, and how it
  is wired into Phaser. Read before touching the code.
- [tasks.md](tasks.md) `[IN PROGRESS]` - The build order, and why the mechanic
  is proven before the level is designed. Read to pick up where this left off.

## Context

"Moving platforms" had been sitting under **Someday / bigger** in `IDEAS.md`
since the beginning. The request that started this was *"add moving platforms to
level 3"* — and there was no level 3. So this is one idea with two halves that
only make sense together: platforms that move, and a level whose personality is
those platforms. The mechanic without a level would ship something nobody plays;
a level 3 without the mechanic would use up the slot the mechanic wanted.

Three questions had to be answered before any of it could be built, and they are
the whole of this record.

## Decision

### Where a platform is, is a function of the level clock

A moving platform's position is worked out from **how long the current level has
been running** — `platformPosition(platform, elapsedMs)` in
`src/game/movingPlatform.ts`, a there-and-back triangle wave — rather than by
nudging the platform a little further each frame.

The reason is best times. This game puts a clock in the corner and remembers
your record, and a platform whose rhythm is added up frame by frame drifts:
level 3 would be a *different level* on a phone that draws forty frames a second
than on a laptop that draws sixty, and the record you were chasing would have
been set on a level you can't play. Deriving position from time makes level 3
the same level everywhere, and makes it the same level twice in a row.

It also makes the platform something a unit test can pin down. "At one and a
half seconds it is exactly here" is a check; "wherever it drifted to by now" is
not — and cheap, browserless tests of the rules are the bet this whole repo is
built on.

Two things follow for free, and both are what we would have chosen anyway. The
level clock stops when the finish banner goes up, so the platforms stop with it.
And the clock counts the game's own frames, so a tab left in the background does
not come back with the ferries somewhere unrecognisable.

### The engine carries the rider — we don't

Standing on a sliding ledge has to *carry* you. That is the whole feature; a
platform that slides out from under your feet is a bug with a nice colour.

Phaser's Arcade physics already does it. Once the player has been separated onto
the top of an immovable body, `ProcessY.js` runs `body.x += distance *
friction.x`, and `friction.x` defaults to `1` on every body. So the carry costs
nothing as long as moving platforms are `immovable` bodies and the player
collides with them normally.

We say this out loud because the hand-written version is very tempting and
**wrong**: adding the platform's speed to the player's own velocity each frame,
which is what the first draft of the plan did, gives the player the carry
*twice*. He crosses the ferry at double its speed and drops off the front. It
was caught by reading `node_modules/phaser/src/physics/arcade/ProcessY.js`
rather than by playing the game, which is the cheaper of the two ways to find
it. Anyone tempted to add a carry later should set `friction.x = 0` on the
platform bodies in the same change, or hit the same bug.

### Position is handed to Phaser through `directControl`, not by teleporting

Setting a body's position directly each frame is normally how you break Arcade
collisions — the engine works out which way something is moving by comparing it
with where it was, and a body that is simply placed somewhere new looks
stationary. Arcade has a supported mode for driving a body yourself:
`body.directControl = true` makes it derive velocity from the distance moved
since the last frame, and the riding code above reads the same distance.

So we get an exactly-positioned platform *and* working collisions, without
inventing a way to translate our position into a velocity for Phaser to
integrate. The version this replaced — setting the velocity to
`(target − current) / dt` every frame to chase the analytic position — works
too, but it is the same idea written by hand and unwired from the riding maths.

## Consequences

**Good**

- The whole rule is one pure function of time, unit tested without a browser,
  and level 3 plays identically on a phone, a laptop, and a slow tab.
- The riding is the engine's, so there is no "is he standing on it" test of our
  own to get wrong, no ordering question between the scene's update and the
  physics step, and `handleMovement` in `GameScene` is untouched.
- `moves` is optional on a platform, so levels 1 and 2 are unchanged — not
  "changed but equivalent", literally the same files.
- A level file still reads like a map: one list of platforms, some of which have
  a note saying they slide.
- One knob, `platforms.movingSpeed`, makes every moving platform gentler at
  once, and `0` freezes them. That is the answer to "level 3 is too hard today"
  without editing a level.

**Bad / accepted**

- There are now two ways to change how fast a platform goes: `seconds` in the
  level file and `movingSpeed` in `tuning.ts`. Two knobs for one feeling is a
  real cost; it is paid because one is a design decision and the other is a
  Saturday-morning decision, and a kid should not have to open a level file to
  make the game easier.
- The carry depends on undocumented-ish behaviour inside Phaser's Arcade
  separation. A Phaser upgrade could change it. The browser test in task 9 is
  there precisely so that shows up as a red test rather than as an unplayable
  level.
- Platforms freeze on the finish banner. It looks slightly odd if you are
  standing on one when the last coin is grabbed.
- The motion is a straight there-and-back at a constant speed, which turns
  around instantly at each end. No easing, no pauses, no corners. It is the
  simplest thing that is fun, and anything else is a new decision.
- A third level makes a full playthrough longer, and the browser test that walks
  every level takes longer with it.

**Revisit if**

- A platform needs to do something other than go there and come back — a
  circle, a pause at each end, a path with corners. That is a new shape for
  `moves`, and probably a new record.
- Someone wants a platform that falls away when you stand on it. That one is
  genuinely different: it depends on the player, not only on the clock, so the
  "position is a pure function of time" decision above is the thing it breaks.
- Phaser's riding behaviour changes under an upgrade. The fallback is to carry
  the rider ourselves *and* set `friction.x = 0` in the same breath.
