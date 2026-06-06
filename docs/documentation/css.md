# `css`

> Path: `css/`
> Last updated: 2026-06-04
> Type: Leaf folder — **REMOVED**

## ⚠️ Legacy folder — no longer exists

The entire `css/` directory and all its files were deleted in commit `9724cfb` ("chore: remove legacy flat HTML prototype files"). This folder was part of the legacy vanilla HTML/CSS/JS prototype frontend, which has been superseded by the React + Vite frontend in `frontend/`.

**Previously contained (5 files, all removed):**

| File | Role (historical) |
|------|-------------------|
| `styles.css` | Master CSS entry point — 4 `@import` directives assembling the full stylesheet from partials |
| `base.css` | CSS reset, dark-theme custom properties (CSS variables), base typography, accessible focus styling |
| `layout.css` | Page structure and responsive grid: body padding, header flexbox, PC card grid with 3/2/1 column breakpoints |
| `components.css` | Widget-level styling: PC cards, service rows, GPU bars, buttons, dialog modals, form inputs |
| `animations.css` | Motion effects: card entrance, GPU bar fill animation, warning pulse, button hover transitions, dialog fade-in |

These files are no longer present in the repository. All styling is now handled by the React frontend (`frontend/`) using Tailwind CSS.

---

## 🔄 Changes in this update

- **Removed** — All 5 CSS files (`styles.css`, `base.css`, `layout.css`, `components.css`, `animations.css`) were deleted as part of the legacy flat HTML prototype cleanup (Task T15, commit `9724cfb`). This documentation now serves as a historical reference only.
- Historical detail preserved from previous documentation cycle for reference.
