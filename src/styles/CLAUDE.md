# src/styles/

Global CSS and theme variables.

## Files

- `global.css` — CSS reset, root styles, CSS variables, base element styles. Imported once from `shell/app/main.tsx`.

## Contract

- Dark-first theme via `color-scheme: dark` and CSS custom properties
- All color, spacing, radius, and touch-target values are CSS variables — no hardcoded values in component styles
- Touch targets meet `--touch-target-min` (44px) per accessibility guidance

## Variables

| Group | Examples |
|---|---|
| Colors | `--color-bg`, `--color-fg`, `--color-fg-muted`, `--color-accent`, `--color-border` |
| Spacing | `--space-1` through `--space-8` (rem-based scale) |
| Sizing | `--radius`, `--touch-target-min` |

Component-level styles (when added) live in CSS modules colocated with components.
