# diff-scope — Agent Guide

## Project

Build a live git diff viewer as a terminal app with `cel-tui`.

## Stack

- Runtime, package management, and script execution: `bun`
- One-off tools like Prettier or Biome: `bunx`
- Language: TypeScript
- TUI framework: `cel-tui`

## Current Repo Layout

- `src/index.ts` — current app entrypoint and TUI
- `package.json` — Bun scripts and dependencies
- `.agents/skills/cel-tui/` — local cel-tui skill and references

## Current App Status

The current app already has:

- a scrollable git diff view
- staged and unstaged diff rendering in one snapshot
- diff highlighting and wrapped long lines
- a bottom status bar with cwd, branch, git status summary, and refresh mode
- pending-change detection every 5 seconds
- manual refresh with `r`
- auto-refresh toggle with `ctrl+r`
- adjustable auto-refresh interval controls with `pageup` / `pagedown`
- a help/about modal toggled with `?` and closed with `?` or `Esc`

## Commands

```bash
bun install
bun run start
bun run dev
bun run typecheck
```

## Working Rules

- Use `bun` and `bunx` instead of `node`, `npm`, `npx`, or `yarn`.
- Use `cel-tui` for the UI. Do not introduce another TUI framework unless the user asks for it.
- Keep the app focused on the git diff live viewer; avoid side systems the user did not request.
- Prefer simple shelling out to `git` over adding a git library unless the user asks for one.
- When making `cel-tui` implementation decisions or checking framework behavior, load `.agents/skills/cel-tui/SKILL.md` first.
