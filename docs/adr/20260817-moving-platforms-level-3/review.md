# Review — Moving platforms, and a level 3 built around them

## Current Status

- **State:** `[COMPLETE]`
- **Last updated:** 2026-08-17
- **Next action:** Play level 3 again now the ride is rebuilt. See "Still open".

## What was checked

| Check | Result |
|---|---|
| `pnpm check` (typecheck, lint, unit tests, build) | Green. 147 unit tests, up from 128. |
| `pnpm test:e2e` | Green. 18 browser tests, up from 15. Run five times over, no flakes. |
| Coverage on `src/game/` | Still over its thresholds; `movingPlatform.ts` has 19 cases. |
| Levels 1 and 2 | Unchanged files. Their tests and the phone tests pass untouched. |
| Riding, sideways | His place on the deck does not move at all — under 1px over a full crossing. |
| Riding, through three jumps | Under 2px, from a hundred per jump before the ride was rebuilt. |
| Riding, up and down | 217.4 to the lift's 216.3 across a turnaround, ≤4.5px drift, one landing. |
| Every jump in level 3, by keyboard | Boarding the ferry, lift → shelf, shelf → sky ferry: all landed. |
| **Played by a person** | Once. It rejected the ride — see below. Not played again since the rebuild. |

## What playing it found

**One defect, and the most valuable one: the ride felt wrong.** *"My character
slides to one of the ends of the platform."*

Every test was green. The carry was exact to thirteen decimal places. It was
also only true while his feet were on the deck — Phaser carries a passenger
during collision separation and at no other time, and a jump is nearly a second
of no separation. At a ferry's 123 pixels a second that is a hundred pixels of a
hundred-and-seventy-pixel deck, per jump. Two jumps and you are off the back,
having pressed nothing.

This is the entry to re-read before writing another test: no measurement taken
here would ever have caught it, because every one of them measured a player
standing still. The report came from a person holding the arrow keys.

The rebuild — the ride now survives a jump — is in the ADR, and it took two
wrong turns worth remembering: handing him the platform's *speed* rather than
its *step* (drifts under load, nothing corrects it), and ending the ride on
`touching.down` (true for stray frames mid-fall, put the drift straight back).

## What the checks found

Three real defects, none of which any amount of reading would have caught:

1. **The ride did not work at all.** `friction.x` was `0` on the platform
   bodies. A Body defaults it to `1`, but a physics **group** defaults it to `0`
   and stamps that onto everything it makes. The platform slid and the player
   stood in mid-air. Fixed at the time with an explicit `frictionX: 1` — and
   then set deliberately back to `0` after the playtest above, because the
   engine's carry turned out to be the wrong one. Both values have now been a
   bug here, in opposite directions, which is worth knowing before touching it.
2. **Level 3's ferry could not be boarded.** Twice. Parked in the middle of the
   hole the window was a third of a second in every eight; parked over the
   ground it sat above his head, so jumping bonked him on its underside. It now
   waits just past the end of the ground, with a window of about 1.3 seconds.
3. **A free coin** sitting exactly on the player's start position, so level 3
   opened on `COINS 1/13`.

One near-miss worth recording: the first draft of `plan.md` called for carrying
the rider by hand, *on top of* the carry Phaser already does. That would have
moved him at twice the ferry's speed and dropped him off the front. It was
caught by reading `ProcessY.js` before writing the code. The hand-written carry
is what the game ended up with — but instead of Phaser's, never alongside it.

## What was deliberately not done

- **No easing, pauses, or paths with corners.** One straight there-and-back at a
  constant speed. Anything else is a new decision and a new record.
- **Levels 1 and 2 were not retrofitted** with moving platforms. They work.
- **The triple-jump shortcut to the top shelf was left in.** A player who can
  chain three jumps from the right-hand ground can reach the shelf without the
  lift. They still can't reach the lift's coins without riding it, and a
  shortcut somebody discovers is a delight rather than a defect.
- **The rider is not carried vertically the way he is carried sideways.** Jump
  off a rising lift and it leaves without you. Nobody has complained about that,
  and the collision handles standing on one perfectly well.

## Still open

- **Level 3 has not been played since the ride was rebuilt.** It was played
  once, which is how the drift was found; the fix has been measured but not
  felt. Nobody has yet played it start to finish either — whether the waiting
  for a ferry drags, and whether purple-means-it-moves reads at speed, are still
  open questions that no test answers.
- **If the waiting drags,** the first thing to reach for is
  `platforms.movingSpeed` in `tuning.ts` rather than the level file — it moves
  every platform at once and is meant to be played with.
- **`frictionX: 0` is invisible and essential.** Someone tidying it away, or
  adding a second carry "to be safe", gets double speed off the front of the
  ferry. The three riding tests are what turn that into a red test rather than a
  level nobody can cross.
