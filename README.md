# companion

Turborepo monorepo for the Companion desktop app.

## Structure

- `apps/desktop` — Tauri + React desktop app
- `packages/shared` — shared types and utilities
- `packages/ui` — reusable React components
- `packages/typescript-config` — shared TS configs

## Requirements

- [Bun](https://bun.sh)
- Rust + Cargo (for Tauri)

## Scripts

```sh
bun install        # install all workspace dependencies
bun run dev         # run dev tasks across the workspace
bun run build        # build all packages/apps
bun run type-check      # type-check all packages/apps
bun run tauri -- dev    # run the desktop app in Tauri dev mode
```
