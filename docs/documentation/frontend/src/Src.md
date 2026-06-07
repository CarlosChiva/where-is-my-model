# Src

> Path: `frontend/src/`
> Last updated: 2026-06-07
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
2. The root `<App />` component is rendered inside `<React.StrictMode>`.
3. On mount, `usePcs()` hook fires its initial data fetch from the backend (`GET /api/pcs`).
4. Once data arrives, `<Header>` and `<PCGrid>` render with live server information.

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
          ╱    │    ╲
         ╱     │     ╲
  headers/nav mutation  page router
   callbacks   hooks ↕  ─── 'dashboard' branch:
       │      services/        Header.jsx
       │        │              PCGrid.jsx → PCCard.jsx → ServiceRow.jsx / GPUDetails.jsx
       ▼        ▼              Modals wired by modalState.type
  usePcs    apiClient          (AddPcModal, EditPcModal, AddServiceModal, ...)
  useCreatePc   ←── fetch ──┐
  useUpdatePc               │
  useDeletePc               ▼
  useCreateService      Backend REST API
  useUpdateService         (/api/pcs, /api/pcs/:id/services)
  useDeleteService
  useServices
       │
       ▼
  utils/ (validators, calculatorEngine, gpuHelpers)
  └── shared colour coding + VRAM maths across dashboard AND calculator
```

---

## 📄 Direct files

### 📄 main.jsx

Bootstraps the React application. Mounts the `<App />` root component into a DOM element with `id="app"` inside strict mode. Imports and applies global Tailwind CSS directives from `index.css`. This file is the sole entry point specified in the Vite configuration.

#### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `React` | External |
| `react-dom/client` | `ReactDOM` | External |
| `./App.jsx` | `default` (component) | Internal |
| `./index.css` | — (side-effect import) | Internal |

---

### 📄 App.jsx

Top-level application shell and orchestrator component. Owns all top-level state: the master PC list (`usePcs`), six mutation hooks for CRUD operations on PCs and services (`useCreatePc`, `useUpdatePc`, `useDeletePc`, `useCreateService`, `useUpdateService`, `useDeleteService`), a modal router state object, and the page-switching state. Provides callback handlers that bridge UI actions (from `<Header>` and `<PCGrid>`) to mutation hooks and modal state transitions. Conditionally renders either the full dashboard layout with modals or the GPU Calculator page.

#### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `useState` | External |
| `./hooks/usePcs.js` | `default` (hook) | Internal |
| `./hooks/useCreatePc.js` | `default` (hook) | Internal |
| `./hooks/useUpdatePc.js` | `default` (hook) | Internal |
| `./hooks/useDeletePc.js` | `default` (hook) | Internal |
| `./hooks/useServices.js` | `default` (hook) | Internal |
| `./hooks/useCreateService.js` | `default` (hook) | Internal |
| `./hooks/useUpdateService.js` | `default` (hook) | Internal |
| `./hooks/useDeleteService.js` | `default` (hook) | Internal |
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
| `pcs`, `loading`, `refetch` (from `usePcs()`) | — | Master PC list fetched from backend, auto-refetched after any mutation via the hooks' `onSuccess` callbacks. |
| `createPcHook`, `updatePcHook`, `deletePcHook`, `createServiceHook`, `updateServiceHook`, `deleteServiceHook` (from respective hooks) | — | Mutation hooks with `loading`, `error`, `mutate`, and `clearError`. All wired to `refetch` on success. |
| `modalState` (`{ type, payload }`) | `{ type: null, payload: null }` | Single-object modal router; `type` determines which dialog renders, `payload` carries data to it. |
| `currentPage` | `'dashboard'` | Page switcher between dashboard and calculator views. |

**Internal functions:**

- **`closeModal() → void`**
  Resets `modalState` to `{ type: null, payload: null }`, dismissing any open dialog.

- **`handleAddPc(pcData: Object) → Promise<void>`**
  Calls `createPcHook.mutate(pcData)` and closes the modal on success (no error returned).

- **`handleEditPc(pc: Object) → Promise<void>`**
  Extracts `_id` (with fallback to `id`) from `pc`, calls `updatePcHook.mutate({ id, data: pc })`, closes modal on success.

- **`handleDeletePc({ pcId, nombre }: Object) → void`**
  Opens the `<DeleteConfirmModal>` with `actionType: 'pc'`. Does not perform deletion directly — defers to confirmation handler.

- **`handleAddService({ pcId, gpus, servicios }: Object) → void`**
  Opens the `<AddServiceModal>` with PC context (GPU inventory + existing services).

- **`handleSaveService(serviceData: Object) → Promise<void>`**
  Deconstructs `pcId` from `serviceData`, calls `createServiceHook.mutate({ pcId, data })`, closes modal on success.

- **`handleEditService({ pcId, index, service, gpus, services }: Object) → void`**
  Opens the `<EditServiceModal>` with full edit context.

- **`handleEditServiceSubmit(serviceData: Object) → Promise<void>`**
  Called by `EditServiceModal.onSave`. Extracts `pcId`, `index`, and remaining fields as `data`. Calls `updateServiceHook.mutate({ pcId, index, data })`, closes modal on success.

- **`handleDeleteService({ pcId, index }: Object) → void`**
  Opens the `<DeleteConfirmModal>` with `actionType: 'service'`. Defers actual deletion to confirmation handler.

- **`handleConfirmDelete() → Promise<void>`**
  Universal delete confirmation handler. Inspects `modalState.payload.actionType`: routes to `deletePcHook.mutate(pcId)` for `'pc'` or `deleteServiceHook.mutate({ pcId, index })` for `'service'`. Closes modal on success. Both hooks fire `refetch` via their `onSuccess` callbacks.

- **`handlePageChange(page: string) → void`**
  Switches the active page and atomically resets any open modal to prevent lingering dialogs.

- **`handleSave() → void`**
  No-op handler passed to `<Header>` as the export callback (Header handles JSON serialization internally).

**Derived values:**

- **`deleteMessage: string`** — Dynamically constructs a confirmation message based on `modalState.payload.actionType`: specific server name for PC deletion, generic message for service deletion. Falls back to empty string if no payload.

**Render logic:**

```
<div className="min-h-screen ...">
  <Header              currentPage /> onPageChange /> pcs /> onAddPc /> onSave />
  
  {currentPage === 'dashboard' ? (
    <>
      <PCGrid   pcs /> loading /> onEditPc /> onAddService /> onDeletePc />
                   onEditService /> onDeleteService />
      
      {/* Modal routing — one of five modals conditionally rendered */}
      {modalState.type === 'addPc'        && <AddPcModal .../>}
      {modalState.type === 'editPc'       && <EditPcModal .../>}
      {modalState.type === 'addService'   && <AddServiceModal .../>}
      {modalState.type === 'editService'  && <EditServiceModal .../>}
      {modalState.type === 'deleteConfirm' && <DeleteConfirmModal .../>}
    </>
  ) : (
    <GPUCalculatorPage />
  )}
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
