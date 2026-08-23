# Spec — Random endless levels after level 3

## Current Status

- **State:** `[BUILT, NOT YET PLAYED]`
- **Last updated:** 2026-08-22
- **Done:** all of it, in code. Levels 1–3 are untouched, the game runs on past
  level 3 forever, level 7 is always level 7, every *broken* rule holds over
  levels 4–200 with no re-roll needed, and both new buttons work on a keyboard
  and on a phone. Levels 1 and 3 come back clean from the checker; level 2 has
  one true finding, left alone on purpose (see *Must have*). The checker's first
  two *dull* rules are the two he named, and they throw away none of the first
  drafts between levels 4 and 200 — which is the number to watch: a rule that
  rejects more than about a quarter is a bug, and a rule that rejects nothing
  may be a rule that never bites.
- **Known divergence, to settle by playing:** point 1 below promises level 4 is
  "seven or eight coins". It comes out with about nineteen. The curve in
  `plan.md` §4.6 — written after measuring the hand-made levels — hands level 4
  fourteen or more, and the curve won the argument in code. Whether *that* is
  still "a breather after the ferry level" is a question for someone holding the
  keyboard, not for a test.
- **Next action:** the last line of *How we will know it works* — **a person
  plays levels 4, 5, 12 and 25**, with the nine-year-old holding the keyboard.
  Every other line on that list is now checked automatically. The ADR stays
  `Proposed` until that happens.

## The ask

> "Randomly create levels, where higher levels get progressively harder in
> various dimensions — how much surface area is open on the bottom, how many
> coins, how many moving platforms — with some randomness to all of it."

Plus, decided while scoping: **a button to play the level again, and a button
to skip it** (skip is "for now").

## What a player should experience

A kid finishes level 3, sees YOU WIN!, presses N — and the game keeps going.

1. **Level 4 is easy and unfamiliar.** Nearly solid ground, a handful of wide
   ledges, seven or eight coins. It plays like level 1 in a place they have
   never been.
2. **Around level 8** the ground has holes in it, ledges are getting narrower,
   and something purple is sliding about.
3. **Around level 15** the floor is more hole than ground, there are three or
   four ferries, and a couple of coins can only be got by riding.
4. **Somewhere past that** they meet the level that beats them, press the skip
   button, and carry on. Nobody gets stuck at the end of the game, because there
   is no end of the game.
5. **Each level's name is new** — "Coin Canyon", "The Long Wait" — so "I got to
   Star Ferry" is a thing to say at the dinner table.

Two feelings to protect:

- **Never a level you cannot finish.** Not "hard" — genuinely impossible: a
  coin on a ledge nothing reaches, a hole with no ferry. That is the failure
  that ends the feature, because a kid does not conclude "unlucky seed", they
  conclude the game is broken.
- **Two levels in a row must not feel like the same level.** Same difficulty,
  different shape. If levels 11 and 12 differ only in the x of a ledge, the
  randomness is not doing its job.

## Must have

- Levels 1, 2 and 3 play exactly as they do today. Not one number of them moves.
- After the last hand-made level the game continues into generated levels and
  never runs out.
- **The same level number is always the same level.** Level 7 today and level 7
  next Saturday are the same ledges, the same coins, the same name.
- A generated level is the same data as a hand-made one: platforms with x, y,
  width, height and an optional `moves`, plus coins with x and y. Nothing else.
- **Every coin is reachable and the level is completable**, from the player's
  start, using no more than `maxJumps` jumps in any one hop, given the physics
  in `tuning.ts` as it is set at that moment.
- **A checker that reads a finished level and says what is wrong with it**, in
  two grades: *broken* (the list below — must never ship) and *dull* (legal but
  not worth playing). A level that fails is discarded and re-rolled, up to a
  bounded number of tries, after which the best of them is played — the game must
  never stall waiting for a good level, and there is always a next level.
- **The checker is a library that grows.** Adding a rule is adding one small
  named function and its test. Every "ugh, this level is annoying because…" from
  someone playing should be able to become a rule in one sitting.
- The checker reads hand-made levels too, and **levels 1, 2 and 3 must pass every
  *broken* rule**. A rule that rejects level 3 is a wrong rule.

  > **Built, and level 2 does not pass.** Levels 1 and 3 come back completely
  > clean — nothing broken, nothing dull. Level 2 has exactly one finding, and
  > it is a true one: its free coin, the one right where you start, sits nine
  > pixels from the middle of where a phone draws ▶. On a phone that coin is
  > under your own thumb. It has been there since level 2 was built, it is
  > exactly what `plan.md` §9 guessed this tool would find, and **it is left
  > alone on purpose** — levels 1–3 are not to be touched by this work, and
  > moving that coin is somebody's deliberate decision about a hand-made level.
  > `levelCheck.test.ts` asserts the finding as it stands today, with a comment
  > saying so, so fixing the coin turns that test red on purpose.
- Difficulty rises with the level number, with randomness on top, across four
  families of dial — measuring levels 1–3 says these are different kinds of hard,
  not one kind (see `plan.md` §4):
  - **aim** — how much of the jump a hop demands, and how narrow the ledges are.
    The smallest family: no hop in the hand-made game asks for more than about a
    third of the triple jump;
  - **timing** — how long the window is to board a ferry, how many movers are on
    the route, how many coins can *only* be got by riding. This is where level 3's
    difficulty actually lives;
  - **commitment** — how much of the floor is missing, whether a crossing can be
    made back the other way, and how much you have to redo after a fall;
  - **length** — how many coins, and how many hops to the last one.
- **The budget is spent unevenly.** Each level puts most of its difficulty into
  one dial — its *job* — and is kind on the others, the way level 3 spikes the
  floor and is gentler than level 1 on jumps. A level that raises every dial by
  the same amount is a level with no personality, and that is a defect the
  checker below is expected to catch.
- **Play again** — a key and an on-screen button — restarts the current level as
  if you had just arrived: coins back, clock from zero, score back to what it
  was when you got there.
- **Skip** — a key and an on-screen button — moves to the next level. No best
  time is recorded for a level that was skipped. It sits behind a switch in
  `tuning.ts` so it can be removed later without a code change.
- Best times keep working for generated levels, and keep working for the
  hand-made ones exactly as they do now.
- Generating a level is instant on a phone. No visible pause between levels.

## Never, in any generated level — the *broken* rules

This list is the test suite, and it is the first half of the checker. Every line
is checked over hundreds of generated levels, not eyeballed on one. Because
levels are built reachable rather than checked-then-fixed, any of these firing is
a **generator bug**, not bad luck.

- A coin that cannot be reached.
- A hole in the floor wider than a triple jump **unless** a moving platform
  crosses it, waits within one jump of the near edge, and waits there long
  enough to be boarded by someone who has not memorised its timing.
- A coin sitting where the player starts, or within a hair of it. Level 3 opened
  on "COINS 1/13" the first time for exactly this reason.
- A coin or a platform under where a phone draws its buttons — ◀ ▶ bottom left,
  ▲ bottom right, and the corner cluster top right.
- Anything off the edge of the 960 × 540 screen, or below the death line.
- A ledge too narrow to stand on. Pip is 32 wide.
- A coin buried inside a platform, or two platforms overlapping.
- No solid ground under the player's start.
- A moving platform parked directly above the player's head. It is a ceiling to
  bonk, not a lift — level 3 learned this one the hard way.

## Probably dull — the rules that start the second half

Guesses about fun, not facts, and each one is a hypothesis until somebody plays
the level. They cost a re-roll, never a failure.

**The starting set is the two the designer named**, and only those:

- **coins all in a straight line** — same height or evenly spaced, so you hoover
  them up without thinking;
- **never leaving the ground** — no real climb anywhere on the route, so the
  triple jump goes unused.

Asked what makes a level boring, he also said *"impossible to reach a coin"* —
which is already the first `broken` rule above, and is treated as never-ship
rather than merely re-rolled.

Waiting for a real complaint before becoming rules: a level with no spike; the
same job as the level before; a mover the route never needs; everything crammed
into the first room.

A rule that rejects more than about a quarter of levels 4–200 is not taste, it is
a bug, and the test suite reports that number for every rule.

## Should have

- A generated two-word name per level, for the HUD and for bragging.
- The mix changes as well as the amount: one level is a climb, the next is a
  crossing, the next is a floor full of holes. Same difficulty, different job.
- `platforms.movingSpeed` keeps working as the "too hard today" knob, and now
  covers every generated ferry too.

## Out of scope

- Enemies, power-ups, hazards, and everything else in `IDEAS.md`. One idea at a
  time.
- Levels that scroll or are bigger than one screen.
- Any menu, mode picker, or level select screen. The game has no menus and this
  does not add the first one.
- Hand-tuning individual generated levels, or saving a good one back to a file.
  (The data comes out in a paste-able shape, so this stays possible later.)
- Difficulty that adapts to how the player is doing. The ladder is the ladder.

## How we will know it works

**The checker, run over levels 1–3.** Every hand-made level passes every *broken*
rule, and the numbers it measures for them match what is written in `plan.md`
§4.2. This is the calibration for the whole difficulty curve; if it drifts, the
curve is describing levels nobody has played. *Done, and it found one real thing
in level 2 — see the note above.*

**Cheap tests over hundreds of levels** (`src/game/`, Vitest, no browser). For
every level from 4 to 200:

- the walk from the start to every coin exists, hop by hop, within the jump
  envelope for the current `tuning.ts`;
- every *broken* rule holds — and no re-roll was needed to make it hold, because
  construction should never have produced one;
- every *dull* rule fires on only a minority of levels, and the re-roll finds a
  clean candidate within its budget for the large majority of level numbers;
- coin count, mover count and floor coverage each sit inside the band the
  difficulty curve promised for that level.

**Determinism.** Generating level 7 twice gives byte-identical data. Changing
`worldSeed` changes it. Changing `worldSeed` back gives the first one again.

**The dials actually move.** Measured over levels 4–200: floor coverage trends
down, coins and movers trend up, and the reach demanded of a hop trends up —
each with visible scatter, because a ladder with no scatter is not random.

**Physics-follows-tuning.** With `jumpVelocity` doubled in a test, generated
levels spread out rather than staying the same size, and every reachability
check still passes.

**Browser tests.** The existing walk through levels 1–3 still passes unchanged.
A new one skips into a generated level and checks the game is actually there —
platforms drawn, coins drawn, Pip standing on something and not falling through
the world. Types can check and unit tests can pass while the screen is black.

**A person plays it.** Levels 4, 5, 12 and 25, with someone under ten holding
the keyboard. The tests can prove a level is finishable; only that can tell us
it is worth finishing.

## Risks

- **Finishable but boring.** The likeliest outcome, and no test catches it. The
  mitigation is that levels 1–3 remain the game's front door, and that the
  per-level "job" (climb / crossing / holes) is drawn as well as the numbers.
- **Reach maths that is right on paper and wrong in the hand.** The envelope is
  computed from tuning, but Phaser's bounce, the squash, and a platform's own
  motion all shave a little off. Mitigation: a safety margin on every hop that
  is generous in early levels, plus playing the levels the maths calls hardest.
- **The ferry that cannot be boarded.** Level 3 needed three attempts to get one
  ferry's parking spot right; a generator has to get it right unattended, every
  time. Mitigation: the boarding window is computed and asserted, not assumed.
- **Best-time records for a world that no longer exists.** Changing `worldSeed`
  must not silently attach old records to new levels. Mitigation: the world is
  part of the key the times are filed under.
- **Skip becomes the game.** A seven-year-old with a skip button may simply
  press it to see level 40. It is behind a switch for that reason, and worth
  watching before deciding whether it stays.
- **A *dull* rule that is really a taste we cannot name.** The risk of a growing
  rule library is rules that fight each other, or one written from a single bad
  evening that quietly costs every later level its variety. Mitigation: rules
  arrive one at a time, each reports how much of the ladder it rejects, and a
  rule can be deleted as easily as it was added.
