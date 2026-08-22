# Levels after 3 are generated from the level number

- **Date:** 2026-08-22
- **Status:** Proposed — built, and waiting to be played. See `tasks.md`.

## The short version

Right now the game has three levels and then it stops. This makes levels that
never run out.

**Levels 1, 2 and 3 stay exactly the same.** They're the ones we built by hand.
You still get YOU WIN! after the ferry one. Then you press N and the game starts
making its own levels — 4, 5, 6, 7 — and it never runs out.

**The game rolls dice to build a level, but the dice always land the same way
for the same level.** Level 7 is always the same level 7: same ledges, same
coins, same name, forever. So your best time still counts, and you can tell
someone "try level 12, it's the one with the massive hole".

**You can always finish a level.** The game builds each one by pretending to be
Pip. It stands where he stands, and it only puts the next ledge somewhere he can
really reach. So there's never a coin you can't get to. Ever.

**Levels get harder going up — but not by making the jumps longer.** We measured
our own three levels and got a surprise: the ferry one is the hardest to play,
and it has the EASIEST jumps in the whole game. What makes it hard is *waiting*
for the ferry, and that hole you can't get back over. So later levels get harder
mostly by making things move faster, and by taking away more of the floor.

**Each level is about one thing.** Level 3 is about the ferry, and it's kind to
you everywhere else. A level that's hard at everything at once is just annoying,
not fun. So every new level picks one thing to be about, and goes easy on the
rest — and it's never the same thing as the level before it.

**The game checks its own levels before it shows you one.** If a level comes out
broken, or just boring — all the coins in a straight line, a ferry you never
need to use — it chucks it in the bin and builds another one. It gets twelve
goes, then it picks the best one it made, so you're never left waiting.
**Whenever you spot something boring, we can add it to the list of things the
game throws away.** That list is meant to grow.

**Two new buttons:** one to play the level you're on again from the start, and
one to skip a level that's beating you.

## What he chose

Asked in plain language on 2026-08-22, and these answers are the reason several
numbers in `plan.md` are what they are:

- **"A bit easier, then climb."** Level 4 is a breather after the ferry one, and
  by level 5 or 6 the ladder is past anything hand-made. This is the `base` in
  the difficulty curve.
- **All four ways of getting harder, at once** — ferries faster, less floor,
  tinier ledges, more coins. He was offered them as a pick-any-you-like and
  picked every one, so no dial gets to coast at the top of the ladder. Two of
  the four run out of room (there is a limit to how little floor there can be,
  and Pip is 32 wide, so a ledge has a smallest useful size); those stop where
  physics stops them, and ferries and coins keep climbing past them.
- **Boring means: all the coins in a straight line, and never having to leave
  the ground.** Those are the two `dull` rules we start with, and the only two.
  The others in the first draft were guesses of mine that he did not pick, so
  they wait until somebody actually complains about one.
- **"Impossible to reach a coin."** He added this himself when asked what makes
  a level boring. It is already the first `broken` rule — never shipped, not
  merely re-rolled. The nine-year-old and the test suite independently picked
  the same thing as the worst thing that can happen.
- **Made-up names, yes.** "I got to Star Crossing" is worth more than "I got to
  14".

## Documents in this package

- [spec.md](spec.md) `[BUILT, NOT YET PLAYED]` - What an endless ladder of random
  levels has to feel like, which dials get harder, and what must never happen.
  Read when arguing about scope.
- [plan.md](plan.md) `[BUILT, NOT YET PLAYED]` - The reach maths, what the
  hand-made levels measure, the dials and how they are derived, the generator's
  steps, the checker, and how it is all wired in without touching a scene's
  drawing code. Read before writing any of it — especially §4, which is the
  argument.
- [tasks.md](tasks.md) `[BUILT, NOT YET PLAYED]` - The build as it actually
  happened, in order, including every place the plan turned out to be wrong and
  what was done instead. Read to find out what is really in the code.

## Context

The game has three hand-made levels and then it is over. The ask:

> "Randomly create levels, where higher levels get progressively harder in
> various dimensions — how much ground is open at the bottom, how many coins,
> how many moving platforms — with some randomness to all of it."

Three facts about this repo shape every answer below.

**A level is already just data.** `src/levels/level1.ts` is a list of platforms
and a list of coins, and `GameScene` will draw any such list. So "generate a
level" means "write that data with a function instead of by hand". Nothing about
drawing, physics, sound or scoring has to change.

**The screen does not scroll.** Every level is one fixed 960 × 540 picture. A
generated level cannot get *longer*; it can only get denser and meaner.

**The game keeps records.** There is a clock in the corner and a best time per
level, saved in the browser. A level that is different every time you play it
turns those records into nonsense.

## Decision

### 1. Levels 1–3 stay hand-made; level 4 onwards is generated, forever

The three hand-made levels are the tutorial — the ones that teach jumping,
aiming and waiting, and the ones with a person's judgement in every number.
They are not replaced. "YOU WIN!" still happens after level 3, and then
`press N` carries on into level 4, 5, 6 … with no end.

The generator therefore only has to be *good*, not *better than hand-made*, and
it never has to teach the controls to someone holding the keyboard for the first
time.

### 2. The dice are rolled from the level number, not from the clock

Level 7 is the same level for everybody, every time — the same ledges in the
same places, forever. The seed is `worldSeed` (a number in `tuning.ts`) mixed
with the level number, and that is the only source of randomness in the whole
system.

This is what makes the rest of the game keep working:

- **Best times still mean something.** Your record on level 12 was set on the
  level you are playing right now.
- **"Try level 14, it's the one with the canyon"** is a sentence that works.
- **A level that seems impossible can be looked at.** With fresh dice every
  play, "level 9 is broken" is unfalsifiable.
- **The tests can be real tests.** "Generate levels 4 to 200 and check every
  coin is reachable" only checks something if the levels are the same next time.

The randomness the ask wants is between *neighbouring levels*, not between
replays of one level: level 8 has nothing in common with level 7.

`worldSeed` is the re-roll. Change that one number and the whole ladder becomes
a different ladder. Change it back and the old ladder returns exactly as it was.

Best times are therefore **filed under what the level is made of, not under its
number** — a short hash of its platforms and coins. A level that has not changed
keeps its record; a level that has changed does not inherit a record set on a
different level. This matters more than it looks, because of decision 3: the
checker will keep growing, and a new check reshapes some levels.

### 3. Finishable is built in; *worth playing* is checked and re-rolled

Two different problems, and treating them as one is how random level generators
end up producing sludge.

**Finishable is built in.** The generator does not scatter platforms and then
search for a route. It walks: it stands where the player stands, and every
platform it places is *within one reachable hop of the last one*. The route
exists because the level was built along it — not because a search found one.

How far a hop can be comes out of `tuning.ts` — `jumpVelocity`, `gravity`,
`speed`, `maxJumps` — the same numbers Pip actually obeys. So turn the jump up
and the levels grow to fit: set `jumpVelocity` to 900 and level 40 spreads out
to use the bigger jump instead of going trivial.

**Worth playing is checked.** Construction cannot tell you whether a level is
*dull*, because dullness is not a property you can build your way out of. So
there is a checker — a growing library of small named rules — and a level that
fails is thrown away and re-rolled:

- **`broken` rules** are the reachability and safety list. These should be
  impossible by construction, so one firing is a *generator bug*, and the tests
  treat it as a failure over levels 4–200.
- **`dull` rules** are hypotheses about fun: every coin in a row, a ferry the
  route never needs, a level with no spike to its difficulty, the same idea as
  the level before. Each one arrives from something a person actually said while
  playing, and the library grows over time.

The re-roll is **bounded, deterministic and cannot fail**: up to a dozen
candidates, all drawn from the same seed, and if none passes cleanly the
best-scoring one is played. Bounded because "retry until it passes" is exactly
how a generator hangs for eight seconds between levels on a phone; deterministic
because level 7 has to stay level 7, discarded candidates and all; never-fails
because there must always be a next level to hand the player.

### 4. Difficulty climbs forever, but only along the dials that can — and it is
spent unevenly

Difficulty is one number that rises with the level number and never stops
rising. It is then **spent as a budget across the dials, mostly on one of them**,
rather than raising all of them evenly. That is not a flourish; measuring levels
1–3 says it is what a good level looks like. Level 3 puts almost its whole budget
into the floor (a hole you cannot jump) and is *more forgiving than level 1* on
jump distance. A level that raises every dial by the same amount is the
wallpaper level: technically harder, and instantly forgettable.

Which dial gets the budget is the level's **job**, it changes from level to
level, and "this level has no job" is one of the `dull` rules in decision 3.

Each dial is aimed from "gentle" toward its own hard limit, and which limit it
has decides how much room it really had:

- **Distance dials cannot climb far.** A gap wider than a triple jump is not
  harder, it is *impossible*, and the only reason level 3 gets away with a
  500-wide hole is that a ferry crosses it. So gap widths, drops and ledge
  spacing climb toward — and never past — what the jump can actually do.
- **Density dials fill up.** Coins, ledges and movers stop when the screen is
  full.
- **The timing dial has no ceiling.** Ferries can always run a little faster and
  boarding windows a little tighter, and that never makes a level unfinishable —
  only harder to catch. This is the dial the late ladder is really made of.

Measuring the hand-made levels settled an argument that would otherwise have been
settled by taste, and settled it against the first draft of this plan. The
hardest hop anywhere in levels 1–3 asks for about **a third** of the triple jump,
and level 3 — the hardest level to play — has the *most* generous jumps of the
three. **Distance is not what makes these levels hard; waiting and commitment
are.** An early draft had generated level 4 demanding nearly twice the tightest
jump in the existing game. It would have passed every reachability test and been
horrible to play.

So the honest version of "harder forever" is: **the number climbs with no cap,
and every dial approaches its limit without crossing it.** Level 200 is harder
than level 100 — by a smaller step than level 4 to level 5, because the
distances have long since stopped growing and only the clock is still tightening.
The alternative — dials that keep growing past the jump — makes levels that
cannot be finished by anyone, and a level nobody can finish is not difficulty,
it is a bug. `platforms.movingSpeed` is already the knob that slows the whole
timing dial down on a bad day.

### 5. Two new buttons: play this level again, and skip it

An endless game needs a way out of a level, because with generated levels
"this one is beating me" arrives eventually and there is no designer to blame.

- **Play again** restarts the level you are on exactly as you arrived at it: the
  coins come back, the clock restarts, and the score goes back to what it was
  when you got there.
- **Skip** jumps to the next level. It is marked *for now* on purpose — it lives
  behind a switch in `tuning.ts` so it can be taken away later without touching
  code — and a skipped level records no time, because you did not finish it.

### 6. Generated levels are the same data as hand-made ones

`generateLevel(n)` returns exactly the `Level` shape `level1.ts` exports. There
is no second kind of level, no second code path in `GameScene`, and a generated
level can be printed out and pasted into a file as a hand-made one if it turns
out to be a good level.

## Consequences

**Good**

- The game stops ending. There is always a next level.
- Every generated level is finishable by construction, and that claim is checked
  by cheap browserless tests over hundreds of levels at once.
- The generator reads the same `tuning.ts` the player does, so the control panel
  keeps its promise: nothing in it can break the game.
- Records, level names and bug reports all keep working, because level 7 is
  always level 7.

**The costs, stated plainly**

- **Generated levels will be less interesting than hand-made ones.** Level 3 has
  a joke in it — the hole you cannot jump, the wait that is the answer. A
  generator produces competent terrain, not jokes. This is why levels 1–3 stay.
- **Late levels stop feeling much different from each other.** Once every dial
  is near its limit, level 60 and level 90 are both "dense, fast, tight". A
  generator cannot invent a new idea at level 60; only a person can.
- **`tuning.ts` becomes load-bearing.** Wild numbers still cannot crash the game,
  but they now reshape every level past 3. A silly `gravity` makes silly levels
  rather than a broken game — worth knowing before someone wonders why level 20
  looks strange after they made him floaty.
- **One more thing that can be wrong in a way tests do not see.** A level can be
  finishable and still no fun. The checker turns each such discovery into a rule
  so it is only found once — but the finding still has to come from a person
  playing.
- **The checker's library growing changes old levels.** Add a rule, and some
  level 7 candidate now loses to a different one, so level 7 is a different
  level. That is the value of the library, not a defect — but it is why records
  are keyed by what a level is made of, and it means somebody's best time can
  disappear when a rule lands. Worth batching rule changes rather than dribbling
  them.

## Alternatives considered

- **Generate every level, including level 1.** Rejected: the first three levels
  are the best content in the game and the only ones that teach. A generator
  would have to be trusted with a seven-year-old's first thirty seconds.
- **Fresh dice every playthrough.** Rejected: it deletes the meaning of every
  best time, and makes "level 9 is broken" impossible to check.
- **Generate, then verify reachability with a solver.** Rejected *as the way to
  guarantee finishable*: a pathfinder over jump arcs is more code than the rest of
  `src/game/` put together, and walk-forward construction gets the same guarantee
  for a tenth of it. Note the checker in decision 3 is not this: it re-rolls on
  *taste*, over levels that are already finishable by construction, which is why
  it can afford to be a bounded dozen tries.
- **Unbounded "keep generating until it passes every check".** Rejected: a rule
  library that grows will eventually contain a combination almost nothing
  satisfies, and the failure mode is the game freezing between levels — on the
  slowest device, in the worst mood. Best-of-twelve degrades instead: a slightly
  dull level, on time.
- **A difficulty cap around level 15.** Rejected by the ask — the ladder is to
  keep climbing. The per-dial physical limits do the job a global cap would have
  done, without ever announcing "this is as hard as it gets".
