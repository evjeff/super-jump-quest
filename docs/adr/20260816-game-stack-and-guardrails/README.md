# Stack and guardrails for an AI-assisted hobby game

- **Date:** 2026-08-16
- **Status:** Accepted

## Context

A parent and a child (under 10) are building a 2D browser game together. The
child supplies creative direction; the parent types and reviews. Most of the
code will be written with AI assistance ("vibe coding").

This context inverts the usual priorities:

- **The dominant risk is abandonment, not technical debt.** The project fails if
  the game stops being fun to work on, not if the code is inelegant.
- **The dominant technical risk is silent breakage.** An AI-assisted edit that
  produces a black screen, with everything still type-checking, kills a Saturday
  morning and burns the child's enthusiasm.
- **Feedback loops must be short.** Changes need to be visible in seconds.
- **Requests arrive as feelings, not specifications** — "make him jump higher",
  "make it more floaty". The code must have an obvious place for those to land.

## Decision

### Framework: Phaser 4

Chosen over Kaplay and Excalibur.

Kaplay has a genuinely friendlier API and is easier for a child to read. But
Phaser has by far the largest documentation and example corpus, and AI
assistants hallucinate Kaplay and Excalibur APIs noticeably more often. Since
most code here is AI-generated, **assistant accuracy outweighs API elegance** —
a beautiful API the model gets wrong is worse than a verbose one it gets right.

Phaser also ships everything needed (arcade physics, input, audio, scenes,
tilemaps) so the dependency list stays at one.

Cost: ~500KB bundle. Irrelevant for a hobby game on GitHub Pages.

### Language and build: TypeScript 7 + Vite 8

Vite gives sub-second HMR, which matters more than usual when the feedback loop
includes a child's attention span. `tsc --noEmit` gates the production build,
so type errors cannot reach the deployed game.

TypeScript is strict, plus `noUncheckedIndexedAccess`, `noImplicitOverride`,
`noFallthroughCasesInSwitch` and `verbatimModuleSyntax`. `noImplicitOverride`
immediately caught a real bug during setup: `GameScene.update()` silently
overrode `Phaser.Scene.update()` without declaring it.

`exactOptionalPropertyTypes` and `noUnusedParameters` were deliberately **not**
enabled — both fight Phaser's callback signatures and would generate friction
without catching bugs that matter here.

### Linting: Biome, not ESLint + Prettier

Biome is one Rust binary replacing two tools, roughly 10–25× faster, and is the
current recommendation for greenfield TypeScript projects.

The decisive factor is a compatibility one: **TypeScript 7.0 ships no stable
programmatic compiler API**, so `typescript-eslint` cannot run on it and is not
expected to until 7.1. Choosing ESLint would mean pinning to TypeScript 6.
Biome is written in Rust and never touches the TS compiler API, so it makes
TypeScript 7 adoptable today.

Accepted cost: Biome's rule catalogue is smaller than ESLint's plugin ecosystem.
For a single-dependency game project, nothing needed is missing.

### Architecture: rules separated from rendering

- `src/game/` — pure functions (jumping, scoring, movement). No Phaser imports.
- `src/scenes/` — Phaser scenes. Drawing, input and physics wiring only.
- `src/tuning.ts` — every value affecting game feel, in one annotated file.
- `src/levels/` — level layouts as plain data.

This split is the main structural guardrail. Pure rules are unit-testable in
milliseconds without a browser or a renderer mock, which makes AI-authored
changes to game logic **cheaply verifiable** rather than something to eyeball.

`tuning.ts` exists so the most common request — a feel change — is a one-number
edit that needs no code generation at all, and therefore carries no risk of
regression. It is also the file the child can be handed directly.

### Testing: Vitest for rules, Playwright for reality

Vitest enforces 90% coverage, but **only over `src/game/`**. Extending coverage
requirements to Phaser scene glue would force renderer mocks that verify nothing
real and would make the suite tiresome to maintain.

Scene correctness is covered instead by a Playwright test that loads the built
game in a real browser and asserts that the canvas renders, the Phaser instance
reaches the playable scene, there are zero console errors, and pressing space
actually moves the player upward.

This is the highest-value check in the repo: it is the only one that can fail on
a black screen. It caught a genuine issue during setup — Phaser's `Key.onUp`
clears the "just pressed" flag, so a same-frame press-and-release is never seen.

### Deployment: GitHub Pages from `main`

A public URL the child can send to friends is a meaningful motivator. Automatic
deployment on merge means shipping is never a chore that gets skipped.

### Process guardrails

Branch protection on `main` requiring green CI, PR-only merges, CodeQL,
Dependabot, and Lefthook hooks (format on commit; typecheck and test on push).

A `CLAUDE.md` encodes the rules for AI assistants, most importantly: never break
a working game, prefer `tuning.ts` over new code, and don't delete tests or
weaken guardrails to get CI green.

## Consequences

**Good**

- A broken game cannot reach the live URL without a check failing first.
- The most common change (game feel) is the safest possible edit.
- AI-generated rule changes are verified by fast, real tests.
- The child gets a shareable link and a file of knobs he can safely turn.

**Bad / accepted**

- More CI configuration than a hobby project would normally justify. Accepted
  deliberately: the guardrails are the mechanism by which the project survives
  AI-assisted editing.
- Biome's smaller rule set versus ESLint.
- Phaser's ~500KB bundle.
- 90% coverage on `src/game/` will occasionally require a test for something
  obvious. Cheap, because the functions are pure.

**Revisit if**

- `typescript-eslint` gains TypeScript 7 support and a needed rule has no Biome
  equivalent.
- The game outgrows arcade physics.
- The child becomes the primary author, at which point the API-readability
  argument for Kaplay may outweigh the AI-accuracy argument for Phaser.
