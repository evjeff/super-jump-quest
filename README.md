# 🟨 Super Jump Quest

A 2D platformer built by a dad-and-son team, one Saturday at a time.

Built with [Phaser 4](https://phaser.io), TypeScript and Vite.

**▶️ Play it:** https://evjeff.github.io/super-jump-quest/ *(live once the first deploy runs)*

---

## Play it on your own machine

You need [Node.js](https://nodejs.org) 22 or newer and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev
```

Then open http://localhost:5173. Edit a file, hit save, and the browser updates
instantly — no refresh needed.

**Controls:** arrows or WASD to move, space to jump — and space twice more in
mid-air for a triple jump. `N` starts the next level when you finish one, and
`R` starts the whole game over from level 1.

**On a phone:** turn it sideways and the game draws its own buttons — ◀ ▶ under
your left thumb, a big ▲ under your right, and a small ↻ in the corner to start
over. Both thumbs work at once, so you can run and jump together. When you
finish a level, tap the screen to carry on.

The clock in the corner times the level you're on and stops when you grab the
last coin. Your fastest finish on each level is remembered in your browser, so
there's always a time to beat.

**Three levels.** *First Steps* to learn to jump, *The Tall Tower* to learn to
aim, and *The Sky Ferry* to learn to wait — its purple ledges slide back and
forth, and standing on one carries you along with it. The hole in level 3 is too
wide to jump, even with a triple jump: the ferry is the only way across.

---

## 🎛️ Want to change how the game feels?

Open **[`src/tuning.ts`](src/tuning.ts)**. That one file holds every number that
matters, each with a comment explaining what it does:

| You want... | Change this | Try |
|---|---|---|
| Jump higher | `player.jumpVelocity` | `900` |
| Run faster | `player.speed` | `400` |
| Floaty moon gravity | `player.gravity` | `300` |
| Jump even more times | `player.maxJumps` | `5` |
| A different colored sky | `colors.sky` | `0x2d1b4e` |
| Turn the sound off | `sound.volume` | `0` |
| Bigger buttons on a phone | `touch.buttonRadius` | `70` |
| Level 3's moving platforms slower | `platforms.movingSpeed` | `0.5` |

Nothing in that file can break the game. Try ridiculous numbers — that's the fun part.

**Want to redesign a level?** Open [`src/levels/`](src/levels/) — one file per
level. Platforms and coins are just x/y numbers on a 960 × 540 grid, where `y`
counts *downward* from the top. A brand-new level is a copy of one of those
files, added to the list in [`src/levels/index.ts`](src/levels/index.ts).

---

## How the code is organized

```
src/
├── tuning.ts        ← all the knobs (start here)
├── levels/          ← level layouts, as plain data
├── game/            ← the RULES: jumping, scoring, movement, what sounds
│                      sound like. Pure functions. No Phaser. Unit tested.
├── audio/           ← the only thing that makes noise. No sound files —
│                      the computer plays the notes itself.
├── storage/         ← the only thing that remembers anything after you
│                      close the tab (best times)
├── scenes/          ← the DRAWING: Phaser scenes, sprites, physics
└── main.ts          ← starts the game
```

The split between `game/` (rules) and `scenes/` (drawing) is the important part.
Rules are pure functions, so they can be tested in milliseconds without a
browser — which is what makes it safe to let an AI assistant change them.

---

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Play the game locally with instant reload |
| `pnpm check` | **Run everything CI runs.** Do this before pushing. |
| `pnpm test` | Unit tests for the game rules |
| `pnpm test:watch` | Unit tests, re-running as you type |
| `pnpm test:e2e` | Opens the real game in a real browser and proves it works |
| `pnpm fix` | Auto-format and auto-fix lint problems |
| `pnpm build` | Production build into `dist/` |

---

## The guardrails

This repo is deliberately over-protected for its size. Every check below exists
to stop the same failure: *the game silently stops working and nobody notices
until the kid asks to play it.*

| Guardrail | Catches |
|---|---|
| **TypeScript** (strict) | Typos, wrong arguments, impossible states — before running |
| **Biome** | Formatting drift, unused code, `any`, common mistakes |
| **Vitest** (90% coverage on `src/game/`) | Broken game rules, e.g. double-jump silently stops working |
| **Playwright smoke test** | A black screen. Boots the real game and jumps the player. |
| **Playwright phone test** | A game that can't be played on a phone. Real touch events, two thumbs at once. |
| **GitHub Actions CI** | All of the above, on every pull request |
| **CodeQL** | Security and correctness defects a linter can't see |
| **Dependabot** | Outdated and vulnerable dependencies, weekly |
| **Lefthook git hooks** | Formats on commit; typechecks and tests before push |
| **Branch protection** | Nobody, human or AI, pushes broken code to `main` |

The Playwright smoke test is the most valuable one. Types can check and unit
tests can pass while the game still shows a black screen — only booting it in a
real browser proves otherwise.

---

## Adding a feature

1. Add the idea to [`IDEAS.md`](IDEAS.md).
2. Make a branch: `git checkout -b coin-magnet`
3. Build **one** thing until it actually works.
4. `pnpm check` and `pnpm test:e2e`
5. Push and open a pull request. CI runs; green means safe to merge.
6. Merging to `main` auto-deploys to the live URL.

## Docs

- [`AGENTS.md`](AGENTS.md) — the rules AI assistants follow in this repo.
  Read by Codex, Copilot, Cursor and Gemini CLI directly; Claude Code picks it
  up through the one-line [`CLAUDE.md`](CLAUDE.md) pointer.
- [`IDEAS.md`](IDEAS.md) — the idea list
- [`docs/adr/`](docs/adr/) — why the stack was chosen

## License

MIT — see [LICENSE](LICENSE).
