# Working on Super Jump Quest

This is a hobby platformer built by a dad-and-son team. The son (under 10) drives
the creative direction; the dad types and reviews. Most changes arrive as a
sentence like *"make him jump higher"* or *"add a moving platform"*.

Optimize for **a game that keeps working and keeps being fun**, not for
architectural elegance.

## The one rule that matters most

**Never break a working game.** A kid losing interest because the screen went
black is the only real failure mode here. Before you say a change is done:

```bash
pnpm run check      # typecheck + lint + unit tests + build
pnpm run test:e2e   # proves the game still boots and the player still jumps
```

If `test:e2e` fails, the game is broken. Do not report success.

## Where things go

| Path | What lives there | Notes |
|---|---|---|
| `src/tuning.ts` | Every number that changes game *feel* | **Most requests are a one-number edit here.** Look here first. |
| `src/levels/` | Level layouts as plain data | Platforms and coins are just x/y numbers. |
| `src/game/` | Pure game rules — no Phaser, no DOM | Must stay importable in a plain Node test. |
| `src/scenes/` | Phaser scenes — drawing, input, physics wiring | Thin. Delegates rules to `src/game/`. |
| `tests/` | Playwright browser smoke tests | The "does it actually run" safety net. |

## How to make changes

1. **Try `src/tuning.ts` first.** "Jump higher", "run faster", "more floaty",
   "purple sky" are all single numbers. Do not write new code for these.
2. **New rule or mechanic?** Put the logic in `src/game/` as a pure function and
   write a Vitest test for it *first*. Then wire it into a scene.
3. **New level content?** Edit `src/levels/`. It is data, not code.
4. **Keep scenes thin.** If a scene file grows past ~200 lines, the rules inside
   it probably belong in `src/game/`.

## Things not to do

- **Don't rewrite working code to make it "cleaner."** If it works and the tests
  pass, leave it. Refactors that break a Saturday morning are a net loss.
- **Don't add dependencies** without asking. Phaser covers physics, input,
  audio, sprites, tilemaps and scenes already.
- **Don't add build tooling, state managers, or frameworks.** The stack is
  deliberately tiny: Phaser + Vite + TypeScript + Biome.
- **Don't delete or weaken tests to make CI pass.** Fix the code instead. If a
  test is genuinely wrong, say so explicitly and explain why.
- **Don't loosen the guardrails** — no `// biome-ignore` sweeps, no `any`, no
  lowering the coverage thresholds in `vitest.config.ts`, no `--no-verify`.
- **Don't use `any`.** It is a lint error. Use a real type or `unknown`.

## Scope control

Ideas land in `IDEAS.md`. Build **one** at a time and get it working end-to-end
before starting the next. A finished small feature beats three half-built ones —
this is the single biggest reason hobby game projects die.

If a request would take more than a few files, say so and propose the smallest
version that is still fun.

## Explaining your work

The person reading your output is explaining it onward to a kid. Prefer plain
language over jargon. When you change a number in `tuning.ts`, say what it will
*feel* like, not just what it does.

## Git

- Never commit to `main`. Branch, then open a PR.
- CI must be green before merge. Never merge a PR without being asked to.
