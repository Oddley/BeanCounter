# src/shell/components/

Reusable UI primitives. Minimal API, large touch targets, dark-friendly defaults.

## Components

| Component | Purpose |
|---|---|
| `AppBar` | Top bar shared across routes: title, optional back button, optional overflow menu |
| `Button` | Primary action button — meets `--touch-target-min`; supports primary/secondary variants |
| `Input` | Text input with label and error message slot |
| `ListItem` | Tappable list row with primary text + optional secondary text + chevron |

## Conventions

- Each component is a function component, no classes
- Each component has a colocated `.module.css` file for scoped styles
- Props use `readonly` arrays/objects per project preference
- All visible text is passed in as props — no hardcoded copy
- Touch targets meet `--touch-target-min` (44px) at minimum
- Components compose CSS variables from `src/styles/global.css` — no hardcoded colors or spacing

## What goes here vs. routes/

- Here: **reusable** primitives used by 2+ routes
- In `routes/`: route-specific compositions (forms, lists wired to data hooks)
