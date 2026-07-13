# `src`

> Path: `frontend/src/`
> Last updated: 2026-07-13
> Type: Composite folder

React source files for the GPU Infrastructure Dashboard frontend application, scaffolded with Vite. Contains the application entry point, root component, Tailwind CSS base imports, a React Context layer (`context/`) for global authentication state management, a REST API client layer (`services/`), a general-purpose utility module (`utils/`) providing slugification, GPU colour helpers, and form validators. Business logic components are added in subsequent tasks.

---

## 📁 Subfolders

| Folder | Documentation | Description |
|--------|--------------|-------------|
| `components/` | [see docs](./src/components.md) | React UI components for the GPU dashboard: presentational components (Header, GPUBar, GPUDetails, ServiceRow, PCCard, PCGrid) and a `Modals/` subfolder containing five modal-dialog components for data-entry, editing, and deletion flows. |
| `context/` | [see docs](./src/context.md) | React Context layer for global application state — currently `AuthContext.jsx` providing authentication session management (user, token, login/register/logout actions) via a custom `useAuth()` hook. |
| `hooks/` | [see docs](./src/hooks.md) | Custom React hooks for data fetching (loading the master list of GPU servers, per-server services, and application users) and CRUD mutation operations (create, update, delete for PCs and services). |
| `services/` | [see docs](./src/services.md) | REST API client layer: generic HTTP request wrapper with JSON serialization and error envelope, plus thin domain-specific modules for PC CRUD, Service CRUD, and user authentication (register, login, profile retrieval). |
| `utils/` | [see docs](./src/utils.md) | General-purpose utility module: `slugify.js` (URL-safe slug generation), `gpuHelpers.js` (GPU colour mapping, value clamping, per-GPU VRAM computation, and remaining-VRAM queries — four named exports), and two named-export validators for PC and Service forms. |

---

## 📄 Direct files

## 📄 `App.jsx`

Root React component of the GPU Infrastructure Dashboard. Orchestrates the full application: enforces authentication at the top level (loading guard while auth resolves, unauthenticated redirect to `<LoginPage />`). All React hooks — `useAuth`, `usePcs`, six mutation hooks, `useServiceHealth`, and both `useState` calls — fire unconditionally at the top of the component **before** any early returns, in strict compliance with React's Rules of Hooks (fixed: previously `usePcs()` and mutation hooks invoked only "behind auth gates", causing "order of Hooks changed" errors between renders). A service health check hook (`useServiceHealth`) for per-service TCP status monitoring with per-PC loading tracking. Two separate `useEffect` hooks coordinate post-login data loading: **(1) a post-auth refetch effect** reloads the master PC list when authentication state changes (dependencies: `[isAuthenticated, isLoading, refetch]`); **(2) an initial health check effect** runs once after PCs load, guarded by a `useRef(false)` flag (`healthCheckedRef`) to prevent infinite re-firing (dependencies: `[isAuthenticated, pcs, serviceHealth]`). Manages modal routing via a single state object, renders two floating action buttons ("Refresh Health" and "Add PC") on the dashboard view. The "Refresh Health" FAB passes `pcs.map(pc => pc._id)` to `checkAll()` and uses `serviceHealth.anyPcLoading()` (boolean helper) for the spinner animation — replacing the legacy flat `serviceHealth.loading` boolean. Uses a three-way page router to conditionally render the **dashboard** (PC card grid + modals), **admin** (`<AdminPanel />`, self-contained user management), or **calculator** (`<GPUCalculatorPage />`). Eight CRUD handlers are role-gated (admin-only) — non-admin users receive silent no-op functions that prevent destructive operations without generating 401 errors. Each mutation hook is wired to `refetch` the master PC list on success. The `<AdminPanel>` component is fully self-contained — no hooks or callbacks were lifted into `App.jsx` for it.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `useState`, `useEffect`, `useRef` | External |
| `./context/AuthContext.jsx` | `useAuth` | Internal |
| `./components/LoginPage.jsx` | `LoginPage` | Internal |
| `./hooks/usePcs.js` | `usePcs` | Internal |
| `./hooks/useCreatePc.js` | `useCreatePc` | Internal |
| `./hooks/useUpdatePc.js` | `useUpdatePc` | Internal |
| `./hooks/useDeletePc.js` | `useDeletePc` | Internal |
| `./hooks/useCreateService.js` | `useCreateService` | Internal |
| `./hooks/useUpdateService.js` | `useUpdateService` | Internal |
| `./hooks/useDeleteService.js` | `useDeleteService` | Internal |
| `./hooks/useServiceHealth.js` | `useServiceHealth` | Internal |
| `./components/Header.jsx` | `Header` | Internal |
| `./components/PCGrid.jsx` | `PCGrid` | Internal |
| `./components/GpuCalculator/GPUCalculatorPage.jsx` | `GPUCalculatorPage` | Internal |
| `./components/AdminPanel.jsx` | `AdminPanel` | Internal |
| `./components/Modals/AddPcModal.jsx` | `AddPcModal` | Internal |
| `./components/Modals/EditPcModal.jsx` | `EditPcModal` | Internal |
| `./components/Modals/AddServiceModal.jsx` | `AddServiceModal` | Internal |
| `./components/Modals/EditServiceModal.jsx` | `EditServiceModal` | Internal |
| `./components/Modals/DeleteConfirmModal.jsx` | `DeleteConfirmModal` | Internal |

### Internal state

| Hook | Variable | Initial value | Role |
|------|----------|---------------|------|
| `useAuth` | `{ user, isAuthenticated, isLoading }` | — | Authentication context consumer. `user` holds the current user object (with `role` field), `isAuthenticated` is a boolean guard, `isLoading` indicates whether the session check is still in progress (firewall before any data hooks). |
| *(derived)* | `isAdmin` | — | Computed flag: `user?.role === 'admin'`. Used by all role-gated CRUD handlers to decide whether to wire real callbacks or silent no-ops. |
| `usePcs` | `{ data: pcs, loading, refetch }` | — | Master PC list hook — fetches the full fleet of GPU servers, exposes `pcs` (array), `loading` (boolean), and `refetch` (stable callback for manual re-fetching). Auto-fetches on mount when a token is present in `localStorage`. Used by the post-auth refetch effect (see below) to reload data after login. |
| `useState` | `modalState` | `{ type: null, payload: null }` | Modal router — `type` determines which modal renders, `payload` carries data forwarded to it. |
| `useState` | `currentPage` | `'dashboard'` | Page router — switches between `'dashboard'` (default), `'admin'`, and `'calculator'` views. Changing pages also closes any open modal via `handlePageChange`. Both FAB buttons are scoped to the dashboard only (`{ currentPage === 'dashboard' && ... }`). The "Add PC" FAB additionally requires `isAdmin` to be truthy. |
| `useServiceHealth` | `serviceHealth` | — | Health check hook instance that tracks per-PC loading state via a `Set<string>` internally. Exposes: `statuses` (flat map of service health states), `loadingPcs` (set of PC IDs currently being probed), `isPcLoading(pcId)` (is a specific PC loading?), `anyPcLoading()` (is any PC loading?, returns boolean), `checkSinglePc(pcId)` (probe one PC), and `checkAll(pcIds)` (fire concurrent probes for the given PC ID list). Passed as `serviceHealth` prop to `<PCGrid>`. Wired to the "Refresh Health" FAB via `onClick={() => serviceHealth.checkAll(pcs.map(pc => pc._id))}`. Spinner uses `serviceHealth.anyPcLoading()` to determine if the refresh icon should animate. Also consumed by the initial health check effect which passes `pcs.map(pc => pc._id)` to `checkAll()` after PCs load. |
| `useRef` | `healthCheckedRef` | `false` | One-time guard for the initial health check effect. Prevents `checkAll()` from running repeatedly whenever `pcs` or `serviceHealth` change. Set to `true` after the first successful health probe, causing all subsequent effect invocations to short-circuit via `if (healthCheckedRef.current) return`. |

### Callback handlers

- **`closeModal() → void`**
  Resets `modalState` to `{ type: null, payload: null }`, closing any open modal.

- **`handlePageChange(page: string) → void`**
  Switches the active page (between `'dashboard'`, `'admin'`, and `'calculator'`) and closes any open modal. Modals are scoped to the dashboard; navigating away from it dismisses them automatically.

- **`deleteMessage` (derived)**
  Builds a confirmation message from `modalState.payload`. If `actionType === 'pc'`, includes the server name (`nombre`). Otherwise, uses a generic service-deletion message. Evaluated as an inline ternary during render.

- **`handleAddPc(pcData: Object) → Promise<void>`**
  Persists a new GPU server via `createPcHook.mutate(pcData)`. On success (no error in result), closes the modal. The `refetch` callback fires automatically. **Not role-gated** — it is only reachable as a modal-on-save callback, and the "Add PC" FAB opens via the gated `handleOpenAddPc` handler, so non-admins never reach this function.

- **`handleEditPc(pc: Object) → Promise<void>` ⭐ Role-gated**
  Admin: persists an edited GPU server via `updatePcHook.mutate({ id, data })`. On success (no error in result), closes the modal. Non-admin: silent no-op `() => {}`. Uses ternary pattern `isAdmin ? realHandler : () => {}` to prevent API calls from unauthorized users without generating 401 errors.

- **`handleOpenAddPc() → void` ⭐ Role-gated**
  Admin: opens the Add PC modal via `setModalState({ type: 'addPc', payload: null })`. Non-admin: silent no-op `() => {}`. Wired to the "Add PC" FAB button. Replaces the previous inline `onClick` expression on the FAB.

- **`handleDeletePc({ pcId, nombre }) → void` ⭐ Role-gated**
  Admin: opens `DeleteConfirmModal` with `actionType: 'pc'` and the server name for the confirmation message. Non-admin: silent no-op `() => {}`.

- **`handleAddService({ pcId, gpus, servicios }) → void` ⭐ Role-gated**
  Admin: opens `AddServiceModal` with PC context: the server ID, full GPU array (`gpus`), and existing services array (`servicios`). Non-admin: silent no-op `() => {}`. This replaces the legacy `{ pcId, vram, currentGpuUsed }` shape (T12) so the modal can perform per-GPU capacity validation and render a GPU selector dropdown.

- **`handleSaveService(serviceData) → Promise<void>`**
  Persists a new service via `createServiceHook.mutate({ pcId, data })` and closes the modal. **Not role-gated** — it is only reachable as a modal-on-save callback (the modal opens via gated `handleAddService`), so non-admins never reach this function.

- **`handleEditService({ pcId, index, service, gpus, services }) → void` ⭐ Role-gated**
  Admin: opens `EditServiceModal` with the service data and full PC GPU/services context (T13). Non-admin: silent no-op `() => {}`. Replaces the legacy `{ pcId, index, service, vram, currentGpuUsed }` signature. Forwards `gpus` and `services` through the modal state payload so EditServiceModal can perform per-GPU capacity validation and render a GPU selector dropdown.

- **`handleEditServiceSubmit(serviceData) → Promise<void>` ⭐ Role-gated**
  Admin: persists an edited service via `updateServiceHook.mutate({ pcId, index, data })` and closes the modal. Non-admin: silent no-op `() => {}`.

- **`handleDeleteService({ pcId, index }) → void` ⭐ Role-gated**
  Admin: opens `DeleteConfirmModal` with `actionType: 'service'`. Non-admin: silent no-op `() => {}`.

- **`handleConfirmDelete() → Promise<void>` ⭐ Role-gated**
  Admin: confirmation handler for delete modals. Dispatches based on `modalState.payload.actionType`: `'pc'` calls `deletePcHook.mutate(pcId)`, `'service'` calls `deleteServiceHook.mutate({ pcId, index })`. Awaits the mutation result and only closes the modal on success (`if (!result?.error) { closeModal(); }`). On error, the modal stays open and the `DeleteConfirmModal` displays the API error banner. Non-admin: silent no-op `() => {}`.

### Effects (two separate `useEffect` hooks — infinite loop fix)

The previous single `useEffect` that combined PC refetching and health checking triggered an infinite loop: the health check's `checkAll()` call would trigger a state update, which caused the effect to re-run (since `pcs` and `serviceHealth` were in the dependency array), which called `checkAll()` again, creating an unending cycle. The fix splits the logic into two independently-gated effects.

#### **Effect 1 — Post-auth refetch** _(lines 51–55)_

Refetches the master PC list when authentication state changes.

```js
if (isAuthenticated && !isLoading) { refetch(); }
```

- **Condition**: `isAuthenticated` is `true` AND `isLoading` is `false`.
- **Action**: Calls `refetch()` from `usePcs()` to reload the fleet list from the backend.
- **Dependency array:** `[isAuthenticated, isLoading, refetch]` — tightly coupled to auth state only; does **not** depend on `pcs`, `serviceHealth`, or any data that mutates as a side effect.
- **Purpose**: When a user logs in, the token is written but `usePcs()` has already mounted (React Rules of Hooks require unconditional hook calls). This effect ensures fresh data is loaded immediately after the auth transition.

#### **Effect 2 — Initial health check** _(lines 58–68)_

Runs a one-time health probe across all loaded PCs after the initial data load.

```js
const healthCheckedRef = useRef(false);

if (healthCheckedRef.current) return;
if (!isAuthenticated || pcs.length === 0) return;
healthCheckedRef.current = true;
if (serviceHealth.checkAll) {
  const ids = pcs.map(pc => pc._id);
  serviceHealth.checkAll(ids);
}
```

- **Guard 1**: `if (healthCheckedRef.current) return` — after the first successful run, every subsequent re-render short-circuits immediately. This prevents the infinite loop that occurred when effect dependencies changed.
- **Guard 2**: `if (!isAuthenticated || pcs.length === 0) return` — does nothing until the user is authenticated and the PC list is populated.
- **Action**: Calls `serviceHealth.checkAll(ids)` where `ids = pcs.map(pc => pc._id)` — fires concurrent health probes for each loaded PC.
- **Dependency array:** `[isAuthenticated, pcs, serviceHealth]` — reacts to auth state, PC list changes, and health hook reinitialization. The `useRef` guard ensures that even though these dependencies change frequently, `checkAll()` executes only once.
- **Purpose**: Probes service health on first dashboard load without repeating on every subsequent PC list update or service state change.

> **Bug (infinite loop):** When `checkAll()` was called from within the same effect that tracked `pcs` or `serviceHealth` in its dependency array, the health state mutation from `checkAll()` triggered a re-render, which re-ran the effect → called `checkAll()` again → infinite cycle. The `useRef(false)` pattern breaks this cycle by making the health check a **one-time operation**: it fires once and never again, regardless of dependency changes. The refetch effect, which only depends on auth flags, cannot cause a similar loop because `refetch()` itself does not mutate `isAuthenticated` or `isLoading`.

### Auth guards (early returns before main render)

Two top-level guards execute **after** all hooks have fired unconditionally (to comply with React's Rules of Hooks):

1. **Loading guard** (`if (isLoading)`): Returns a full-screen spinner (`min-h-screen bg-bg-primary flex items-center justify-center` with an animated SVG). Because `usePcs()` has already fired at this point, the data-fetching hook is active — but the dashboard JSX does not render until auth resolves, visually preventing stale/empty UI display.
2. **Unauthenticated guard** (`if (!isAuthenticated)`): Returns `<LoginPage />`, preventing any dashboard render for unauthenticated users.

> **T017 fix:** Previously these guards executed *before* `usePcs()` and mutation hooks were invoked, causing a "order of Hooks changed" invariant violation whenever the component went from rendering the guard (N hooks called) to rendering the dashboard (N+8 hooks called). All hooks are now called unconditionally at the top of the component body, before any conditional return statement. The guards still prevent dashboard JSX rendering — they no longer block hook invocation (the hooks themselves internally handle auth-state-dependent behavior).

### Render structure

The component renders (only reached after both auth guards pass):
1. **`Header`** — server count summary, "Add PC" button, and "Export JSON" button (which internally serializes `pcs` to a timestamped JSON file download via native browser APIs).
2. **`PCGrid`** — responsive grid of PC cards with editing, add-service, and delete actions. Receives `serviceHealth={serviceHealth}` for per-service TCP status display within each card. Receives `isAdmin={isAdmin}` to gate admin-only action buttons inside the grid (hides edit/delete/add-service UI from non-admin users entirely).
3. **FAB buttons** (dashboard-only):
    * **"Refresh Health"** — positioned at `bottom-[6.5rem] right-6` (above the "Add PC" FAB). Calls `serviceHealth.checkAll(pcs.map(pc => pc._id))` on click, passing the current PC ID array so the hook fires concurrent `checkSinglePc(id)` calls for each loaded server. The wrapper SVG `<span>` gets a conditional `animate-spin` class when `serviceHealth.anyPcLoading()` returns `true` (i.e., at least one PC is being probed), providing visual feedback during health checks. Same styling as the existing "Add PC" FAB: `w-12 h-12 md:w-14 md:h-14`, rounded, accent-coloured, with shadow and hover/active transitions.
    * **"Add PC"** — positioned at `bottom-6 right-6`. Conditional render guard is `currentPage === 'dashboard' && isAdmin` (dual-gated: dashboard page AND admin role). Calls `handleOpenAddPc` on click which opens the AddPcModal. Non-admin users never see this button at all — it is conditionally rendered out entirely when `isAdmin` is falsy.
3. **Modal routing** — conditionally renders one of five modals based on `modalState.type`:
   - `'addPc'` → `AddPcModal` (receives `loading`, `error`, `clearError` from `createPcHook`)
   - `'editPc'` → `EditPcModal` (receives `loading`, `error`, `clearError` from `updatePcHook`)
     - `'addService'` → `AddServiceModal` (receives `pcId`, `pcGpus={modalState.payload.gpus ?? []}`, `pcServices={modalState.payload.servicios ?? []}`, plus `loading`, `error`, `clearError` from `createServiceHook`)
       - `'editService'` → `EditServiceModal` (receives `pcId`, `serviceIndex`, `service`, `pcGpus={modalState.payload.gpus ?? []}`, `pcServices={modalState.payload.services ?? []}`, plus `loading`, `error`, `clearError` from `updateServiceHook`)
    - `'deleteConfirm'` → `DeleteConfirmModal` (receives `loading` and `error` from `deletePcHook` or `deleteServiceHook`, selected by `actionType`)

### Loading/Error props passed to EditPcModal

The `EditPcModal` receives three state props from `updatePcHook`:
- `loading={updatePcHook.loading}` — disables submit button and shows spinner during API call.
- `error={updatePcHook.error}` — displays API error banner in the modal.
- `clearError={updatePcHook.clearError}` — clears stale error on modal mount.

### Loading/Error props passed to DeleteConfirmModal

The `DeleteConfirmModal` receives two state props, selected dynamically based on `modalState.payload?.actionType`:
- `loading={modalState.payload?.actionType === 'pc' ? deletePcHook.loading : deleteServiceHook.loading}` — disables both Cancel and Delete buttons during API call; Delete button shows spinning SVG with "Deleting..." text.
- `error={modalState.payload?.actionType === 'pc' ? deletePcHook.error : deleteServiceHook.error}` — displays API error banner in the modal when the mutation fails.

The hook selection mirrors the `handleConfirmDelete` dispatch logic: `'pc'` → `deletePcHook`, `'service'` → `deleteServiceHook`.

### Loading/Error props passed to EditServiceModal

The `EditServiceModal` receives three state props from `updateServiceHook`:
- `loading={updateServiceHook.loading}` — disables submit button and shows spinner ("Updating...") during API call.
- `error={updateServiceHook.error}` — displays API error banner in the modal.
- `clearError={updateServiceHook.clearError}` — clears stale error on modal mount.

**T13 addition:** The rendering of `EditServiceModal` now also passes data props `pcGpus={modalState.payload.gpus ?? []}` and `pcServices={modalState.payload.services ?? []}`, replacing the legacy `pcVram`/`currentGpuUsed` approach. These enable per-GPU capacity validation, GPU selector dropdown with pre-selection of the current `assignedGpu`, and cross-GPU reassignment checks within the modal itself.

---

## 📄 `main.jsx`

Application bootstrap entry point. Mounts the React tree into the DOM by locating the `#app` element from `index.html`, wraps `App` in `React.StrictMode`, and applies global Tailwind CSS imports.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `React` | External |
| `react-dom/client` | `ReactDOM` | External |
| `./context/AuthContext.jsx` | `AuthProvider` | Internal |
| `./App.jsx` | `App` | Internal |
| `./index.css` | *(CSS side-effect import)* | Internal |

### Functions

*(No standalone functions — file executes mount logic at the module level.)*

**Module-level behavior:**

- **`ReactDOM.createRoot(node).render(children)`**
  Initializes a React 19 root with strict mode and renders the `App` component wrapped in `<AuthProvider>` into the DOM node identified by `getElementById('app')`.
  - Mounts `<React.StrictMode><AuthProvider><App /></AuthProvider></React.StrictMode>` as the application tree. The `<AuthProvider>` makes the authentication context (`useAuth`) available to every component in the tree via React's Context API.

---

## 📄 `index.css`

Global stylesheet that activates Tailwind CSS's three-layer directive system. Serves as the single CSS entry point imported from `main.jsx`. Currently contains only the base Tailwind directives; custom theme extensions and component styles will be added in T009 (Tailwind theme configuration) and beyond.

### CSS Directives

| Directive | Purpose |
|-----------|---------|
| `@tailwind base` | Loads Tailwind's preflight/reset and base typography utilities |
| `@tailwind components` | Loads component-level utility classes |
| `@tailwind utilities` | Loads on-demand utility classes generated from template content |

---
## 🔄 Changes in this update

- **Converted** `src.md` from Leaf → Composite folder type (`frontend/src/` now contains a subfolder: `utils/`).
- **Added** Subfolders table with entry for `utils/` linking to the newly created `./src/utils.md`.
- **Updated** general description to mention the new utility module.
- **Created** `docs/documentation/frontend/src/utils.md` — full leaf documentation for three new utility files from task T011:
  - `slugify.js` — default export `slugify(str)`: Unicode NFD → remove diacritics → lowercase → hyphenate → collapse hyphens → strip edges.
  - `gpuHelpers.js` — named exports `getGpuColorClass(percent)` (Tailwind colour class from GPU %, three thresholds: green ≤35, yellow ≤70, red >70) and `clamp(value, min, max)` (numeric range restriction, NaN-safe).
  - `validators.js` — named exports `validatePcForm(data)` (IP octet check, VRAM ≥ 1, name required) and `validateServiceForm(data)` (port 1–65535, GPU ≥ 0, name required), both returning `{ valid, errors }`.

### T7 — App.jsx full implementation and EditPcModal integration
- **Replaced** placeholder `App.jsx` documentation with full implementation: all imports (8 hooks + 5 modal components + Header + PCGrid), internal state (`modalState`), all callback handlers (`closeModal`, `handleAddPc`, `handleEditPc`, `handleDeletePc`, `handleAddService`, `handleSaveService`, `handleEditService`, `handleEditServiceSubmit`, `handleDeleteService`, `handleConfirmDelete`), render structure with modal routing, and EditPcModal loading/error props wiring.
- **Documented** that `handleEditPc` only closes the modal on success, leaving it open with an error banner on failure.
- **Added** section documenting the `loading`, `error`, and `clearError` props passed from `updatePcHook` to `EditPcModal`.

### T8 — DeleteConfirmModal loading/error props integration in App.jsx
- **Updated** `handleConfirmDelete` documentation: now awaits mutation result and only closes the modal on success (`if (!result?.error) { closeModal(); }`). On error, the modal stays open and the `DeleteConfirmModal` displays the API error banner.
- **Updated** render structure: `DeleteConfirmModal` now receives `loading` and `error` props, selected dynamically based on `actionType` (`'pc'` → `deletePcHook`, `'service'` → `deleteServiceHook`).
- **Added** section documenting the `loading` and `error` props passed from the delete hooks to `DeleteConfirmModal`.

### T10 — EditServiceModal loading/error/clearError props integration in App.jsx
- **Updated** render structure: `AddServiceModal` now explicitly documented as receiving `loading`, `error`, `clearError` from `createServiceHook`.
- **Updated** render structure: `EditServiceModal` now receives `loading={updateServiceHook.loading}`, `error={updateServiceHook.error}`, and `clearError={updateServiceHook.clearError}` from `updateServiceHook`.
  - **Added** section documenting the `loading`, `error`, and `clearError` props passed from `updateServiceHook` to `EditServiceModal`.

### T13 — Export JSON functionality in Header and updated data flow
- **Updated** render structure: `Header` description now reads "server count summary + add/save action buttons" reflecting that the save button has been replaced by an "Export JSON" button that handles export internally via native browser APIs.
- **Updated** `handleSave` documentation: comment now reads "No-op onSave passed to Header — the component handles export internally." The function remains as a no-op `{}` for backward compatibility but is documented as such.
- **Added** note that `Header.jsx` now implements `handleExport` internally (Blob + URL.createObjectURL + timestamped filename download), serializing the `pcs` data array to a `.json` file. The `onSave` callback is still invoked by `Header` after the export for backward compatibility.

### New — services/ subfolder documentation
- **Created** `docs/documentation/frontend/src/services.md` — full leaf documentation for the `frontend/src/services/` folder, documenting three files:
  - `apiClient.js` — Core HTTP request wrapper (`_request`) providing automatic JSON serialization, Content-Type handling, uniform `{ data, error }` envelope, and four exported HTTP methods (`get`, `post`, `put`, `del`).
  - `pcApi.js` — Thin wrapper around `apiClient` for PC CRUD: `fetchPcs()`, `createPc()`, `updatePc()`, `deletePc()`.
  - `serviceApi.js` — Thin wrapper around `apiClient` for Service CRUD: `fetchServices()`, `createService()`, `updateService()`, `deleteService()`.
- **Updated** `src.md` subfolders table: added entry for `services/` linking to `./src/services.md`.
- **Updated** general description to mention the new REST API client layer (`services/`).

### T12 — AddServiceModal refactor: GPU selector, per-GPU capacity check, assignedGpu payload
- **Updated** `handleAddService` handler documentation: now accepts `{ pcId, gpus, servicios }` instead of legacy `{ pcId, vram, currentGpuUsed }`. Forwards `gpus` and `servicios` through the modal state payload.
- **Updated** AddServiceModal rendering: props changed from `pcVram` / `currentGpuUsed` to `pcGpus={modalState.payload.gpus ?? []}` and `pcServices={modalState.payload.servicios ?? []}`.
- **Data flow chain**: PCCard.jsx → `onAddService({ pcId, gpus, servicios })` → App.jsx's `handleAddService` → modal state payload → AddServiceModal receives `pcGpus` + `pcServices`. This enables per-GPU capacity checks and GPU assignment via the new `assignedGpu` field in the form payload.

### T13 — EditServiceModal refactor: GPU dropdown pre-selection, cross-GPU reassignment validation
- **Updated** `handleEditService` handler documentation: now destructures `{ pcId, index, service, gpus, services }` instead of legacy `{ pcId, index, service, vram, currentGpuUsed }`. Forwards the full GPU array and services list through the modal state payload.
- **Updated** EditServiceModal rendering: now passes `pcGpus={modalState.payload.gpus ?? []}` and `pcServices={modalState.payload.services ?? []}` as data props (replacing `pcVram` / `currentGpuUsed`).
- **Data flow chain**: PCCard.jsx → ServiceRow's onEdit callback spreads `{ pcId, index }` and attaches `{ service, gpus: pc?.gpus ?? [], services: pc?.servicios ?? [] }` → App.jsx's `handleEditService({ pcId, index, service, gpus, services })` → modal state payload → EditServiceModal receives `pcGpus` + `pcServices`. This enables the same per-GPU capacity checks and GPU assignment dropdown that AddServiceModal received in T12.
- **Updated** "Loading/Error props passed to EditServiceModal" section: added note about the new data props (`pcGpus`, `pcServices`) enabling per-GPU validation, GPU pre-selection, and cross-GPU reassignment checks.

### Service Health Check hook integration (new)
- **Added** import of `useServiceHealth` from `./hooks/useServiceHealth.js` to App.jsx imports table.
- **Updated** App.jsx description: now mentions the service health check hook for per-service TCP status monitoring and two floating action buttons ("Refresh Health" and "Add PC").
- **Added** row to internal state table: `serviceHealth` from `useServiceHealth()` — exposes `loading` (boolean) and `checkAll()` method. Documented the prop flow: passed as `serviceHealth={serviceHealth}` to `<PCGrid>`, wired to the new FAB button via `onClick={() => serviceHealth.checkAll()}`.
- **Updated** render structure PCGrid entry: now documents `serviceHealth` prop for per-service TCP status display within each card.
- **Added** section 3 "FAB buttons" in render structure documenting both floating action buttons:
  - **"Refresh Health"**: positioned at `bottom-[6.5rem] right-6`, dashboard-only guard, refresh SVG icon with conditional `animate-spin` on loading state, identical FAB styling to the Add PC button.
  - **"Add PC"**: existing FAB at `bottom-6 right-6`.

### AuthContext — React Context for authentication state management
- **Created** `docs/documentation/frontend/src/context.md` — full leaf documentation for the new `frontend/src/context/` folder:
  - `AuthContext.jsx` — React context provider managing user/token/isAuthenticated/isLoading state with auto-session verification on mount. Three public actions (`login`, `register`, `logout`) and a custom `useAuth()` consumer hook. StrictMode guard via `useRef` to prevent double-mount re-fetches.
- **Updated** general description of `src/`: now mentions the `context/` React Context layer for global application state management.
- **Updated** Subfolders table: added entry for `context/` linking to `./src/context.md`.

### T014 — Wrap App with AuthProvider in main.jsx
- **Updated** `main.jsx` documentation: added `AuthProvider` import from `./context/AuthContext.jsx` to the imports table.
- **Updated** render tree description: documented that `<App />` is now wrapped inside `<AuthProvider>...</AuthProvider>` within `<React.StrictMode>`, making `useAuth()` available through React's Context API to every descendant component.

### T8 — Admin Panel feature: three-page routing in App.jsx
- **Added** `AdminPanel` import from `./components/AdminPanel.jsx` to the imports table.
- **Updated** general description: now explicitly lists all three route pages (`'dashboard'`, `'admin'`, `'calculator'`) with their respective rendered components. Noted that `<AdminPanel>` is fully self-contained — no hooks or callbacks lifted into `App.jsx`.
- **Updated** `handlePageChange(page)` handler documentation: now mentions all three page values.
- **Updated** render structure: the ternary page router expanded from 2-way to 3-way — `'dashboard'` → dashboard (PCGrid + modals), `'admin'` → `<AdminPanel />`, else → `<GPUCalculatorPage />`.

### T015 — Route protection and role-gating in App.jsx
- **Updated** general description: now mentions authentication enforcement at the top level (loading guard, unauthenticated redirect) and role-gated CRUD handlers.
- **Added** two new imports to the imports table: `useAuth` from `./context/AuthContext.jsx` and `LoginPage` from `./components/LoginPage.jsx`.
- **Added** rows to the internal state table for `useAuth` destructured values (`user`, `isAuthenticated`, `isLoading`) and derived `isAdmin` flag.
- **Updated** handler documentation: eight CRUD handlers are now marked with ⭐ Role-gated note:
  - `handleEditPc`, `handleOpenAddPc`, `handleDeletePc`, `handleAddService`, `handleEditService`, `handleEditServiceSubmit`, `handleDeleteService`, `handleConfirmDelete` — all use the ternary pattern `isAdmin ? realHandler : () => {}`.
  - `handleAddPc` and `handleSaveService` remain un-gated (modal-on-save callbacks only reachable if an opening handler passed the gate).
- **Added** new handler `handleOpenAddPc()` ⭐ Role-gated — wired to the "Add PC" FAB button.
- **Updated** "Add PC" FAB documentation: now calls `handleOpenAddPc` (replacing previous inline `onClick`).
- **Added** "Auth guards (early returns before main render)" section documenting the two top-level guards: loading spinner while auth resolves, `<LoginPage />` redirect for unauthenticated users. Both execute after all hooks have fired unconditionally (to comply with React's Rules of Hooks) — they block dashboard JSX rendering but no longer prevent hook invocation.

### T017 — Rules of Hooks compliance: reorder all React hooks before early returns
- **Critical fix in `App.jsx`:** Reorganized the component body so that all React hooks (`useAuth`, `usePcs`, six CRUD mutation hooks, `useServiceHealth`, and both `useState` calls) now fire unconditionally at the very top of the function, before any conditional `if (isLoading) return ...` or `if (!isAuthenticated) return ...` early returns. Previously, `usePcs()` and all mutation hooks were invoked only after auth guards passed — meaning a render that returned early from the loading spinner called N hooks while a dashboard render called N+8 hooks, violating React's invariant "Hooks must be called in the same order every time a component renders". This manifested as console errors: "React has detected a change in the order of Hooks called by App".
- **Behavioral impact:** The two auth guards still prevent dashboard JSX from rendering during loading/unauthenticated states. However, `usePcs()` and mutation hooks now execute regardless — their internal logic handles these states gracefully (e.g., `usePcs` always fetches on mount; mutations are guarded by the ternary role pattern). No functional regressions introduced.
- **Updated** file-level description of `App.jsx`: added emphasis on unconditional hook execution, clarified that auth guards block rendering but not hook invocation.
- **Updated** "Auth guards (early returns before main render)" section: rewritten to document that guards now execute *after* all hooks have fired, with a dedicated T017 fix callout explaining the violation and resolution.

### Health check system — per-PC loading tracking and explicit PC-ID targeting in App.jsx
- **Updated** `App.jsx` description: now mentions the health check system uses per-PC loading tracking (`loadingPcs` set) rather than a single boolean, and that the "Refresh Health" FAB and post-login effect both pass `pcs.map(pc => pc._id)` to `checkAll()` for explicit PC targeting.
- **Updated** Internal state table (`useServiceHealth` row): replaced the flat `loading` / `checkAll()` description with the complete return shape: `statuses`, `loadingPcs` (Set), `isPcLoading(pcId)`, `anyPcLoading()`, `checkSinglePc(pcId)`, and `checkAll(pcIds)`. Documented the FAB wiring: `onClick={() => serviceHealth.checkAll(pcs.map(pc => pc._id))}` and spinner condition: `anyPcLoading()`.
- **Updated** Post-auth refetch effect section (renamed from "new `useEffect`" to "updated `useEffect`"):
  - `checkAll()` now called as `serviceHealth.checkAll(pcIds)` with `const ids = pcs.map(pc => pc._id)`.
  - Added `pcs.length > 0` guard to prevent running on an empty fleet.
  - Dependency array expanded from `[isAuthenticated, isLoading, refetch, serviceHealth.checkAll]` to `[isAuthenticated, isLoading, pcs, refetch, serviceHealth]` — the stable `checkAll` callback reference replaced with the full `serviceHealth` object, and `pcs` added so the effect tracks data changes.
  - `checkAll` call wrapped in `if (serviceHealth.checkAll)` for defensive safety.
- **Updated** FAB buttons documentation: "Refresh Health" button now documented as calling `serviceHealth.checkAll(pcs.map(pc => pc._id))` and using `anyPcLoading()` (boolean helper) for the spinner `animate-spin` toggle, replacing the legacy `serviceHealth.loading` boolean.

### Infinite loop fix — split single useEffect into two separate effects in App.jsx
- **Import changes in `App.jsx`:**
  - `useRef` added to `react` import (was: `useState`, `useEffect`; now: `useState`, `useEffect`, `useRef`).
  - `useServices` removed from imports (was imported from `./hooks/useServices.js` but unused).
  - Updated imports table: `react` now lists `useState`, `useEffect`, `useRef`; `useServices` row removed entirely.
- **Bug description:** The single `useEffect` combined PC refetching and health checking, with dependencies `[isAuthenticated, isLoading, pcs, refetch, serviceHealth]`. Calling `checkAll()` from within the effect mutated health-related state, which triggered a re-render, which re-ran the effect (since `pcs` and/or `serviceHealth` were in the dependency array), which called `checkAll()` again — creating an infinite re-render loop.
- **Fix — two separate effects:**
  - **Effect 1 (Post-auth refetch):** Only refetches the PC list when auth state changes. Dependencies: `[isAuthenticated, isLoading, refetch]` — does not depend on `pcs` or `serviceHealth`, so it cannot trigger a loop.
  - **Effect 2 (Initial health check):** Runs `checkAll()` once, guarded by `useRef(false)` (`healthCheckedRef`). Dependencies: `[isAuthenticated, pcs, serviceHealth]`. The `useRef` flag ensures `checkAll()` executes exactly once: subsequent dependency changes cause early return.
- **New internal state:** `healthCheckedRef = useRef(false)` — one-time guard documented in the Internal state table.
- **Updated JSDoc comments:** Code comments rewritten to clearly label both effects (`/* ── 1. Post-auth refetch (auth-change only) ── */`, `/* ── 2. Initial health check (runs once after pcs load) ── */`).
- **Unchanged:** FAB "Refresh Health" button continues to call `serviceHealth.checkAll(pcs.map(pc => pc._id))` on click, unaffected by the split (it's a manual user action, not an automated effect).
