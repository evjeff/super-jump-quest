# Tasks — Moving platforms, and a level 3 built around them

## Current Status

- **State:** `[IN PROGRESS]`
- **Last updated:** 2026-08-17
- **Next action:** Task 1.

Read `plan.md` for why each of these is shaped the way it is.

Order matters in one place: **the mechanic is proven in a browser (task 6)
before the level is designed around it (task 7).** Designing a level for a ride
that does not work is the expensive mistake available here.

## Tasks

- [ ] **1. The rule, test first.** `src/game/movingPlatform.test.ts`, then
      `src/game/movingPlatform.ts`. Watch it fail before making it pass.
      Cases: a platform with no `moves` never leaves home; at `seconds` it is at
      the far end; at `2 × seconds` it is home again; halfway out it is halfway;
      it keeps going back and forth long after the first trip; `startAt` shifts
      where in the trip it begins; `moveY` works the same as `moveX`; a
      negative distance goes the other way; both at once moves it diagonally.
- [ ] **2. The data.** `PlatformMotion` and the optional `moves` on `Platform`
      in `src/levels/index.ts`, commented for a kid. Nothing else changes —
      levels 1 and 2 still typecheck untouched.
- [ ] **3. The knob and the colour.** `platforms.movingSpeed` and
      `colors.movingPlatform` in `src/tuning.ts`; the second texture in
      `BootScene`.
- [ ] **4. The wiring.** `GameScene` builds moving platforms into their own
      group with `directControl` on, colliding with the player, and sets each
      one's position every frame from the level clock. `handleMovement` is not
      touched.
- [ ] **5. A throwaway moving platform** somewhere harmless, so tasks 6's
      browser check has something to stand on before level 3 exists. Removed at
      the end of task 7.
- [ ] **6. Prove the ride in a real browser.** `pnpm dev`, stand on a sliding
      platform, and confirm he is carried **at its speed, not twice it** — the
      failure the plan warns about looks like sliding off the front. Then a
      rising one and a falling one: no bouncing, no stuttering, no repeated
      landing thud. **If riding does not work, stop and fix it here**, before
      any level is built on it.
- [ ] **7. Level 3.** `src/levels/level3.ts` and its line in `LEVELS`, built to
      the sketch in `plan.md`, then played and adjusted until it is beatable and
      fun. Remove the throwaway from task 5.
- [ ] **8. Fix the browser test the third level breaks.** Extend the level walk
      in `tests/smoke.spec.ts` through level 3, with the same "nothing leaked
      across" checks it already makes on level 2.
- [ ] **9. A browser test for riding.** In the running game: a moving platform
      changes position, and a player standing on it moves with it **without a
      key being pressed**. Expose what it needs on `GameProbe` in
      `tests/probe.ts`. This is the guardrail that catches the mechanic quietly
      dying — the unit tests would still be green.
- [ ] **10. `pnpm check` and `pnpm test:e2e`.** Both green, with output shown.
      Coverage on `src/game/` still over its thresholds.
- [ ] **11. Words.** `IDEAS.md` (moving platforms out of Someday, level 3 into
      Done, in language a kid recognises), `README.md` (three levels, the new
      knob in the tuning table).
- [ ] **12. Play it.** Someone finishes level 3 with their hands. Then flip the
      ADR to `Accepted` and write `review.md`.

## Notes as we go

_(Findings, surprises and things that turned out differently go here.)_

- Task 0, before any of these: `pnpm check` green on an untouched worktree —
  128 unit tests, clean lint, clean build. So anything red from here is ours.
