# One set of agent instructions, in AGENTS.md

- **Date:** 2026-08-16
- **Status:** Accepted

## Context

Most code in this repo is written with AI assistance, and not always by the same
assistant. Claude Code and Codex CLI are both installed on this machine, and
Codex already reads a global `~/.codex/AGENTS.md` from the user's dotfiles.

Each tool looks for a different filename. Claude Code reads `CLAUDE.md`. Codex,
GitHub Copilot, Cursor, Gemini CLI, Jules, Aider, Zed and Windsurf read
`AGENTS.md`. As of August 2026 Claude Code does **not** read `AGENTS.md`, and
the request to add it is open and unshipped.

The failure mode this creates is specific and bad: two instruction files that
both carry content will drift, and a Codex session and a Claude session will
then be building the same game from different rules. In a repo whose entire
premise is that AI-assisted edits must not silently break a working game, that
is exactly the wrong kind of divergence.

## Decision

`AGENTS.md` is the single source of truth. `CLAUDE.md` is a pointer file that
carries no rules of its own and ends with an `@AGENTS.md` import.

**Import rather than symlink.** Both are documented workarounds. The import was
chosen because it needs no `core.symlinks` support: a Git symlink checked out on
Windows without it degrades into a plain text file containing the literal string
`AGENTS.md`, and an agent reading that gets one word and no instructions. The
import also leaves a natural place for genuinely Claude-specific notes without
reintroducing drift, since that section cannot contain repo rules.

**Structure follows Codex's canonical headings** — Project Structure, Build/Test
Commands, Coding Style, Testing Guidelines, Commit & PR Guidelines, Security —
matching the convention already used in this user's `RTPortfolio` repo, so a
reader moving between repos finds the same shape.

**Claude-specific configuration** with no Codex equivalent (hooks, permissions,
skill wrappers) lives in `.claude/`, not in `CLAUDE.md`.

## Consequences

**Good**

- One file to edit. Drift between agents is structurally impossible rather than
  merely discouraged.
- Any of the thirty-plus tools that read `AGENTS.md` works with this repo with
  no extra setup.
- Consistent with the sibling `RTPortfolio` repo.

**Bad / accepted**

- Claude Code shows a one-time approval prompt the first time it follows the
  import. Declining it disables imports entirely and the agent would then see
  only the pointer file.
- `AGENTS.md` loads in full at session start, so it has to stay lean. Codex also
  truncates silently above 32 KiB; the current file is ~5 KB.
- `/init` may offer to regenerate `CLAUDE.md` with a codebase summary, which
  would overwrite the pointer. A note in the file warns against this.

**Revisit if**

- Claude Code ships native `AGENTS.md` support, at which point `CLAUDE.md` can
  simply be deleted.
