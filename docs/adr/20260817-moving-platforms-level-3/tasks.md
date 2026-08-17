# Tasks — Moving platforms, and a level 3 built around them

## Current Status

- **State:** `[COMPLETE]`
- **Last updated:** 2026-08-17
- **Next action:** A person plays level 3 start to finish. See `review.md`.

Read `plan.md` for why each of these is shaped the way it is.

Order mattered in one place: **the mechanic was proven in a browser (task 6)
before the level was designed around it (task 7).** Designing a level for a ride
that does not work was the expensive mistake available here, and task 6 found
that the ride did not, in fact, work.

## Tasks

- [x] **1. The rule, test first.** `src/game/movingPlatform.test.ts`, then
      `src/game/movingPlatform.ts`. Watched it fail on a missing module first.
      13 cases; 141 unit tests green afterwards.
- [x] **2. The data.** `PlatformMotion` and the optional `moves` on `Platform`.
      Levels 1 and 2 typecheck untouched.
- [x] **3. The knob and the colour.** `platforms.movingSpeed`,
      `colors.movingPlatform`, and the second texture in `BootScene`.
- [x] **4. The wiring.** Own group, `directControl`, position set each frame
      from the level clock. `handleMovement` untouched, as planned.
- [x] **5. A throwaway moving platform** on level 1's first stepping stone.
- [x] **6. Prove the ride in a real browser.** **It did not work.** See the
      notes below. Fixed, then re-measured: the player travels
      44.38088888888865 to the ferry's 44.38088888888870.
- [x] **7. Level 3.** Built, screenshotted, played by keyboard, and reworked
      twice — see the notes. Throwaway from task 5 removed.
- [x] **8. Fix the browser test the third level breaks.** The level walk now
      goes 1 → 2 → 3 → `YOU WIN!`, with the same "nothing leaked across"
      checks on level 3, plus one that level 3 actually has movers in it.
- [x] **9. Browser tests for riding.** Two: a sliding platform carries him at
      its speed, and a lift carries him up and down without bouncing.
      `goToLevel` added to `tests/probe.ts` so they don't have to play two
      levels first.
- [x] **10. `pnpm check` and `pnpm test:e2e`.** 141 unit tests, 17 browser
      tests, clean lint and build.
- [x] **11. Words.** `IDEAS.md` and `README.md`.
- [ ] **12. Play it.** Every individual move in the level has been driven with
      real key presses and works. Nobody has yet played it start to finish with
      their hands, which is the one thing left.

## Notes as we go

- Task 0, before any of these: `pnpm check` green on an untouched worktree —
  128 unit tests, clean lint, clean build. So anything red from here is ours.

- **Task 6 found the ride broken, and the cause was one silently-defaulted
  number.** The platform moved correctly — right velocity, right direction,
  right collision — and the player stood in mid-air exactly where he got on.
  `friction.x` on the platform body was `0`. A Body's own default is `1`, but
  `PhysicsGroup.js` defaults `frictionX` to `0` and stamps it onto every body it
  creates, and these platforms come from a group. Adding `frictionX: 1` to the
  group config fixed it. This is why the task existed.

- **The vertical case needed no code at all**, which the plan guessed and this
  measured: over a 4.3-second ride including the turnaround at the top, the
  player travelled 217.4 to the lift's 216.3, drifted at most 4.5 pixels from
  the deck, and landed once.

- **The lift test's first measure was wrong.** It counted landings, and got 8 on
  a loaded laptop while the ride was perfect — a dropped frame gives him one
  long fall, and `player.bounce` turns that into a real bounce on any platform,
  moving or not. It now measures the share of frames his feet are on the deck,
  which a dropped frame barely dents and genuine bouncing halves.

- **Level 3 was wrong twice, and both were about boarding the ferry**, which
  three keyboard playtests found and no amount of staring at coordinates would
  have:
  1. Parked in the middle of the hole, there was about a third of a second in
     every eight when a jump from the edge could reach it.
  2. Parked over the ground so he could board from a standing start, it sat ten
     pixels above his head — so jumping bonked him on its underside. A platform
     you are standing under is a ceiling, not a lift.
  It now waits five pixels past the end of the ground: never overhead, always
  within one jump, with about a second and a third of window.

- **A free coin.** Level 3 opened on `COINS 1/13` because a coin sat exactly on
  the player's start position.
