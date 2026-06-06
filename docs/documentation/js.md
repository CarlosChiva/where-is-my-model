# `js`

> Path: `js/`
> Last updated: 2026-06-04
> Type: Leaf folder — **REMOVED**

## ⚠️ Legacy folder — no longer exists

The entire `js/` directory and all its files were deleted in commit `9724cfb` ("chore: remove legacy flat HTML prototype files"). This folder was part of the legacy vanilla HTML/CSS/JS prototype frontend, which has been superseded by the React + Vite frontend in `frontend/`.

**Previously contained (5 files, all removed):**

| File | Role (historical) |
|------|-------------------|
| `models.js` | ES6 data model classes (`Service`, `PC`) with flexible constructors, `toDict()` serialization, CRUD helpers (`addService`, `removeService`, `getTotalGpu`) |
| `data.js` | Data loading (`fetch` with fallback), normalization, denormalization, persistence (`saveData` Blob download), VRAM extraction |
| `views.js` | Complete rendering/view layer: 13 public functions for PC card construction, service row rendering, GPU progress bars, header summary updates, XSS-safe escaping, staggered animations |
| `editors.js` | Dialog management, form validation (IPv4, port/GPU range), CRUD handlers for PC/service add/edit/delete modals, event delegation (`wireEditors()`) |
| `app.js` | Application bootstrap: async `init()` orchestrating `loadData()` → `renderPcs()` → `wireEditors()` on `DOMContentLoaded` |

These files are no longer present in the repository. All frontend logic is now handled by the React application in `frontend/`.

---

## 🔄 Changes in this update

- **Removed** — All 5 JavaScript files (`models.js`, `data.js`, `views.js`, `editors.js`, `app.js`) were deleted as part of the legacy flat HTML prototype cleanup (Task T15, commit `9724cfb`). This documentation now serves as a historical reference only.
- Historical detail preserved from previous documentation cycle for reference.
