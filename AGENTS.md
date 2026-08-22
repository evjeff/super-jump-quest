# Repository Guidelines

A 2D platformer built by a dad-and-son team. The son (nine) is the designer: he
decides what the game does and how it should feel, and increasingly he decides
*how it works* too. The dad types and reviews. Most changes arrive as a sentence
like *"make him jump higher"*, and most of the code is written with AI
assistance.

Optimize for **a game that keeps working and keeps being fun**, not for
architectural elegance. The project fails by being abandoned, not by being messy.

## Designing With a Nine-Year-Old

He is a co-designer, not an audience. **Every decision that changes how the game
plays is his to make or to veto** — including the ones that look technical, like
how random levels are built or what the game remembers. Your job is to make each
choice understandable enough that he can actually make it, and then to record
that he made it.

**Writing anything he will read** — the short version of a decision, a question,
`IDEAS.md`, an explanation of a change:

- Say what it will **feel like to play**, not what the code does.
- No jargon. Not *deterministic* — "the same every time". Not *seed* — "the
  dice". Not *invariant* — "a rule that must never break". Not *reach envelope* —
  "how far he can jump".
- Short sentences, one idea each.
- Give every number something to compare it to. "The hole is 500 wide, and three
  jumps only carry him 450, so you can't jump it" — not "a 500px gap exceeds the
  reach envelope".
- Call things what he calls them. "The ferry one" is a better name than "level 3".

**Asking him to decide something:**

- Offer two to four real choices, each described by what it would be like to
  play it.
- Say which one you would pick and why, in one sentence. He is nine, not a
  rubber stamp — an opinion to argue with is more useful than a blank page.
- Never ask him to choose between things only an adult can picture. If a choice
  can't be described in play, decide it yourself and tell him what you did.
- "Both", "neither" and "I don't care" are real answers. Take them.

**Every ADR package `README.md` opens with a `## The short version`** — the whole
decision in a few sentences he can read on his own. If you can't write that
section, the decision isn't understood well enough to be made yet. The rest of
the package (`spec.md`, `plan.md`) stays as technical as it needs to be; the
short version is the bridge, not a replacement.

**When he decides something, write down that he decided it, and in his words.**
"He said the levels should get faster, not further" is a better record than
"difficulty favours the timing dial" — and in a year it will still explain why
the code is the way it is.

## Project Structure & Module Organization

- `src/tuning.ts` — every number that changes how the game *feels*, each commented.
  **Check here first: most requests are a one-number edit.**
- `src/levels/` — level layouts as plain data (platforms and coins as x/y numbers).
- `src/game/` — the rules: jumping, scoring, movement. Pure functions, no Phaser,
  no DOM. Must stay importable in a plain Node test. Also holds the two kinds of
  content that are pure data and so can be checked the same cheap way:
  `sounds.ts` (sound recipes) and `pipSprite.ts` (the player, as a grid of
  letters).
- `src/audio/` — the only place that makes noise. Turns the sound recipes in
  `src/game/sounds.ts` into Web Audio notes. No sound files anywhere.
- `src/scenes/` — Phaser scenes: drawing, input, physics wiring. Thin; delegates
  rules to `src/game/`.
- `src/storage/` — the only place that touches the browser's memory
  (`localStorage`, for best times). Every call is wrapped so a browser with
  storage switched off still plays; it just forgets.
- `src/main.ts` — boots the Phaser game.
- `tests/` — Playwright browser smoke tests.
- `docs/adr/` — decision records.

The `game/` vs `scenes/` split is the point: pure rules are testable in
milliseconds without a browser, which is what makes AI-authored logic changes
cheaply verifiable instead of something you have to eyeball.

## Build, Test, and Development Commands

- `pnpm dev` — dev server at http://localhost:5173 with hot reload.
- `pnpm check` — **the gate.** Typecheck, lint, unit tests, production build.
  Run before every push.
- `pnpm test` / `pnpm test:watch` — Vitest over `src/game/`.
- `pnpm test:e2e` — Playwright; boots the real game in a real browser.
- `pnpm fix` — Biome auto-format and auto-fix.
- `pnpm build` — production build into `dist/`.

Use `pnpm`, not `npm` — the lockfile is `pnpm-lock.yaml` and CI runs
`pnpm install --frozen-lockfile`.

## Coding Style & Naming Conventions

- TypeScript, 2-space indent, single quotes, no semicolons, 100-column lines.
  Biome owns all of this — run `pnpm fix` rather than hand-formatting.
- `PascalCase` for scene classes and files in `src/scenes/`; `camelCase` for
  functions and for files in `src/game/`.
- `any` is a lint error. Use a real type or `unknown`.
- Prefer pure functions in `src/game/`; keep scenes under ~200 lines. A scene
  growing past that usually means rules belong in `src/game/`.

## Testing Guidelines

- Vitest for rules, `src/game/**/*.test.ts`, colocated with the source.
- Coverage thresholds (90% lines/functions/statements, 85% branches) apply
  **only to `src/game/`**. Do not extend them to Phaser scene glue — mocking a
  renderer to hit a coverage number verifies nothing.
- New game rules get a test first, then the implementation.
- `pnpm test:e2e` is the check that catches a black screen. Types can check and
  unit tests can pass while the game renders nothing. **If it fails, the game is
  broken — do not report success.**
- Keep tests deterministic; no random data.

## Commit & Pull Request Guidelines

- **Never commit directly to `main`.** Feature branches and PRs only; `main` is
  branch-protected and requires green CI.
- **Never merge a PR without explicit user authorization.** Commit, push and open
  the PR freely; stop before merging. "Ship it" or "deploy it" describes a
  destination, not permission to merge. CI passing does not authorize a merge.
- Commits: imperative mood, describe WHY not just WHAT, one logical change each.
- PRs use `.github/pull_request_template.md`. Link issues with `Closes #123`.
- Merging to `main` auto-deploys to the public site, so `main` is always live.

## Making Changes

1. **Try `src/tuning.ts` first.** "Jump higher", "run faster", "more floaty",
   "purple sky" are single numbers. Do not write new code for these.
2. **New rule or mechanic?** Pure function in `src/game/` plus a Vitest test
   first, then wire it into a scene.
3. **New level content?** Edit `src/levels/`. It is data, not code.
4. **Something about the phone buttons?** Sizes and opacity are in the `touch`
   block of `src/tuning.ts`; where the buttons go and what a finger is on is
   `src/game/touchControls.ts`; the drawing is `src/scenes/TouchPad.ts`. See
   `docs/adr/20260816-touch-controls-for-phones/`.
5. **A new sound?** Add a recipe to `src/game/sounds.ts` — pitches, durations and
   volumes, not audio files. Do not add `.wav`/`.mp3` assets; see
   `docs/adr/20260816-synthesized-sound-effects/`.
6. **How something LOOKS?** Colours are the `colors` block of `src/tuning.ts` —
   `colors.pip` for the player, `colors.night` for the sky. The player's shape is
   the letter grid in `src/game/pipSprite.ts`. All the actual drawing is
   `src/scenes/BootScene.ts`. Do not add `.png`/`.jpg` assets; see
   `docs/adr/20260817-artwork-drawn-in-code/`.
7. Build **one** idea at a time, end to end, before starting the next. Ideas
   queue in `IDEAS.md`. A finished small feature beats three half-built ones —
   this is the single biggest reason hobby game projects die.

## Things Not To Do

- **Don't rewrite working code to make it "cleaner."** If it works and tests
  pass, leave it. A refactor that breaks a Saturday morning is a net loss.
- **Don't add dependencies** without asking. Phaser already covers physics,
  input, audio, sprites, tilemaps and scenes.
- **Don't add build tooling, state managers, or frameworks.** The stack is
  deliberately tiny: Phaser + Vite + TypeScript + Biome.
- **Don't delete or weaken tests to make CI pass.** Fix the code. If a test is
  genuinely wrong, say so explicitly and explain why.
- **Don't loosen guardrails** — no `biome-ignore` sweeps, no `any`, no lowering
  coverage thresholds, no `--no-verify`.

## Security & Configuration Tips

- **This repository is public.** Anything committed is world-readable and
  `main` publishes to a public URL. Never paste in content from a private repo.
- No secrets are needed to build or run this project. If that ever changes, use
  `.env` (git-ignored) and never commit it.
- Secret-scanning push protection is enabled on the remote.

## Explaining Your Work

The person reading your output explains it onward to the nine-year-old who
designed it — and often reads it out loud as-is. Prefer plain language over
jargon. When you change a number in `tuning.ts`, say what it will *feel* like,
not just what it does. See **Designing With a Nine-Year-Old** above for how to
write anything he will read himself.
