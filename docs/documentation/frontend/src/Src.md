# Src

> Path: `frontend/src/`
> Last updated: 2026-07-11
> Type: Composite folder

This folder is the root source directory of a **React + Vite** single-page application called "Where Is My Model" — a GPU Infrastructure Dashboard that lets users catalogue multi-GPU servers running AI inference services, monitor real-time VRAM occupancy with colour-coded progress bars, and estimate VRAM budgets for loading large language models via an interactive calculator. The application communicates with a JSON REST backend through a custom fetch-based client layer, manages state with React hooks (no Redux or external state library), routes between two views using a lightweight internal page-switching pattern, and styles everything via Tailwind CSS utility classes.

---

## 📁 Subfolders

| Folder | Documentation | Description |
|--------|--------------|-------------|
| `components/` | [see docs](./src/components/Components.md) | Presentational and interactive UI components: dashboard cards, service rows, GPU occupancy bars, the application header, and the GPU calculator page with form sections and results display. |
| `hooks/` | [see docs](./src/hooks.md) | Custom React hooks for data fetching (PC list, per-server services) and CRUD mutations (create/update/delete PCs and services), all returning consistent `{ loading, error, mutate }` contracts with optimistic `onSuccess` callbacks. |
| `services/` | [see docs](./src/services.md) | Client-side HTTP layer: a low-level `apiClient` wrapper around native `fetch`, plus domain-specific modules (`pcApi`, `serviceApi`) that map CRUD operations to REST endpoints on the `/api` backend. |
| `utils/` | [see docs](./src/utils.md) | Pure utility functions: a calculator engine with seven attention-architecture variants for VRAM estimation, GPU colour-coding and clamping helpers, client-side form validators for PC and service entities. |

---

## Frontend architecture overview

### Technology stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 (functional components, Hooks API) |
| Build tool | Vite (ESM modules, fast HMR) |
| Styling | Tailwind CSS (`@tailwind base/components/utilities` directives in `index.css`) |
| State management | React `useState`, `useEffect`, custom hooks — no external state library |
| HTTP client | Native `fetch` wrapped by a thin abstraction (`services/apiClient.js`) |
| Routing | Internal state-based page switching via `currentPage` in `App.jsx` (no `react-router`) |

### Application entry point and boot sequence

1. Vite loads `main.jsx`, which mounts the React tree into `<div id="app">`.
2. The root is wrapped in `<React.StrictMode><AuthProvider>`, making the authentication context available to the entire component tree.
3. Inside the provider, `<App />` renders. First, `useAuth()` resolves the current session (loading spinner while pending; `<LoginPage />` if unauthenticated). Only when both auth guards pass does `usePcs()` fire its initial data fetch from the backend (`GET /api/pcs`).
4. Once data arrives, `<Header>` and `<PCGrid>` render with live server information. All eight CRUD callbacks are role-gated: admin users get real handlers, non-admin users receive silent no-ops. Additionally, `isAdmin` is passed as a prop to `<PCGrid>` so child components can hide admin-only UI elements from the DOM entirely ("Add PC" FAB uses double-guarding: `{ currentPage === 'dashboard' && isAdmin }`).

### Routing strategy

The application uses an **internal page-switching pattern** rather than URL-based routing. A single `currentPage` state variable in `App.jsx` holds either `'dashboard'` (default) or `'calculator'`. The `Header` component exposes tab buttons that call the `handlePageChange` callback, which atomically sets both `currentPage` and resets any open modal. When `'dashboard'` is active, the full CRUD layout renders; when `'calculator'` is active, the self-contained `<GPUCalculatorPage />` replaces the grid/modals.

### Modal orchestration

Modals are managed via a **single-state router pattern** in `App.jsx`. A `modalState` object with two keys (`type`, `payload`) controls which modal dialog is rendered:
- `type: 'addPc'` → `<AddPcModal>`
- `type: 'editPc'` → `<EditPcModal>` (payload = the full PC document)
- `type: 'addService'` → `<AddServiceModal>` (payload = `{ pcId, gpus, servicios }`)
- `type: 'editService'` → `<EditServiceModal>` (payload = `{ pcId, index, service, gpus, services }`)
- `type: 'deleteConfirm'` → `<DeleteConfirmModal>` (payload = `{ pcId, nombre|index, actionType }`)
- `type: null` → no modal is rendered

This eliminates the need for a third-party modal library or deep component drilling. Action callbacks wired into `<PCGrid>` and `<PCCard>` simply call `setModalState(...)` to open dialogs; the parent passes mutation hooks directly to each modal's `onSave` callback.

### Data flow summary

```
Browser → main.jsx (mount)
                │
                ▼
           App.jsx (orchestrator)
          ╱    │    ╲         ▲
         ╱     │     ╲        │ Auth guards:
  headers/nav mutation   page router       - isLoading → spinner
  callbacks   hooks ↕     ─── 'dashboard'  - !isAuthenticated → <LoginPage />
       │      services/    branch                          ↓ (only if auth OK)
       │        │             Header.jsx       ┌─────────────────────┐
       ▼        ▼            PCGrid.jsx → PCCard.jsx → ServiceRow.jsx / GPUDetails.jsx
  usePcs    apiClient         Modals wired by modalState.type      CRUD callbacks:
  useCreatePc   ←── fetch ──┐     (AddPcModal, EditPcModal...)      8 handlers role-gated:
  useUpdatePc                               │                       isAdmin ? real : () => {}
  useDeletePc                               ▼
  useCreateService                  Backend REST API            handleAddPc, handleSaveService
  useUpdateService                    (/api/pcs, .../)           → un-gated (modal-on-save only)
   useDeleteService
   useServices
   useServiceHealth  → TCP probe manager, result passed to PCGrid + wired to FAB button
        │
        ▼
   utils/ (validators, calculatorEngine, gpuHelpers)
  └── shared colour coding + VRAM maths across dashboard AND calculator
```

---

## 📄 Direct files

### 📄 main.jsx

Bootstraps the React application. Mounts a `<AuthProvider>`-wrapped `<App />` tree into a DOM element with `id="app"` inside strict mode. This ensures authentication context (`useAuth`) is available to all descendant components via React's Context API. Imports and applies global Tailwind CSS directives from `index.css`. This file is the sole entry point specified in the Vite configuration.

#### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `React` | External |
| `react-dom/client` | `ReactDOM` | External |
| `./context/AuthContext.jsx` | `AuthProvider` | Internal |
| `./App.jsx` | `default` (component) | Internal |
| `./index.css` | — (side-effect import) | Internal |

---

### 📄 App.jsx

Top-level application shell and orchestrator component. Enforces route protection at mount: a loading guard renders a fullscreen spinner while auth resolves (blocking all data hooks), and an unauthenticated guard redirects to `<LoginPage />`. Owns all top-level state behind the auth gates: the master PC list (`usePcs`), six mutation hooks for CRUD operations on PCs and services (`useCreatePc`, `useUpdatePc`, `useDeletePc`, `useCreateService`, `useUpdateService`, `useDeleteService`), a service health check hook (`useServiceHealth`) for per-service TCP status monitoring, a modal router state object, and the page-switching state. Eight CRUD callbacks are role-gated using a ternary pattern (`isAdmin ? realHandler : () => {}`) so non-admin users get silent no-ops instead of 401 API errors. The `isAdmin` flag is also passed as a prop to `<PCGrid>` so child components can perform UI-level access control (e.g., hiding admin-only buttons from the DOM). The "Add PC" FAB is double-guarded: it renders only when `{currentPage === 'dashboard' && isAdmin}` — hiding the entire button element for non-admin users rather than relying solely on a gated callback. `handleAddPc` and `handleSaveService` remain un-gated as modal-on-save callbacks only reachable through gated entry points. Renders two floating action buttons on the dashboard view ("Refresh Health" always visible; "Add PC" admin-only). Conditionally renders either the full dashboard layout with modals or the GPU Calculator page.

#### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `useState` | External |
| `./context/AuthContext.jsx` | `useAuth` | Internal |
| `./components/LoginPage.jsx` | `default` (component) | Internal |
| `./hooks/usePcs.js` | `default` (hook) | Internal |
| `./hooks/useCreatePc.js` | `default` (hook) | Internal |
| `./hooks/useUpdatePc.js` | `default` (hook) | Internal |
| `./hooks/useDeletePc.js` | `default` (hook) | Internal |
| `./hooks/useServices.js` | `default` (hook) | Internal |
| `./hooks/useCreateService.js` | `default` (hook) | Internal |
| `./hooks/useUpdateService.js` | `default` (hook) | Internal |
| `./hooks/useDeleteService.js` | `default` (hook) | Internal |
| `./hooks/useServiceHealth.js` | `default` (hook) | Internal |
| `./components/Header.jsx` | `default` (component) | Internal |
| `./components/PCGrid.jsx` | `default` (component) | Internal |
| `./components/GpuCalculator/GPUCalculatorPage.jsx` | `default` (component) | Internal |
| `./components/Modals/AddPcModal.jsx` | `default` (component) | Internal |
| `./components/Modals/EditPcModal.jsx` | `default` (component) | Internal |
| `./components/Modals/AddServiceModal.jsx` | `default` (component) | Internal |
| `./components/Modals/EditServiceModal.jsx` | `default` (component) | Internal |
| `./components/Modals/DeleteConfirmModal.jsx` | `default` (component) | Internal |

#### Component

##### `App` _(default export — function component)_

React functional component that serves as the application shell. Manages data flow between the UI layer, mutation hooks, and modal dialogs.

**Internal state:**

| State variable | Initial value | Purpose |
|---------------|---------------|---------|
| `{ user, isAuthenticated, isLoading }` (from `useAuth()`) | — | Authentication context consumer. `user` holds the current user object (with `role` field), `isAuthenticated` flags login status, `isLoading` indicates session check is still pending. Used for top-level auth guards before any data hooks fire. |
| `isAdmin` (derived) | — | Computed as `user?.role === 'admin'`. Drives ternary gate on all 8 role-protected CRUD callbacks. |
| `pcs`, `loading`, `refetch` (from `usePcs()`) | — | Master PC list fetched from backend, auto-refetched after any mutation via the hooks' `onSuccess` callbacks. Only fires when both auth guards pass. |
| `createPcHook`, `updatePcHook`, `deletePcHook`, `createServiceHook`, `updateServiceHook`, `deleteServiceHook` (from respective hooks) | — | Mutation hooks with `loading`, `error`, `mutate`, and `clearError`. All wired to `refetch` on success. |
| `modalState` (`{ type, payload }`) | `{ type: null, payload: null }` | Single-object modal router; `type` determines which dialog renders, `payload` carries data to it. |
| `currentPage` | `'dashboard'` | Page switcher between dashboard and calculator views. Both FAB buttons are guarded by `{ currentPage === 'dashboard' && ... }`. |
| `serviceHealth` (from `useServiceHealth()`) | — | Health check hook exposing `loading` (boolean) and `checkAll()` method. Passed as the `serviceHealth` prop to `<PCGrid>` for per-service TCP status display. Wired to the "Refresh Health" FAB button via `onClick={() => serviceHealth.checkAll()}`. |

**Internal functions:**

- **`closeModal() → void`**
  Resets `modalState` to `{ type: null, payload: null }`, dismissing any open dialog.

- **`handleAddPc(pcData: Object) → Promise<void>`**
  Calls `createPcHook.mutate(pcData)` and closes the modal on success (no error returned). **Not role-gated** — only reachable as a modal-on-save callback; the "Add PC" modal opens via gated `handleOpenAddPc`, so non-admins never call it.

- **`handleEditPc(pc: Object) → Promise<void>` ⭐ Role-gated**
  Admin: extracts `_id` (with fallback to `id`) from `pc`, calls `updatePcHook.mutate({ id, data: pc })`, closes modal on success. Non-admin: silent no-op `() => {}`. Uses `isAdmin ? realHandler : () => {}` ternary pattern — prevents 401 errors while keeping UI actions inert.

- **`handleOpenAddPc() → void` ⭐ Role-gated**
  Admin: opens the Add PC modal via `setModalState({ type: 'addPc', payload: null })`. Non-admin: silent no-op `() => {}`. Wired to the "Add PC" FAB button via `onClick={handleOpenAddPc}` (replacing previous inline expression).

- **`handleDeletePc({ pcId, nombre }: Object) → void` ⭐ Role-gated**
  Admin: opens the `<DeleteConfirmModal>` with `actionType: 'pc'`. Non-admin: silent no-op. Defers actual deletion to confirmation handler.

- **`handleAddService({ pcId, gpus, servicios }: Object) → void` ⭐ Role-gated**
  Admin: opens the `<AddServiceModal>` with PC context (GPU inventory + existing services). Non-admin: silent no-op.

- **`handleSaveService(serviceData: Object) → Promise<void>`**
  Deconstructs `pcId` from `serviceData`, calls `createServiceHook.mutate({ pcId, data })`, closes modal on success. **Not role-gated** — only reachable after passing the gate in `handleAddService` (modal-open entry point).

- **`handleEditService({ pcId, index, service, gpus, services }: Object) → void` ⭐ Role-gated**
  Admin: opens the `<EditServiceModal>` with full edit context. Non-admin: silent no-op.

- **`handleEditServiceSubmit(serviceData: Object) → Promise<void>` ⭐ Role-gated**
  Admin: called by `EditServiceModal.onSave`. Extracts `pcId`, `index`, and remaining fields as `data`. Calls `updateServiceHook.mutate({ pcId, index, data })`, closes modal on success. Non-admin: silent no-op.

- **`handleDeleteService({ pcId, index }: Object) → void` ⭐ Role-gated**
  Admin: opens the `<DeleteConfirmModal>` with `actionType: 'service'`. Non-admin: silent no-op. Defers actual deletion to confirmation handler.

- **`handleConfirmDelete() → Promise<void>` ⭐ Role-gated**
  Admin: universal delete confirmation handler. Inspects `modalState.payload.actionType`: routes to `deletePcHook.mutate(pcId)` for `'pc'` or `deleteServiceHook.mutate({ pcId, index })` for `'service'`. Closes modal on success. Both hooks fire `refetch` via their `onSuccess` callbacks. Non-admin: silent no-op.

- **`handlePageChange(page: string) → void`**
  Switches the active page and atomically resets any open modal to prevent lingering dialogs.

**Derived values:**

- **`deleteMessage: string`** — Dynamically constructs a confirmation message based on `modalState.payload.actionType`: specific server name for PC deletion, generic message for service deletion. Falls back to empty string if no payload.

**Auth guards (early returns before main render):**

Two top-level guards execute before any data hooks are invoked:

1. **Loading guard (`if (isLoading)`)** — Returns a full-screen spinner centred with flexbox. Blocks `usePcs()` and all mutation hooks from firing while session verification is pending.
2. **Unauthenticated guard (`if (!isAuthenticated)`)** — Renders `<LoginPage />`. Prevents dashboard rendering for unlogged-in users, avoiding cascading 401 errors from data-fetching hooks.

Main render only proceeds when both guards pass (user is authenticated and auth state is resolved).

**Render logic:**

```
<div className="min-h-screen ...">
  <Header              currentPage /> onPageChange /> pcs />

  {currentPage === 'dashboard' ? (
    <>
      <PCGrid   pcs /> loading /> serviceHealth /> isAdmin /* NEW: UI-level access control */ />
                    onEditPc /> onAddService /> onDeletePc />
                    onEditService /> onDeleteService />

       {/* Modal routing — all CRUD modals reachable only via role-gated callbacks */}
       {modalState.type === 'addPc'        && <AddPcModal .../>}
       {modalState.type === 'editPc'       && <EditPcModal .../>}
       {modalState.type === 'addService'   && <AddServiceModal .../>}
       {modalState.type === 'editService'  && <EditServiceModal .../>}
       {modalState.type === 'deleteConfirm' && <DeleteConfirmModal .../>}

       {/* FAB: "Refresh Health" — dashboard only, bottom-[6.5rem] right-6 */}
       {/* Calls serviceHealth.checkAll(), icon spins when loading */}
    </>
  ) : (
    <GPUCalculatorPage />
  )}

  {/* FAB: "Refresh Health" — dashboard only, always visible to all roles */}

  {/* FAB: "Add PC" — double-guarded: { currentPage === 'dashboard' && isAdmin }
     Button is entirely hidden from the DOM for non-admin users. bottom-6 right-6.
     onClick={handleOpenAddPc (also role-gated as redundant protection)}. */}
</div>
```

---

### 📄 index.css

Global CSS entry point for Tailwind CSS. Imports the three standard Tailwind directives (`@tailwind base`, `@tailwind components`, `@tailwind utilities`) which pull in Tailwind's foundational styles, component-level classes, and utility classes respectively. No custom CSS rules are defined in this file; all styling is handled through Tailwind utility classes applied directly in JSX templates.

#### Content

| Directive | Purpose |
|-----------|---------|
| `@tailwind base` | Resets browser defaults, sets base typography and colours. |
| `@tailwind components` | Provides pre-styled component classes (e.g., buttons, forms if configured). |
| `@tailwind utilities` | Enables all utility-first classes used throughout the JSX (`bg-*`, `text-*`, `p-*`, `grid-*`, etc.). |

---

## 🔄 Changes in this update

### Removal of `handleSave` no-op and corresponding `onSave` prop on `<Header>`
- **Removed** the no-op function `const handleSave = () => {}` from `App.jsx`. This callback had previously been passed as `onSave={handleSave}` to the `<Header>` component. The Header's `handleExport()` method independently performs JSON serialization and download; this orphaned parent-level callback served no purpose.
- **Removed** the `onSave` prop from the `<Header>` JSX rendering in `App.jsx`. The `<Header>` now receives four props: `currentPage`, `onPageChange`, `pcs`, and `onAddPc`.

### Service Health Check hook integration (new)
- **Added** `useServiceHealth` to imports table and description. Hook is instantiated after mutation hooks, before modal state.
- **Updated** internal state table: new row for `serviceHealth` documenting the exported `loading` boolean and `checkAll()` method, along with the dual wiring (prop to `<PCGrid>`, onClick on FAB button).
- **Updated** render logic section: added `serviceHealth` prop to `<PCGrid>` signature in the render pseudocode. Added comments for both FAB buttons ("Refresh Health" at `bottom-[6.5rem] right-6` and "Add PC" at `bottom-6 right-6`), noting dashboard-only guard and spinning icon on loading state.
- **Updated** data flow diagram: added `useServiceHealth → TCP probe manager, result passed to PCGrid + wired to FAB button` line.

### Verification of child docs (2026-06-07)
- **utils/ subfolder** — Re-verified. Child documentation (`./src/utils.md`) was updated to confirm calculatorEngine.js source code alignment. All documented exports, validation helpers, and attention-architecture dispatch paths remain accurate.

### T014 — Wrap App with AuthProvider
- **Updated** `main.jsx`: added import of `{ AuthProvider }` from `./context/AuthContext.jsx`. The `<App />` component is now wrapped inside `<AuthProvider>...</AuthProvider>` within `<React.StrictMode>`, making the authentication context (`useAuth`) available to every component in the tree via React's Context API.
- **Updated** imports table: added row for `./context/AuthContext.jsx` → `AuthProvider` (Internal).
- **Updated** file description and boot sequence: documented the provider wrapper at the application root level.

### T015 — Route protection and role-gating in App.jsx
- **Added** two new imports to the imports table: `useAuth` from `./context/AuthContext.jsx` and `LoginPage` from `./components/LoginPage.jsx`.
- **Updated** file description: now mentions route protection (loading guard, unauthenticated redirect) and role-gated CRUD handlers.
- **Added** rows to internal state table for `{ user, isAuthenticated, isLoading }` from `useAuth()` and derived `isAdmin` flag.
- **Updated** App component description: documented the two-tier auth pattern — loading spinner while session resolves (before data hooks), `<LoginPage />` for unauthenticated users.
- **Updated** all eight role-gated handlers with ⭐ Role-gated annotation: `handleEditPc`, `handleOpenAddPc` (new), `handleDeletePc`, `handleAddService`, `handleEditService`, `handleEditServiceSubmit`, `handleDeleteService`, `handleConfirmDelete`. All use `isAdmin ? realHandler : () => {}` ternary pattern.
- **Added** new handler `handleOpenAddPc()` documentation — FAB "Add PC" button wired via `onClick={handleOpenAddPc}` (replaces previous inline expression).
- **Documented** that `handleAddPc` and `handleSaveService` remain un-gated as modal-on-save callbacks only reachable through gated entry points.
- **Added** "Auth guards (early returns before main render)" section detailing the two top-level guards with their effect on hook invocation order.
- **Updated** data flow diagram: updated App.jsx boot sequence paragraph to mention auth check firing before `usePcs()`.

### T016 — Pass `isAdmin` prop to `<PCGrid>` and double-guard "Add PC" FAB
- **Updated** file-level description of `App.jsx`: now mentions that the `isAdmin` flag is passed as a prop to `<PCGrid>` so child components can hide admin-only UI from the DOM. Documented the double-guard pattern for the "Add PC" FAB: `{ currentPage === 'dashboard' && isAdmin }`.
- **Updated** boot sequence step 4: added mention of `isAdmin` prop propagation to `<PCGrid>` and FAB double-guarding.
- **Updated** render logic pseudocode**: PCGrid now shows `isAdmin` prop; "Add PC" FAB is documented as double-guarded (dashboard + admin check). Header no longer receives `onAddPc`.

---

## Cross-cutting patterns

### Mutation lifecycle (for all CRUD hooks)

```
UI Action (button click, form submit)
  → App.jsx callback handler
    → hook.mutate(payload)
      → services/*.js domain function
        → services/apiClient.js → fetch()
          → Backend REST API
            ← response { data, error }
      ← hook result processing
        onSuccess: refetch (if success)
        return { data, error } to caller
    ← handler checks for error
      → if (!error): closeModal()
```

Every mutation in the application follows this identical chain. The `onSuccess` callback is uniformly set to `refetch`, ensuring UI state synchronises with the server after any change without requiring manual re-fetching logic per-mutation.

### Shared colour and clamping pipeline

All GPU-related visual components (`GPUBar`, `GPUDetails`, calculator's `ResultsDisplay`) share the same colour-coding and percentage-clamping logic from `utils/gpuHelpers.js`. This guarantees cross-module visual consistency: a 70% VRAM usage bar renders identically green/yellow/red in the dashboard as it does in the calculator.

### Validator coupling

Both modal groups (PC modals and service modals) import validators from `utils/validators.js`. Service modals additionally depend on `gpuHelpers.getRemainingVram` for capacity checks. This ensures form validation uses the same VRAM accounting logic that the dashboard itself relies on for display — no duplication of capacity-checking formulas.
