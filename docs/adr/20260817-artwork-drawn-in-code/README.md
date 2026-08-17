# Artwork is drawn in code, not shipped as image files

- **Date:** 2026-08-17
- **Status:** Accepted

## Context

The ask was "real artwork for the character and the background, and he should
look happy". Until now the player was a yellow rectangle and the sky was one
flat colour — `BootScene` generated both, and its own comment said that when
real artwork arrived it should be replaced by PNGs in `public/`.

Four characters and three backgrounds were drawn up and reviewed together before
anything was committed. The characters were Pip (a pixel-art kid in a cap),
Sunny (a smooth cartoon star), Bounce (a jellybean blob) and Ember (a pixel fox
cub); the skies were Midnight Hills, Sunset Ridge and Cloud Kingdom. **Pip and
Midnight Hills were chosen.** Those alternatives are not in the repo — the point
here is only that the choice was made from a real set, not by default.

The obvious way to ship the winner is the tutorial way: export a PNG sprite
sheet and a background image, commit them to `public/`, load them in a preload
step. That route carries the same costs the sound-effects ADR already weighed
and rejected for audio:

- **Binary blobs in a public repo.** Sprites from an asset pack or an image
  generator carry licence terms nobody re-reads a year later, and `main`
  publishes to a public URL.
- **A loading step that can fail.** Nothing in this game is loaded today. There
  is no preloader, no 404, no decode error, and no black screen caused by a
  missing file.
- **An unreviewable diff.** A changed PNG is invisible in review. "Make his cap
  green" means opening an image editor, and the diff says `Binary files differ`.
- **Nothing to check without a browser.** An image is either found or not found.

The counterweight is real and worth stating plainly: drawn-in-code art has a
ceiling. There is no texture, no shading beyond flat colour, and no frame-by-frame
animation. It buys editability at the cost of everything a painted sprite can do.

There is also no drawing tool in this workflow to produce a PNG with, so
"drawn in code" was additionally the only route that could actually deliver
today rather than becoming a shopping trip.

Note that this changes a premise the sound-effects ADR relied on — it justified
1980s beeps partly because the sprites were coloured rectangles. The sprites are
no longer rectangles. That ADR is history and stays as written; the beeps are
still what this game sounds like.

## Decision

Artwork is **shape data plus a drawer**, split along the line this repo already
uses for sounds and for levels.

**`src/game/pipSprite.ts` — the character, as plain data.** Pip is 24 rows of 16
letters; one letter is one square, a dot is see-through. Drawn 2 pixels per
square he comes out exactly 32 x 48.

Putting a sprite in `game/` stretches that directory's description — it holds
rules, and a picture is not a rule. It earns its place on the property that
actually matters there: it is pure, it imports in plain Node, and so it can be
checked in milliseconds. That matters more here than the label, because the
failure mode is silent. A row typed 15 letters long doesn't crash anything; it
quietly draws him wrong. `pipSprite.test.ts` asserts the grid is 24 x 16, that
every letter used has a colour, and that every colour it asks for exists in
`tuning.ts`.

**`src/tuning.ts` — what the colours are.** `colors.pip` names each part of him
(cap, capBrim, skin, blush, eye, highlight, mouth, shirt, overalls, trousers,
shoes) and `colors.night` names each part of the sky. "Give him a green cap"
stays a one-number edit, which is the promise the whole tuning file makes.

**`src/scenes/BootScene.ts` — the only file that draws.** It reads the grid and
the colours and bakes them into textures. It was already the art file; it stays
the art file.

**The sky is baked once into a 960 x 540 texture.** Gradient, 110 stars, moon,
halo and three rows of hills are all drawn at boot and never again. Playing
costs one picture on the screen, the same as the flat colour did, so detail in
the sky is free at play time even though it is not free to draw.

**The stars are scattered by a fixed number pattern**, not by chance, so the sky
is identical on every run. A sky that rearranged itself on each restart would be
distracting rather than atmospheric.

**One texture, not two.** The `player` texture is now Pip and is still exactly
32 x 48, so the invisible box Arcade collides with is byte-for-byte the same as
the rectangle's. `GameScene` already used one texture for both the physics body
and the drawn skin; it needed no change for the character at all, and one line
for the sky.

## Consequences

**Good**

- No asset files, no licences, no loading step, no 404s. `git clone` and the
  game has artwork.
- Every colour is a commented number in the control panel, and changing one
  shows up in the diff as a changed number.
- The *shape* is reviewable too. A change to Pip's grid reads as ASCII art in
  the diff — you can see the new hat in the pull request.
- Gameplay is untouched. The collision box, the landing squash, the left/right
  flip and the moving-platform rides all carry over with no change, because
  nothing about the sprite's size or origin moved.
- A mistyped sprite is caught by a unit test in milliseconds rather than by
  someone noticing on a Saturday.

**Bad / accepted**

- **No animation.** Pip has one pose. He slides rather than walks, and he
  doesn't blink. A walk cycle means more grids and a frame timer, and that work
  has not been done.
- **The ceiling is low.** Flat colours, hard edges, no shading or texture. This
  approach will never produce painted artwork, only a tidy pixel sprite.
- **Hand-editing a grid is fiddly** beyond a simple character. 24 rows of 16 was
  comfortable; a 64 x 64 sprite would not be.
- **The moon's halo is a stack of 34 faint circles** standing in for a radial
  gradient, which Phaser's shape drawing doesn't offer. It looks smooth at these
  colours; a much brighter moon on a much darker sky could band again, and the
  fix is more rings.
- **The sky texture is fixed at 960 x 540**, matching the fixed world size. A
  level that scrolled would need this rethought.
- The three characters and two skies that lost are not in the repo. Switching to
  one of them means drawing it again.

**Revisit if**

- Someone wants him to animate — a walk cycle, a blink, a jump pose. That is the
  point where frames, and possibly a real sprite sheet, start to earn their keep.
- A level needs to scroll, or the game needs art at a size where a hand-typed
  grid stops being reasonable.
