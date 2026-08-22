# Tasks — Levels that never run out

## Current Status

- **State:** `[BUILT, NOT YET PLAYED]`
- **Last updated:** 2026-08-22
- **Next action:** Task 12 — play levels 4, 5, 12 and 25.

Read `plan.md` for why each of these is shaped the way it is, and `README.md`
for what was decided and by whom.

Order mattered in two places, and one of them was learned the hard way.

**The tape measure came before the generator** (tasks 2 and 3 before task 4).
Everything this feature claims — "level 4 is a breather", "the late ladder is
about waiting, not jumping" — is a claim about a number, and until something
could measure a hand-made level those numbers were guesses. Task 2 measured the
three levels a person built and disagreed with the plan four times.

**The buttons came before playing it** (task 8 before task 12, swapping the
plan's steps 6 and 7). Level 12 is nine levels past where the old game stopped.
Without a skip button you cannot get there to look at it.

## Tasks

- [x] **1. How far can he actually jump.** `src/game/reach.test.ts`, then
      `src/game/reach.ts`. Written first, watched fail on a missing module. It
      has to reproduce the numbers a person worked out by playing and wrote at
      the top of `level3.ts`: 113 pixels up in one jump, 225 in two, 338 in
      three, about 190 sideways. It does, to the pixel.
- [x] **2. A tape measure for a level.** `src/game/levelMeasure.ts` + 27 tests.
      Run over levels 1, 2 and 3 — and **it disagreed with the plan**, which is
      the whole reason it exists. See the notes.
- [x] **3. The checker.** `src/game/levelCheck.ts` + 36 tests. Eleven *broken*
      rules, covering every line of `spec.md`'s never-list, and exactly two
      *dull* rules — the two he named, and no others. **It found a real thing
      in level 2 the first time it was run**, which is the note below.
- [x] **4. The builder.** `src/game/levelGen.ts` + 33 tests. Not wired into
      anything yet: level number in, a level out, and every level from 4 to 200
      checked in milliseconds without a browser.
- [x] **5. Three people attacked it.** Can a child finish these, is level 7
      really always level 7, and do they look like anything. Three real bugs,
      all fixed at the construction rather than by adding a check — a broken
      level should be impossible to build, not merely thrown away afterwards.
      Their other findings were judgement calls — each one would move a number
      the ADR argues about — so they are written down in `plan.md` §6 instead of
      being quietly changed.
- [x] **6. The game stops ending.** `levelFor()` in `src/levels/index.ts`,
      the endless case in `afterLevel`, and the `levels` and `debug` blocks in
      `tuning.ts`. `GameScene` asks `levelFor(i)` instead of reaching into a
      list, and files best times under `recordKey`.
- [x] **7. Best times that do not lie.** A generated level is filed under a
      short hash of its own ledges and coins, not its number — so changing
      `worldSeed`, or adding a check, does not hand a new level somebody else's
      record.
- [x] **8. The two buttons.** Keys first (`R` plays this level again,
      `Shift+R` starts over, `N` skips at any time), then the phone: `↺` and
      `⏭` beside `↻` along the top edge, away from both thumbs.
- [x] **9. Prove it in a real browser**, in `tests/smoke.spec.ts`. Skip into
      level 4 and check it is a real place: a made-up name in the HUD, every
      ledge and every coin actually drawn, Pip standing on something instead of
      falling through the world, a coin that really scores, and a finish. Plus: play level 4 again and get
      back *the same level 4*, coin for coin.
- [x] **10. The gate.** `pnpm fix`, `pnpm check`, `pnpm test:coverage`,
      `pnpm test:e2e`. 317 unit tests, 26 browser tests, 100% coverage of
      `src/game/`, clean lint, clean build.
- [x] **11. Words.** This package, `README.md` and `IDEAS.md`.
- [ ] **12. Play it.** Levels 4, 5, 12 and 25, with the nine-year-old holding
      the keyboard. **This is the only step that can say whether any of it is
      fun**, and it is why the ADR is still `Proposed`.

## Notes as we go

- **The tape measure disagreed with the plan four times, and the plan was
  wrong every time.** Hops to the furthest coin were written as 3/5/3 and
  measure 5/8/6 — it counts the drop off the spot he starts in, and it follows
  the *kindest* route rather than the shortest, so level 1's reward ledge is
  four easy hops round the stepping stones rather than one lunge. Level 3's
  forced rides were written as 6 of 13 and are 10: level 3 hands you nearly
  every coin off a moving deck. Level 3's tightest boarding window was written
  as about 1.1 seconds and is 2.3. Level 2's fall cost was 2 hops and is 3.
  `plan.md` §4.4 now carries the measured numbers, and says plainly that two of
  its gentle endpoints came loose as a result — correcting *those* moves every
  level on the ladder, so it waits for task 12.

- **The headline argument survived being measured, which is the good news.**
  The hardest jump anywhere in the hand-made game asks for a third of a triple
  jump — 0.355, 0.316, 0.243 — and *level 3, the hardest level to play, has the
  kindest jumps of the three*. Its difficulty is waiting and commitment, not
  distance. Every generated level is built on that.

- **The checker's first run found a coin under a thumb.** Level 2's free coin,
  the one right where you start, is nine pixels from the middle of where a
  phone draws ▶. It has been there since level 2 was built. It is left exactly
  where it is — levels 1–3 are not this feature's to touch — and the test
  asserts the finding as it stands today, so whoever decides to move that coin
  gets a red test telling them to come here first.

- **Two rules had to be narrowed, because the first version of each rejected
  level 3.** A rule that rejects level 3 is a wrong rule, and both were:
  1. *A ledge you cannot see under a phone button.* Every level's ground runs
     under ◀ ▶ ▲, and level 3's lift passes straight through ▲. The complaint
     that survives is "you have to land on a ledge you cannot see", which means
     a ledge swallowed **whole** by a button, not one that clips it.
  2. *A deck parked over your head.* Level 3's lift is parked above the far
     ground and that is exactly how you board it. The rule that means something
     is about a deck over **where you start**, which is the mistake `level3.ts`
     made and fixed.

- **Three real bugs in the builder, all about Pip's body rather than his jump.**
  Every one of them produced a level that looked perfectly fine as a list of
  numbers:
  1. **A ledge standing in the spot he drops into**, 54 of levels 4 to 200. The
     physics shoves him out of it on the first frame, before anyone touches a
     key.
  2. **Ledges stacked closer together than he is tall.** Harmless at today's
     numbers. Set `jumpVelocity: 400` and `gravity: 2400` together and it walls
     off half a level, with the coins up there behind it — and nothing looked
     wrong. He is 48 tall, so a deck needs 48 of clear air over it before it is
     somewhere to stand.
  3. **A bridge measured to the very last pixel of a jump, and then nudged eight
     sideways.** The far bank ends up out of reach and all twelve tries come
     back broken. The bridge now pays for its own nudge before it measures.
  After the fixes, and re-run once more at the end: **26,838 generated levels**
  — nine sets of tuning numbers (including a doubled jump, frozen ferries, a
  feeble jump under heavy gravity and huge phone buttons) across six worlds,
  levels 4 to 500 of each — with no broken finding and nothing thrown in any of
  them.

- **The ferries had to be timed twice, and that is a step the plan did not
  have.** The builder gives each ferry a window for a jump from the ledge it had
  in mind; the tape measure then walks the finished level and often finds a
  kinder place to jump from, further away, where the same ferry is harder to
  catch. Four levels came out broken that way, with windows under a second
  against a 1.6-second design. The fix is exact rather than a search — how long
  the chance lasts is the trip time times the slice of the trip the deck is in
  reach for, and that slice does not change when the trip slows down — so one
  scaling lands it. This is `tuneTheFerries`, step **h** in `plan.md` §5, and
  it is the difference between "the ferry is hard to catch" and "the level
  cannot be finished".

- **A ferry that is the only way across a hole gets a longer window than the
  dial asks for.** The timing dial's hard limit is 0.7 seconds, which is a fair
  thing to ask of a lift you can simply wait for again. Asking it of the only
  way over a canyon is not difficulty, it is a level that stops. Crossings get
  at least 1.6 seconds; everything else gets what the dial says.

- **The dice live at the top of `levelGen.ts`, not in a `random.ts` of their
  own** as the plan said. A third copy of four lines beat a fourth file that
  would have needed a test file of its own to keep coverage honest. Two warm-up
  rolls were added, because an LCG's very first number sits close to its seed
  and neighbouring levels came out looking alike.

- **Every level's *job* is drawn from the level number alone**, never from which
  try this is, and it is always a step on from the level before it. So "never
  the same job twice running" is true by construction with nothing to remember,
  and throwing a boring level away never changes what the level is *about*.

- **The re-roll loop is barely used.** All 197 first drafts of levels 4 to 200
  come back clean — no broken finding, no dull finding. Both of his dull rules
  reject none of the ladder. That is either a well-behaved builder or two rules
  that never bite, and task 12 is how we find out which.

- **`R` changed meaning, and that is deliberate.** It used to throw the whole
  run away and go back to level 1. It now plays the level you are on again,
  because that is the button a child reaches for twenty times more often.
  Starting over moved to `Shift+R`, and the finish banner says so.

- **The checker has no idea the HUD is there.** Coins are kept out from under
  the phone's buttons and not from under the score, the level name and the
  clock — about 65 coins in levels 4 to 40 sit behind that writing. Found while
  writing this file, verified, and deliberately not fixed here: adding a rule
  reshuffles every made-up level and blanks its best time, which is a change to
  make on purpose and in one batch. It is in `IDEAS.md` and in `plan.md` §6.

- **Level 4 is not the breather the spec promised.** `spec.md` says seven or
  eight coins; it comes out with about nineteen. The difficulty curve — written
  *after* measuring the hand-made levels — is what the code follows, and the
  curve hands level 4 fourteen or more. Which of the two is right is a question
  for somebody playing it, and it is the first thing to look at in task 12.
