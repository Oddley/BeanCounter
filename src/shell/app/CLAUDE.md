# src/shell/app/

Application entry point and top-level shell.

## Inputs

`index.html` references `main.tsx` as the module entry point.

## Outputs / Contract

- `main.tsx` — bootstraps React, mounts `<App />` to `#root` in StrictMode
- `App.tsx` — top-level component; will host the router and global providers (theme, current-litter context) as phases progress

## Dependencies

- `react`, `react-dom/client`
- `react-router-dom` (Phase 1+ once routes land)
- `src/styles/global.css` (imported once at bootstrap)

## Invariants

- Exactly one `createRoot` call across the app
- Throws synchronously if `#root` is missing from the DOM
- No business logic — only mounts the tree and wires top-level providers
