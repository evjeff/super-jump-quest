# Sound effects are synthesized in code, not shipped as audio files

- **Date:** 2026-08-16
- **Status:** Accepted

## Context

The first two sound ideas on the list — a coin ding and a jump boing — needed a
way to make noise. The obvious route is what every tutorial does: find or record
`.wav` files, commit them to `public/`, load them in a preload step, play them by
key.

That route has costs this repo is unusually sensitive to:

- **Binary blobs in a public repo.** Free game-audio packs carry licence terms
  that nobody re-reads a year later, and `main` publishes to a public URL.
- **A loading step that can fail.** Everything else in this game is drawn in code
  at boot (`BootScene` generates the sprites), so today there is no asset
  pipeline to get wrong — no 404, no decode error, no preloader.
- **An unreviewable diff.** A changed `.wav` is invisible in review, and "make it
  sound higher" means finding new audio rather than editing a number.
- **Nothing to unit test.** A file-based sound is either found or not found;
  there is no rule to check in milliseconds.

The counterweight is that synthesized beeps sound like 1980, not like a modern
game. For a game whose sprites are coloured rectangles, that is the house style.

## Decision

Sounds are **recipes plus a player**, split along the same line the rest of the
repo already uses.

**`src/game/sounds.ts` — pure data.** A sound is a list of notes, each one "start
at this pitch, slide to that pitch, over this long, this loud, after this delay".
No browser, no Phaser, no noise. Unit tested like any other rule, including the
invariant that no recipe contains a zero, because Web Audio's exponential ramps
blow up on zero and would fail silently in production.

**`src/audio/beeper.ts` — the only file that knows a speaker exists.** It turns a
recipe into oscillator and gain nodes. Replacing synthesis with recorded audio
later means rewriting this one file and nothing else.

**A third directory rather than a home in `game/` or `scenes/`.** `game/` must
stay free of browser APIs, and the beeper is not a Phaser scene. `src/audio/` is
the smallest honest place for it.

**Borrow Phaser's `AudioContext` instead of creating one.** Browsers keep audio
asleep until the player presses something, and Phaser already handles that
wake-up. Using its context and destination node means the unlock, the master
volume and the master mute all keep working, and the beeper falls back to doing
nothing on a browser where Phaser found no audio at all.

**One number to mute.** `TUNING.sound.volume` at `0` returns a beeper that does
nothing, so silence is a knob in the control panel rather than a code path.

## Consequences

**Good**

- No asset files, no licences, no loading step, no 404s. `git clone` and the
  game has sound.
- "Make the coin sound higher" is a number edit in a commented file, and the diff
  says what changed.
- The pitch of a jump can depend on which jump it is — the triple jump plays a
  rising ladder — which recorded clips would need three separate files to do.
- Sound rules are unit tested, and one Playwright test proves notes actually
  reach the browser, which no unit test can.

**Bad / accepted**

- It sounds like a 1980s arcade. That matches the rectangles-for-sprites art, but
  it is a ceiling: this approach will never produce a satisfying "thump".
- Web Audio's scheduling is unforgiving. Zero and negative values throw, so the
  recipes carry a test guarding against them.
- Anything asleep stays silent: no sound plays before the player's first key
  press, and the landing thud on the very first spawn may be missed.
- Music is out of scope. A background track is a file, and this decision does not
  cover it.

**Revisit if**

- Someone wants real recorded artwork-quality audio, or background music. At that
  point `src/audio/beeper.ts` gains a sibling that loads files, and the recipes
  in `src/game/sounds.ts` become the fallback rather than the whole story.
