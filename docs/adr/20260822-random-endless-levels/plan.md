# Plan — Random endless levels after level 3

## Current Status

- **State:** `[IN PROGRESS]`
- **Last updated:** 2026-08-22
- **Done:** build order steps 1 and 2. `src/game/reach.ts` and
  `src/game/levelMeasure.ts` exist with their tests, and §4.2's table below is
  now what the shipped code measures rather than what a scratch script guessed.
- **Next action:** Step 3, `levelCheck.ts`, `broken` rules only, run against
  levels 1–3.

Read `README.md` for the decisions and `spec.md` for what is being built.

## 1. Shape of the change

| File | What happens to it |
|---|---|
| `src/game/reach.ts` | **New.** How high and how far Pip can get, from the numbers in `tuning.ts`. |
| `src/game/reach.test.ts` | **New.** Written first. Pins the envelope against level 3's hand-worked numbers. |
| `src/game/levelMeasure.ts` | **New.** Reads a level and reports what it is like to play: route, hop costs, dials. Works on hand-made levels too. |
| `src/game/levelCheck.ts` | **New.** The checks a level must pass, and the ones we would like it to pass. A list that grows. |
| `src/game/levelGen.ts` | **New.** The generator. Pure: level number in, `Level` out. |
| `src/game/*.test.ts` | **New**, one per file above. |
| `src/levels/index.ts` | `levelFor(index)` — hand-made for 0–2, generated after. `Level` gains `recordKey`. |
| `src/game/progress.ts` | `afterLevel` learns that endless levels do not run out. |
| `src/game/touchControls.ts` | Two more button ids: play-again and skip. |
| `src/scenes/TouchPad.ts` | Draws them. |
| `src/scenes/GameScene.ts` | `LEVELS[i]` → `levelFor(i)`; the two new keys and buttons; best times keyed by `recordKey`. |
| `src/tuning.ts` | A `levels` block and a `debug` block. |
| `tests/smoke.spec.ts`, `tests/probe.ts` | Existing 1–3 walk unchanged; one new "a generated level is really there" test. |
| `README.md`, `IDEAS.md` | The game no longer ends. |

Levels 1, 2 and 3 are not touched. Nothing in `src/audio/`, `src/storage/` or
`BootScene` changes — a generated level uses the same two platform textures and
the same coin as a hand-made one.

## 2. The jump envelope (`src/game/reach.ts`)

Everything is bounded by what Pip can actually do, worked out from
`TUNING.player` rather than typed in:

```ts
riseFor(jumps)    = jumps * jumpVelocity² / (2 * gravity)
airtimeFor(jumps) = (jumpVelocity / gravity) * (jumps + √jumps)
runFor(jumps)     = speed * airtimeFor(jumps)
```

With today's numbers (520, 1200, 220, 3 jumps):

| jumps | rise | airtime | flat run |
|---|---|---|---|
| 1 | 113 | 0.87 s | 191 |
| 2 | 225 | 1.48 s | 326 |
| 3 | 338 | 2.05 s | 451 |

These are exactly the numbers written by hand at the top of `level3.ts` ("he
rises about 113 pixels in one jump, 225 in two, 338 in three, and moves about
190 sideways during a single jump"), which is the first test: **the formula must
reproduce what a person worked out by playing.**

One function that everything else leans on:

```ts
hopCost(from, to, jumps) → number   // share of the envelope this hop uses
```

Going **up** costs height, so a hop that climbs nearly as high as it can has
almost no sideways left in it — which is how it feels in the hand. `1.0` means
the hop is exactly at the theoretical limit: a jump pressed on the frame he
leaves the ledge, with no bounce and no squash. Nobody does that twice, so a
generated level never asks for anything close to it (§4).

## 3. Where the dice come from (`src/game/random.ts`)

The same four-line generator already at the bottom of `starfield.ts` — an LCG,
same numbers out for the same seed in. `starfield.ts` keeps its own copy and is
not touched; four duplicated lines beat refactoring working code.

```ts
seed = mix(TUNING.levels.worldSeed, levelNumber)
rng  = seededNumbers(seed)
```

Every choice in a level, **including the discarded attempts in §6**, comes from
that one stream in a fixed order. Adding an `rng()` call in the middle reshuffles
every level after it — see §7 for why that is safe.

## 4. The dimensions

### 4.1 What a dial is

A dial is not a number in a table. Each one has to say five things, and the
first draft of this plan said only the last:

| | |
|---|---|
| **feels like** | the sentence a player would say. If there isn't one, it isn't a dial. |
| **measured by** | a function in `levelMeasure.ts` that reads any level — hand-made or generated — and returns the number. |
| **drawn or derived** | drawn from the dice, or computed from other dials. Half of them are derived, which is why "roll six numbers" was wrong. |
| **where 1–3 sit** | the calibration. Endpoints invented from nothing produce levels nobody has ever played. |
| **hard limit** | the value past which it stops meaning "harder" and starts meaning "impossible" or "silly". |

### 4.2 The measurement, and the surprise in it

`measureLevel()` was run over the three hand-made levels: bottleneck-shortest-
path from the player's start to every coin, where a moving platform's *swept*
span counts as somewhere to stand (that is what riding is), and every hop is
priced as a share of the three-jump envelope.

| | level 1 | level 2 | level 3 |
|---|---|---|---|
| floor solid | 1.00 | 0.63 | 0.48 |
| gaps | — | one, 360 wide, bridged by a ledge | one, 500 wide, ferry only |
| ledges (narrowest) | 5 (140) | 6 (130) | 5 (120) |
| moving platforms | 0 | 0 | 3 |
| coins | 7 | 11 | 13 |
| hops to the furthest coin | 5 | 8 | 6 |
| **hardest hop on the route** | **0.36** | **0.32** | **0.24** |

The last row is the surprise, and it rewrites the dial table that was here
before.

**Distance is not what makes these levels hard.** No hop in the entire hand-made
game asks for more than about a third of the jump. And *level 3 — far and away
the hardest to play — has the most generous hops of the three.* Its difficulty
is not in the distances at all; it is in **waiting** for a ferry and in a hole
you cannot jump back over.

The first version of this plan had the reach dial running from 0.64 at level 4
to 0.91 later. Level 4 would have opened by demanding nearly double the tightest
jump in the existing game, and the late ladder would have been frame-perfect
platforming. It would have passed every reachability test and been miserable to
play. That is precisely the "finishable but boring" risk in `spec.md`, and it
would have arrived at level 4.

> **Re-measured with the shipped code, and the argument survives.** The table
> above is now what `measureLevel` returns, pinned by `levelMeasure.test.ts`
> rather than left as prose. The correction that was owed — the scratch script
> did not credit a hop that *drops* with the extra time falling buys, and
> `hopCost` does — moved the costs down as predicted, but not far enough to
> change a single figure at two decimal places: **0.355, 0.316 and 0.243**. The
> biggest single move was level 2's sky coin, 0.32 → 0.316, which is the hop
> that drops.
>
> The row that really moved is **hops to the furthest coin**, 3/5/3 → 5/8/6,
> because the tape measure counts hops differently from the scratch script: it
> counts the drop off the spot he starts in and the final hop onto the coin, and
> it takes the *kindest* route rather than the shortest — in level 1 the way up
> to the reward ledge is four easy hops round the stepping stones, not one lunge
> that costs four fifths of everything he has.
>
> Three numbers in §4.4's L1–L3 columns are still the scratch script's and are
> due the same treatment when those endpoints are next touched. Measured, they
> are: **route depth** 5/8/6 (above), **forced rides** 0/0/**10** of 13 — every
> coin level 3 gives you off a moving deck, not the six that are only over one —
> and **fall cost** 0/3/3 hops. Level 3's three boarding windows come out at
> **2.3 s, 4.9 s and 4.0 s** of their six- and seven-second trips, every one of
> them a one-jump board, which is the calibration T1 wanted.

Two honest caveats about the measurement:

- **It is generous.** It lets him run to the near edge and land on the near edge,
  and it treats a ferry's whole swept path as standing room. Level 3's 0.24 means
  *"if you use the ferry properly, no jump in this level is hard"* — which is
  exactly the truth about level 3.
- **It deliberately cannot see timing.** Waiting is invisible to it. That is not a
  flaw; it is why timing has to be its own family of dials below, rather than
  being folded into a single "difficulty" number.

### 4.3 Four families, because difficulty is not one thing

| family | what it does to a player | evidence from 1–3 |
|---|---|---|
| **Aim** | can you land it | barely used: 0.24–0.36 of the envelope, ledges 120–160 wide |
| **Timing** | can you wait, and can you catch it | all of level 3's difficulty |
| **Commitment** | what it costs you to get it wrong | level 3's un-jump-back-able hole |
| **Length** | how many chances there are to get it wrong | level 2: 5 hops, 11 coins |

The old table had Aim and Length and half of Timing. **Commitment was missing
entirely, and it is the family level 3 is built out of.**

### 4.4 The catalogue

Gentle/limit endpoints marked ✓ are anchored to a measured hand-made level;
those marked ~ are extrapolations we expect to correct after playing.

| dial | feels like | drawn? | L1 | L2 | L3 | gentle | limit |
|---|---|---|---|---|---|---|---|
| **A1** hardest hop | "that jump is tight" | drawn | .36 | .32 | .24 | .30 ✓ | .60 ~ |
| **A2** narrowest ledge | "there's nowhere to land" | drawn | 140 | 130 | 120 | 160 ✓ | 90 ~ |
| **T1** boarding window | "I keep missing the ferry" | drawn | — | — | ~1.1 s | 1.8 s ✓ | 0.7 s ~ |
| **T2** movers on the route | "everything's moving" | drawn | 0 | 0 | 3 | 0 ✓ | 6 ~ |
| **T3** forced rides | "I can't get there by jumping" | derived | 0 | 0 | 6 of 13 | 0 ✓ | half the coins ~ |
| **C1** floor solid | "there's no floor left" | drawn | 1.00 | .62 | .48 | 1.00 ✓ | 0.30 ~ |
| **C2** fall cost | "I lost all that progress" | derived | ~0 hops | 2 hops | 3 hops + a wait | 1 hop ✓ | 6 hops ~ |
| **C3** one-way crossings | "I can't get back" | derived | 0 | 0 | 1 | 0 ✓ | 3 ~ |
| **L1** coins | "this is taking ages" | drawn | 7 | 11 | 13 | 8 ✓ | 24 ~ |
| **L2** route depth | "it's a long way up" | drawn | 3 | 5 | 3 | 4 ✓ | 12 ~ |

**Derived, not drawn — the part the old table got wrong.** The dials are not
independent and cannot be rolled separately:

- **C1 → gap widths.** Floor solid and the number of gaps decide how wide each
  hole is. A hole is then one of three kinds, and the taxonomy comes straight
  from the hand-made levels: **jumpable** (≤ A1 × 451, level 1 has none),
  **bridged** by a ledge standing in it (level 2's 360), or **ferried** (level
  3's 500). Only the third kind may exceed the jump, and only if a mover is
  spent on it — so **C1 cannot be drawn without checking T2 first.**
- **C3 follows from C1 and T2.** A gap you cross by ferry and cannot jump back
  over *is* a one-way crossing. Level 3 has exactly one and it is the level's
  best moment.
- **C2 follows from the route.** How many hops you must redo after a fall is a
  property of the shape, not a number to choose. Falling in this game keeps your
  coins and your clock (`GameScene` already does this) — so a fall costs *time
  and patience*, which is why C2 belongs in the same family as C3 rather than
  being a punishment dial of its own.
- **T3 follows from where the coins went.** You do not choose "six forced rides";
  you place coins over a ferry's path and count what you did.
- **L1 needs somewhere to go.** Coins need ledges and mover paths to sit above,
  so the coin count is clamped by what A2 and L2 built.

Order of derivation: **T2 → C1 → gaps → the route (L2, A1, A2) → movers placed
(T1) → coins (L1, T3) → measure the result (C2, C3).**

### 4.5 The budget, and why it is spent unevenly

The old table said "each dial jitters ±15%". Look at what the hand-made levels
actually do — each dial as a share of its own gentle→limit span:

| | A1 | A2 | C1 | T2 | T1 | L1 | L2 | mean | **peak** |
|---|---|---|---|---|---|---|---|---|---|
| level 1 | .20 | .29 | 0 | 0 | 0 | 0 | 0 | **.07** | .29 |
| level 2 | .07 | .43 | .54 | 0 | 0 | .19 | .12 | **.19** | .54 |
| level 3 | 0 | .57 | **.74** | .50 | .64 | .31 | 0 | **.39** | .74 |

**Hand-made levels are spiky.** Level 3 spends nearly everything on one dial —
the floor — and *refunds* on aim, where it is easier than level 1. That spike is
the level's identity; it is why a seven-year-old calls it "the ferry one".

Six independent ±15% wiggles produce the opposite: every level lands near the
mean, and every level feels like every other level. **That is the single biggest
reason generated levels feel like wallpaper**, and it is a bug in the model, not
in the numbers.

So: difficulty is a **budget spent unevenly**.

```
d          = the level's difficulty (§4.6)
weights    = drawn from the dice, normalised to average 1, then sharpened so
             one dial gets ~2×, one gets ~1.2×, the rest get ~0.4–0.7×
share(i)   = clamp01(d × weight(i))
dial(i)    = lerp(gentle(i), limit(i), share(i))
```

The 2× dial is the level's **job** — the thing it is about — and it is never the
same as the previous level's job. The refunded dials are the level being
*kind* somewhere, which is what makes the spike readable.

The three hand-made levels are the model's first test: level 1 is a flat-and-low
budget, level 2 spikes the floor mildly and pays for it in length, level 3
spikes the floor hard and refunds aim. All three are shapes this model can
produce, which is the argument that it can produce a good level 12.

### 4.6 The curve, recalibrated

The hand-made game measures **0.07 → 0.19 → 0.39**. A ladder starting at 0.11
(what the old table said for level 4) would be a collapse in difficulty right
after the win screen. So the curve starts near where level 3 left off, with one
beat of relief, and climbs from there with no cap:

```ts
d(level) = base + (1 - base) × (1 - 1 / (1 + (level - 3) / ramp))
           base = 0.28, ramp = 8
```

| level | 4 | 5 | 8 | 13 | 23 | 43 | 103 | 203 |
|---|---|---|---|---|---|---|---|---|
| d | .36 | .42 | .56 | .68 | .79 | .88 | .95 | .97 |
| hardest hop | .41 | .43 | .47 | .50 | .54 | .56 | .58 | .59 |
| narrowest ledge | 135 | 130 | 121 | 112 | 104 | 98 | 94 | 92 |
| floor solid | .75 | .70 | .61 | .52 | .44 | .38 | .34 | .32 |
| movers | 2 | 3 | 3 | 4 | 5 | 5 | 6 | 6 |
| boarding window | 1.4 s | 1.3 s | 1.2 s | 1.1 s | 0.9 s | 0.8 s | 0.8 s | 0.7 s |
| coins | 14 | 15 | 17 | 19 | 21 | 22 | 23 | 24 |
| route depth | 7 | 7 | 8 | 9 | 10 | 11 | 12 | 12 |
| jumpable gap ≤ | 184 | 193 | 211 | 227 | 243 | 254 | 263 | 267 |
| total hole | 242 | 285 | 374 | 457 | 534 | 591 | 636 | 653 |

**All four rows he picked climb together.** Asked which things should get harder
at the top of the ladder — faster ferries, less floor, tinier ledges, more coins
— he picked all four, so none of them is allowed to coast. The table honours
that, and the two that run out of room say so honestly: the floor bottoms out
around .32 (there is a limit to how little floor there can be) and the ledges at
about 92 (Pip is 32 wide; below roughly 90 a ledge stops being a platform and
becomes a dare). Past there, the ferry clock and the coin count are what is still
moving — which is the same conclusion §4.2's measurement reached from the other
direction.

That is the **trend**, before the budget is spent unevenly. A level 4 that spikes
the floor at 2× lands at floor .50 with everything else gentle — level 3's
personality, in a new place, at a difficulty a kid who just beat level 3 can
hold. That is the level 4 we want, and this model produces it.

Read the table the way the ADR argues: the distance rows are nearly finished
climbing by level 43, because past there is impossible rather than hard. The
boarding window is the row still moving at level 203.

## 5. How a level is built (`src/game/levelGen.ts`)

Six steps, in the derivation order from §4.4. No loop that can fail to
terminate, nothing thrown away *inside* a level.

**a. Draw the dials** for this level number: `d`, the weights, the job.

**b. Spend the mover budget first** (T2), because the floor's legality depends on
whether there is a ferry to spend on it.

**c. Lay the floor** (C1): ground pieces totalling the solid fraction, with 1–4
gaps, each one marked jumpable, bridged or ferried.

**d. Walk the route** (L2, A1, A2). Stand where Pip stands. Repeatedly draw a
next-ledge offset from inside the envelope at cost ≈ A1, keep it on screen and
clear of what is placed, place it. If a candidate fails, shrink toward a
known-safe hop and retry — bounded attempts, then take the safe hop. **The route
exists because the level was built along it.**

**e. Turn chosen links into movers** (T1). Each mover's `moves` block is chosen
so that its home end is within a reachable hop of the previous anchor and *stays
there long enough to board*, and its far end is within a hop of the next anchor.
The window is computed from `platformPosition` — the real function the game runs,
not an approximation — and level 3's ferry (~1.1 s, judged fair for a
first-timer) is the calibration. And never park a deck above the previous
anchor: *"a platform you are standing under is a ceiling, not a lift"*, a comment
in `level3.ts` that cost three attempts to earn.

**f. Hang the coins** (L1, T3), then name the level from two short word lists.

Output is a plain `Level` — the same object `level1.ts` exports.

## 6. The checker (`src/game/levelCheck.ts`)

Construction can guarantee that a level is *finishable*. It cannot guarantee
that a level is *worth finishing*. Those need different machinery, and conflating
them is what makes random level generators produce sludge.

```ts
checkLevel(level, context) → Finding[]      // one function, a growing list of checks
```

Each check is a small pure function with a name, a severity, and a sentence
saying what a player would complain about. Adding a check later is adding one
entry to an array plus one test — **the library grows every time a played level
annoys somebody**, which is the point.

### Two severities, and they behave differently

**`broken`** — the level cannot be played properly. Every line of *Never, in any
generated level* in `spec.md`: an unreachable coin, a hole with no way across, a
coin on the spawn point or under a phone button, a ledge too narrow to stand on,
a deck parked overhead, anything off screen.

These should be *impossible* by construction. So a `broken` finding is a **bug in
the generator, not bad luck** — the tests treat any of them over levels 4–200 as
a failure, loudly. In the running game they are still a reason to discard the
candidate, because shipping a broken level to a kid is worse than shipping a dull
one.

**`dull`** — the level is legal and nobody wants to play it. These are
*hypotheses about fun*, and unlike the `broken` list they are guesses until
somebody plays. **We start with exactly the two the designer named**, in his
words, because a rule invented at a desk is worth less than a rule that came
from someone being bored:

- **all-in-a-row** — *"coins all in a straight line"*. Every coin at nearly the
  same height, or evenly spaced along one line: you run along and hoover them up
  without thinking. The level is a corridor.
- **never leaves the ground** — *"never leaving the ground"*. No part of the
  route needs any real climb, so the triple jump goes unused and the level is a
  walk.

Candidates, **not rules yet**. Each was offered to him and not picked, so each
waits for a real complaint before it costs anyone a re-roll:

- *no spike* — every dial sitting on the trend, the wallpaper level §4.5 warns
  about. Detectable (peak share barely above the mean), but generation already
  spends the budget unevenly, so this may never fire.
- *same job twice* — this level's spiked dial matching the previous level's.
  Generation already avoids repeating the job, which is the better place to fix
  it: a check can only reject, while generation can choose.
- *ferry you never need* — a mover the route never uses. Scenery pretending to
  be a mechanic.
- *too front-loaded* — the last coin two hops from the start and the other
  eighteen crammed in first.

### Discard and re-roll — bounded, deterministic, never failing

```
for attempt in 0 … 11:
    candidate = generate(level, seed + attempt)
    findings  = checkLevel(candidate)
    if no broken and no dull:  use it
    remember the best-scoring candidate
use the best-scoring candidate
```

Four properties this has to have, and each one is a decision:

1. **Bounded.** Twelve attempts, then take the best. Generating a level is a few
   hundred sums, so twelve is still under a frame — but "keep trying until it
   passes" is how a generator hangs for eight seconds on a phone, and it must
   not be possible for a run of bad luck to freeze the game between levels.
2. **Never fails.** Best-scoring, not first-passing, so there is always a level.
   A level with two `dull` findings still gets played; a level with a `broken`
   finding is only used if *every* attempt was broken, which means the generator
   is broken and the tests already knew.
3. **Deterministic.** The attempt number is part of the seed, so the discarded
   candidates are as fixed as the kept one. Level 7 is still always level 7, and
   "level 7 is boring" is still a reproducible claim.
4. **Scored, not just judged.** Each `dull` check contributes a weight, so the
   fallback can pick the least-bad. Pass/fail alone gives you no way to choose
   between twelve failures.

### The cost, which is real

**Adding a check changes the levels.** A new `dull` rule makes some level 7
candidate lose to a different one, and level 7 becomes a different level. That is
correct — it is the whole value of the library — but it means level numbers are
only stable *between* changes to the checker. That would silently invalidate
every best time, which is why §7 stops filing records under the level number.

**A `dull` rule is a guess, and a wrong one is worse than none.** A rule that
rejects most of the ladder is not taste, it is a bug: the test suite reports how
many of levels 4–200 each rule rejects, and a rule that fires on more than about
a quarter of them is rejected itself. New rules arrive one at a time, from
something a person actually said while playing — not invented in batches here.

## 7. Best times, without lying about which level they were set on

`Level` gains one optional field:

```ts
/** What the record book files this level under. Defaults to `name`. */
recordKey?: string
```

Hand-made levels do not set it and stay filed under their name exactly as today,
so saved times survive. Generated levels set **a short hash of the level's own
data** — the platforms, the coins, the movers.

This is the design the checker forced, and it is better than the level-number
key this plan had before:

- Change `worldSeed` → different levels → different keys → a clean record book,
  with the old world's records still sitting there if you change it back.
- Add a `dull` check, or change the draw order → level 7 becomes a different
  level → its old record does not follow it onto a level it was not set on.
- Change *nothing* → every key is identical → every record survives, which is
  the case that matters on an ordinary Saturday.
- Two levels that draw the same name do not share a record.

The trade, stated plainly: when a new check reshapes level 7, its "best time"
goes blank. That is honest — it is a new level — but somebody will notice their
record disappeared, so checker changes are worth batching rather than dribbling.

`GameScene` passes `level.recordKey ?? level.name` to `recordTime` /
`bestTimeFor`. That is the whole change to the timer.

## 8. Endless, and the two new buttons

`afterLevel(finishedIndex, levelCount)` gains the endless case: past the last
hand-made level there is always a next level. `game-complete` still happens after
level 3 — the YOU WIN! banner is kept, and the "press N" line under it now leads
into level 4 instead of nowhere. `TUNING.levels.endless = false` restores today's
game exactly.

Keyboard:

| key | now | after |
|---|---|---|
| `N` | next level, only on the banner | next level, **and skip at any time** |
| `R` | start over at level 1 | **play this level again** |
| `Shift+R` | — | start over at level 1 |

`R` moves because "play this one again" is the button a child reaches for twenty
times more often than "throw away the whole run". `progress.ts`'s banner text
changes with it, and its tests hold the touch lines to 34 characters — that limit
is real: the banner does not wrap and is cut off at both ends.

Phone: the top-right corner gains two more small buttons beside `↻`, along the
top edge away from both thumbs — `↺` play again, `⏭` skip. `↻` keeps its meaning
(start over at level 1). Three 22-radius buttons span about 150 px of a 960-wide
top strip, and the score is drawn top-left, so nothing collides.

Playing a level again replays it as arrived: `scene.restart({ levelIndex, points:
pointsOnArrival })`. `GameScene` already receives `points` on entry — it just has
to keep the number instead of only adding to it. Skipping records no time:
`recordTime` is simply not called on the way out.

New in `tuning.ts`:

```ts
levels: {
  /** Keep going forever after the hand-made levels? false = the old 3-level game. */
  endless: true,

  /** Change this and every level past 3 becomes a different level. A new world. */
  worldSeed: 1,

  /** How fast the ladder gets mean. Bigger = a gentler climb. */
  ramp: 8,
},

debug: {
  /** The skip button. Turn it off and the levels have to be played. */
  skipLevel: true,
},
```

## 9. Build order

1. **`reach.ts` + test.** Pin it to level 3's hand-worked numbers. Nothing else
   can be right until this is.
2. **`levelMeasure.ts` + test.** Run it over levels 1, 2 and 3 and assert the
   numbers in §4.2. This is the calibration, and it is also a genuinely useful
   tool for hand-made levels — it would have caught level 2's coin under the ▶
   button.
3. **`levelCheck.ts` + test**, `broken` rules only, run against levels 1–3:
   the hand-made levels must pass every hard check. A rule that fails level 3 is
   a wrong rule.
4. **`levelGen.ts` + test**, not wired into anything: every `broken` rule over
   levels 4–200, the determinism check, and the dials landing inside the bands
   §4.6 promises. This is the whole risk of the feature and it is provable in
   milliseconds.
5. **`levelFor()` and endless `afterLevel`** — the game now continues past 3.
6. **Play levels 4, 5, 12 and 25 by hand.** Expect to come back to §4.6's
   endpoints, especially the ~ ones. The first `dull` rules get written here,
   from what was actually annoying.
7. **The two buttons**: keys first, then the phone.
8. `pnpm check`, `pnpm test:e2e`, then README and IDEAS.

Steps 1–3 are worth having even if the rest is abandoned: "is this level
finishable, and where is its hardest jump" is a useful thing to ask about a
hand-made level too.
