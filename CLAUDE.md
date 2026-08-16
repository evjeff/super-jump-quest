# CLAUDE.md

This repo keeps **one** set of agent instructions, in [`AGENTS.md`](AGENTS.md).

`AGENTS.md` is the cross-agent convention — Codex, Copilot, Cursor, Gemini CLI
and others read it. Claude Code reads *this* file and does not read `AGENTS.md`
on its own, so this file exists only to point at that one, and the import at the
bottom pulls it in. Put repo rules in `AGENTS.md`, never here — two files that
both carry content will drift, and a Codex session and a Claude session would
then be working from different rules.

A pointer file rather than a symlink is deliberate, matching the convention in
this user's other repos: the import needs no `core.symlinks` support, so it
survives a checkout on Windows, where a Git symlink otherwise degrades into a
plain text file containing the literal path `AGENTS.md` and nothing else.

Claude-specific configuration that has no Codex equivalent (hooks, permissions,
skill wrappers) belongs in `.claude/`, not in this file.

> Note for `/init`: this file is a pointer by design. If `/init` offers to
> regenerate it with a codebase summary, that content belongs in `AGENTS.md`.

@AGENTS.md
