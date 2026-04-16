# diff-scope

A small terminal git diff viewer built with `cel-tui` and Bun.

## Current features

- scrollable diff view
- staged and unstaged diff snapshots
- diff highlighting
- wrapped long lines
- status bar with current directory, branch, git status summary, and refresh mode
- pending-change detection every 5 seconds
- manual refresh with `r`
- auto-refresh toggle with `Ctrl+R`
- adjustable auto-refresh interval with `PageUp` / `PageDown`
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
- `Ctrl+R` — toggle auto-refresh
- `PageUp` — slow auto-refresh by 5 seconds
- `PageDown` — speed auto-refresh up by 5 seconds
- `?` — open or close help
- `Esc` — close help
- `Ctrl+Q` / `Ctrl+C` — quit
