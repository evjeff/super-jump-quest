# The game plays on a phone with drawn-on buttons, held sideways

- **Date:** 2026-08-16
- **Status:** Accepted

## Context

The game was keyboard-only. On a phone it booted, drew itself, and then sat
there: nothing to press, no way to move, and a finish banner asking for an `N`
key that doesn't exist. "Touch controls so it works on a phone" had been sitting
in `IDEAS.md` since the beginning, and a phone is the machine a kid can actually
reach on a Saturday morning.

Three separate problems hide inside "make it work on a phone", and they have
different answers:

1. **No keys.** Something has to stand in for left, right, jump, `N` and `R`.
2. **The wrong shape.** The game is a fixed 960 × 540 picture. A phone held
   upright is roughly the opposite shape, and squeezing 16:9 into it leaves a
   letterbox slot about a fifth of the screen tall.
3. **The browser fights you.** A finger that means "jump" also means scroll the
   page, pull down to refresh, double-tap to zoom, and select the text.

## Decision

**Four drawn buttons, on top of the game.** `◀ ▶` bottom-left for the left
thumb, a bigger `▲` bottom-right for the right thumb, and a small `↻` in the
top-right corner. They are painted on the glass rather than in a strip beside
the game, because a strip would cost height that the picture needs — and height
is exactly what a phone held sideways has least of. They are see-through rings
with a faint middle so you can watch him run straight through one.

The top-right corner for restart is the one place neither thumb reaches by
accident; the top-left was already taken by the score and clock.

**The rules are pure, in `src/game/touchControls.ts`.** Where the buttons go,
whether a point is on one, and whether a button went down *this frame* are all
plain functions with no Phaser and no browser, unit tested like every other
rule. `src/scenes/TouchPad.ts` draws them and reads the fingers. Same split as
`game/` versus `scenes/` everywhere else.

**Fingers are re-read every frame rather than tracked as press/release
pairs.** A finger that slides off a button, leaves the screen at the edge, or is
interrupted by a notification never sends the matching "came up" event. Tracking
pairs means a button can stick down, and a stuck `▶` walks him off the world
with nothing on screen to explain why. Asking "which buttons is a finger on
*right now*" every frame makes that state unreachable rather than unlikely.

**Two thumbs at once is a requirement, not a nicety.** Running and jumping
together is how every gap in level 2 is cleared, so the game config raises
`input.activePointers`, and the Playwright test drives Chrome's touch input
directly to prove two fingers land on two buttons. Playwright's own
`touchscreen.tap` can only do one instant tap and would have proved nothing.

**Held upright, the game asks to be turned sideways.** A full-screen nudge with
a phone shape that animates the turn, so it works before you can read. The game
**sleeps** underneath it rather than being torn down, so turning back picks up
mid-jump. Sleeping matters: nothing shows through that card, so a running game
behind it draws sixty pictures a second that nobody will ever see, and a phone
left face up does that all afternoon. It also stops the level clock, which is
the answer you want anyway — turning your phone should not cost you a best time.
The phone shape is drawn in CSS rather than written as 📱: a missing emoji font
renders an empty box, which is what happened the first time.

**On-screen buttons appear only for a coarse pointer.** That's the real
question — a finger, not a mouse. Keys still work everywhere, so a laptop with a
touchscreen gets both and can use whichever is nearer.

**The finish banner asks for what this player has.** `bannerText` takes a
control hint, so a phone reads "tap the screen for level 2" and never "press N".
A tap anywhere carries on; `↻` stays visible on the banner because on a phone it
is the only route back to level 1. Taps are ignored for the first 400ms, because
winning usually leaves a finger already on the jump button and the next press of
it would otherwise wipe away a "NEW BEST TIME!" nobody had time to read.

**Sizing moved into CSS.** `#game` is sized to the right shape by the page, and
Phaser fits the picture into it. On a computer it stops at its natural 960 wide
so the pixels stay crisp; on a phone that cap is lifted and it fills the screen.

## Consequences

**Good**

- The game is playable on the machine a kid can actually reach, with no app to
  install and nothing to configure.
- The layout and hit-testing rules are unit tested in milliseconds, and a
  Playwright project on a real phone screen size proves genuine two-thumb play,
  which is the part no unit test can see.
- A button physically cannot stick down.
- Nothing about the keyboard game changed. Desktop looks and plays exactly as
  before.
- `bindKeys` no longer throws on a device with no keyboard — it just returns,
  and the on-screen buttons take over. That was a black screen waiting to
  happen on precisely the device this ADR is about.

**Bad / accepted**

- The buttons cover part of the level. Level 2's first coin sits under `▶`.
  They are see-through, and they never block anything — a finger on a button is
  not a finger in the game world — but the picture is busier than it was.
- Portrait is refused rather than supported. Playing without turning the phone
  would mean a picture half the size, or a second level layout, and one layout
  that works is worth more here than two that need maintaining.
- Turning the phone upright mid-run stops the game dead. That is deliberate, but
  it does mean a rotate is a way to pause, which a stopwatch purist could call
  cheating. For a game whose whole audience is one child, that is fine.
- On a very wide phone (many are nearer 2.4:1 than 16:9) there are black bars
  down both sides. Filling them means redesigning both levels.
- `user-scalable=no` turns off pinch zoom. For a game that already scales itself
  this only ever moves the buttons out from under your thumbs, but it is a
  blunt instrument and it applies to the whole page.

**Revisit if**

- Someone wants to play in portrait. That's a second layout — game on top,
  buttons in the space below — and it supersedes the nudge.
- The buttons covering the level starts to matter. The fix is level design
  (keep the bottom corners clear) rather than more code.
- A gamepad shows up. `touchControls.ts` answers "which control is being asked
  for", which is the same question a gamepad asks, but nothing here assumes it.
