# Platforms move by clock time, and take their passenger with them

- **Date:** 2026-08-17
- **Status:** Accepted

## Documents in this package

- [spec.md](spec.md) `[COMPLETE]` - What a moving platform has to feel like, and
  what level 3 asks of a player. Read when arguing about scope.
- [plan.md](plan.md) `[COMPLETE]` - The data shape, the one pure rule, and how it
  is wired into Phaser. Read before touching the code.
- [tasks.md](tasks.md) `[COMPLETE]` - The build order, and why the mechanic was
  proven before the level was designed around it. Read for what actually
  happened at each step.
- [review.md](review.md) `[COMPLETE]` - What was checked, what the checks found,
  and what is still open. Read before trusting any of the above.

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

### We carry the rider, and we keep carrying him in mid-air

Standing on a sliding ledge has to *carry* you. That is the whole feature; a
platform that slides out from under your feet is a bug with a nice colour.

**Whichever moving platform he last stood on is his "ride", and it stays his
ride until he lands on something else.** It works differently depending on
whether his feet are down:

- **Feet on the deck**: the platform is moved to where the clock says it should
  be, and he is moved by exactly the same step. Not given its speed — moved by
  its step, off the same clock, so there is no arithmetic for the two of them to
  disagree about.
- **In the air above it**: he keeps the speed the deck had *at the moment he
  left*, and stops caring what it does next. Following it live is the obvious
  thing and it is wrong: a ferry reaching the end of its trip mid-jump would
  sweep him back the other way in mid-air. Nothing a jump does should be able to
  reverse it. Taking the speed you left with is what being thrown from a moving
  thing does, and it still lands him on the plank he took off from.

The obvious alternative is to let Phaser do it, and Phaser will: once the player
has been separated onto the top of an immovable body, `ProcessY.js` runs
`body.x += distance * friction.x`. That was the first build, and it is exact —
measured at 44.38088888888865 pixels to the ferry's 44.38088888888870. It is
also, on its own, **the wrong feel**, which is a thing no amount of reading
finds and one minute of playing does.

The engine's carry only applies while his feet are down. A jump is nearly a
second of feet-not-down, and at a ferry's 123 pixels a second that is a hundred
pixels of deck — most of it. Jump twice on a ferry and you walk off the back of
it without ever pressing a direction. The person this game is built for said it
in one sentence: *"my character slides to one of the ends of the platform."*

So the ride survives a jump, which is what makes jumping straight up on a ferry
put you back down on the plank you left.

Three things fall out of that, all of them load-bearing:

- **`frictionX: 0` on the platform group.** The engine's carry has to be turned
  off, or he gets carried twice — at double the ferry's speed, off the front. It
  is not off by default in the way you would guess: a `Body` defaults
  `friction.x` to `1`, while `PhysicsGroup.js` defaults it to `0`. So both
  values have been the source of a bug here, in opposite directions.
- **Move him by the step, not by the speed.** Giving him the platform's velocity
  and letting the physics integrate it looks equivalent and is not: the platform
  moves off the level clock while the player moves off the physics accumulator,
  and on a busy machine those disagree. That version drifted seven pixels in
  three jumps, with nothing to pull the error back. Moving him by the platform's
  own step cannot drift, because it is the same number.
- **The ride ends on `blocked.down`, never on `touching.down`.** `touching` means
  "something brushed me" and comes back true for the odd frame in the middle of a
  fall with nothing near him. One of those ended the ride 37 pixels above the
  deck, and by the time his feet found it again the ferry was ten pixels further
  on — the exact drift this is all here to prevent, reintroduced by the fix for
  it. It took a frame-by-frame trace to see.

### Standing on a moving deck counts as standing, whatever the collision says

A platform moving under his feet makes Arcade's contact flags flicker: he sinks
a fraction into the deck, gets pushed back out, and the little bounce that
follows reads as leaving the floor and arriving on it again. Every one of those
"arrivals" restarts the landing squash, so riding a lift squashed him over and
over — *"it looks like I am continually landing and getting squished."*

So "is he on the ground" now also accepts "his feet are on a deck he is riding",
which is a question about where he **is** rather than about what the collision
**did** this frame. It allows a few pixels of slack, and a bounce off a deck is
about one, so it holds steady where the flags do not.

The landing *sound* never had this problem: it has always been debounced by
`sound.landingCooldownMs`. The squash deliberately was not, because bouncing
down a staircase should squash on every bounce. That is still true — what
changed is that resting on a moving floor is no longer mistaken for bouncing.

### Sideways only, up and down is the collision's

Up and down is left to ordinary collision separation: a rising
platform pushes the resting player up, and on a falling one gravity keeps him in
contact. That was a guess about somebody else's engine, so it was measured
rather than trusted — over a four-second ride including the turnaround at the
top, the player travels 217.4 pixels to the platform's 216.3, drifts at most 4.5
pixels from the deck, and lands exactly once. Doing it here as well would lift
him twice.

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
- His place on the deck is exact and stays exact — standing, walking, jumping,
  and across a turnaround — because it comes from the same clock the platform
  does rather than from anything that can round differently.
- Jumping on a ferry does what a person expects it to do.
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
- He is moved by setting his position rather than by the physics, which skips
  collision for that step. Nothing in level 3 puts a wall where a ferry could
  press him into it, and Arcade sorts out any overlap on the next frame — but a
  level that ran a ferry along a wall would want checking.
- Keeping the ride through a jump means he holds the ferry's motion for as long
  as he is in the air, including a jump *off* it onto solid ground. That reads
  as inertia and feels right, but it is a decision, not physics: he does not
  keep it after landing.
- Because a jump keeps the speed he left with rather than following the deck, a
  jump that straddles a turnaround puts him down further along the deck than he
  took off from. That is the correct answer and the one that feels right, but it
  does mean "you always land on the same plank" is only true within one trip.
- `frictionX: 0` is invisible and essential. Someone tidying it away, or adding
  a second carry "to be safe", gets double speed off the front of the ferry.
- The lift test measures how much of the ride he spends in contact with the
  deck, not how many times he lands. Landings were the obvious measure and are
  the wrong one — a machine busy enough to drop a frame gives him one long fall,
  and `player.bounce` turns that into a real bounce on any platform, moving or
  not. On a loaded laptop that read as 8 bounces while the ride was perfect.
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
- A platform ever needs to carry him vertically the way it carries him
  sideways — a lift you can jump on the spot on. Today the collision does the
  vertical, and jumping off a rising lift lets it leave without you.
