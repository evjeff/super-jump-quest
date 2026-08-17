# Review — Moving platforms, and a level 3 built around them

## Current Status

- **State:** `[COMPLETE]`
- **Last updated:** 2026-08-17
- **Next action:** One human playthrough of level 3. See "Still open".

## What was checked

| Check | Result |
|---|---|
| `pnpm check` (typecheck, lint, unit tests, build) | Green. 141 unit tests, up from 128. |
| `pnpm test:e2e` | Green. 17 browser tests, up from 15. Run four times over, no flakes. |
| Coverage on `src/game/` | Still over its thresholds; `movingPlatform.ts` has 13 cases. |
| Levels 1 and 2 | Unchanged files. Their tests and the phone tests pass untouched. |
| Riding, sideways | Player travels 44.38088888888865 to the ferry's 44.38088888888870. |
| Riding, up and down | 217.4 to the lift's 216.3 across a turnaround, ≤4.5px drift, one landing. |
| Every jump in level 3, by keyboard | Boarding the ferry, lift → shelf, shelf → sky ferry: all landed. |

## What the checks found

Three real defects, none of which any amount of reading would have caught:

1. **The ride did not work at all.** `friction.x` was `0` on the platform
   bodies. A Body defaults it to `1`, but a physics **group** defaults it to `0`
   and stamps that onto everything it makes. The platform slid and the player
   stood in mid-air. Fixed with an explicit `frictionX: 1`, commented as
   load-bearing, and guarded by a browser test.
2. **Level 3's ferry could not be boarded.** Twice. Parked in the middle of the
   hole the window was a third of a second in every eight; parked over the
   ground it sat above his head, so jumping bonked him on its underside. It now
   waits just past the end of the ground, with a window of about 1.3 seconds.
3. **A free coin** sitting exactly on the player's start position, so level 3
   opened on `COINS 1/13`.

One near-miss worth recording: the first draft of `plan.md` called for carrying
the rider by hand, on top of the carry Phaser already does. That would have
moved him at twice the ferry's speed and dropped him off the front. It was
caught by reading `ProcessY.js` before writing the code.

## What was deliberately not done

- **No easing, pauses, or paths with corners.** One straight there-and-back at a
  constant speed. Anything else is a new decision and a new record.
- **Levels 1 and 2 were not retrofitted** with moving platforms. They work.
- **The triple-jump shortcut to the top shelf was left in.** A player who can
  chain three jumps from the right-hand ground can reach the shelf without the
  lift. They still can't reach the lift's coins without riding it, and a
  shortcut somebody discovers is a delight rather than a defect.
- **The carry is not hand-written.** See the ADR; doing it as well as Phaser
  does it is a bug, not a belt and braces.

## Still open

- **Nobody has played level 3 start to finish with their hands.** Every
  individual move in it has been driven with real key presses and works, and a
  browser test walks all three levels, but that is not the same as a person
  finding out whether it is fun, whether the waiting drags, or whether the
  purple/blue distinction reads at speed. That is task 12, and it is the one
  thing that can't be automated.
- **If the waiting drags,** the first thing to reach for is
  `platforms.movingSpeed` in `tuning.ts` rather than the level file — it moves
  every platform at once and is meant to be played with.
- **The carry depends on Phaser's Arcade separation** and on a group-config
  number that defaults to off. A Phaser upgrade could change either; the two
  riding tests are what turn that into a red test rather than a dead level.
