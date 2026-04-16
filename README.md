# diff-scope

A small terminal git diff viewer built with `cel-tui` and Bun.

## Current features

- scrollable diff view
- staged and unstaged diff snapshots
- diff highlighting
- wrapped long lines
- status bar with current directory, branch, and git status summary
- pending-change detection every 5 seconds
- manual refresh with `r`
- help/about modal with `?`

## Run

```bash
bun install
bun run start
```

## Development

```bash
bun run dev
bun run typecheck
```

## Current keybinds

- `r` — refresh snapshot
- `?` — open or close help
- `Esc` — close help
- `Ctrl+Q` / `Ctrl+C` — quit
