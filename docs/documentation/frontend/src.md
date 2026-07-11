# `src`

> Path: `frontend/src/`
> Last updated: 2026-06-04
> Type: Composite folder

React source files for the GPU Infrastructure Dashboard frontend application, scaffolded with Vite. Contains the application entry point, root component, Tailwind CSS base imports, a REST API client layer (`services/`), a general-purpose utility module (`utils/`) providing slugification, GPU colour helpers, and form validators. Business logic components are added in subsequent tasks.

---

## 📁 Subfolders

| Folder | Documentation | Description |
|--------|--------------|-------------|
| `components/` | [see docs](./src/components.md) | React UI components for the GPU dashboard: presentational components (Header, GPUBar, GPUDetails, ServiceRow, PCCard, PCGrid) and a `Modals/` subfolder containing five modal-dialog components for data-entry, editing, and deletion flows. |
| `hooks/` | [see docs](./src/hooks.md) | Custom React hooks for data fetching (loading the master list of GPU servers and per-server services) and CRUD mutation operations (create, update, delete for PCs and services). |
| `services/` | [see docs](./src/services.md) | REST API client layer: generic HTTP request wrapper with JSON serialization and error envelope, plus thin domain-specific modules for PC and Service CRUD operations. |
| `utils/` | [see docs](./src/utils.md) | General-purpose utility module: `slugify.js` (URL-safe slug generation), `gpuHelpers.js` (GPU colour mapping, value clamping, per-GPU VRAM computation, and remaining-VRAM queries — four named exports), and two named-export validators for PC and Service forms. |

---

## 📄 Direct files

## 📄 `App.jsx`

Root React component of the GPU Infrastructure Dashboard. Orchestrates the full application: initializes all data-fetching and mutation hooks, a service health check hook (`useServiceHealth`) for per-service TCP status monitoring, manages modal routing via a single state object, renders two floating action buttons ("Refresh Health" and "Add PC") on the dashboard view, and renders the header, responsive PC card grid, and five modal dialogs. Each mutation hook is wired to `refetch` the master PC list on success.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `useState` | External |
| `./hooks/usePcs.js` | `usePcs` | Internal |
| `./hooks/useCreatePc.js` | `useCreatePc` | Internal |
| `./hooks/useUpdatePc.js` | `useUpdatePc` | Internal |
| `./hooks/useDeletePc.js` | `useDeletePc` | Internal |
| `./hooks/useServices.js` | `useServices` | Internal |
| `./hooks/useCreateService.js` | `useCreateService` | Internal |
| `./hooks/useUpdateService.js` | `useUpdateService` | Internal |
| `./hooks/useDeleteService.js` | `useDeleteService` | Internal |
| `./hooks/useServiceHealth.js` | `useServiceHealth` | Internal |
| `./components/Header.jsx` | `Header` | Internal |
| `./components/PCGrid.jsx` | `PCGrid` | Internal |
| `./components/GpuCalculator/GPUCalculatorPage.jsx` | `GPUCalculatorPage` | Internal |
| `./components/Modals/AddPcModal.jsx` | `AddPcModal` | Internal |
| `./components/Modals/EditPcModal.jsx` | `EditPcModal` | Internal |
| `./components/Modals/AddServiceModal.jsx` | `AddServiceModal` | Internal |
| `./components/Modals/EditServiceModal.jsx` | `EditServiceModal` | Internal |
| `./components/Modals/DeleteConfirmModal.jsx` | `DeleteConfirmModal` | Internal |

### Internal state

| Hook | Variable | Initial value | Role |
|------|----------|---------------|------|
| `useState` | `modalState` | `{ type: null, payload: null }` | Modal router — `type` determines which modal renders, `payload` carries data forwarded to it. |
| `useState` | `currentPage` | `'dashboard'` | Page router — switches between `'dashboard'` (default) and `'calculator'` views. Changing pages also closes any open modal via `handlePageChange`. Both FAB buttons are scoped to the dashboard only (`{ currentPage === 'dashboard' && ... }`). |
| `useServiceHealth` | `serviceHealth` | — | Health check hook instance exposing `loading` (boolean), `checkAll()` (triggers TCP probes for all services across all PCs). Passed as `serviceHealth` prop to `<PCGrid>` and wired to the "Refresh Health" FAB button via `onClick={() => serviceHealth.checkAll()}`. |

### Callback handlers

- **`closeModal() → void`**
  Resets `modalState` to `{ type: null, payload: null }`, closing any open modal.

- **`handlePageChange(page: string) → void`**
  Switches the active page (between `'dashboard'` and `'calculator'`) and closes any open modal. Modals are scoped to the dashboard; navigating away from it dismisses them automatically.

- **`deleteMessage` (derived)**
  Builds a confirmation message from `modalState.payload`. If `actionType === 'pc'`, includes the server name (`nombre`). Otherwise, uses a generic service-deletion message. Evaluated as an inline ternary during render.

- **`handleAddPc(pcData: Object) → Promise<void>`**
  Persists a new GPU server via `createPcHook.mutate(pcData)`. On success (no error in result), closes the modal. The `refetch` callback fires automatically.

- **`handleEditPc(pc: Object) → Promise<void>`**
  Persists an edited GPU server via `updatePcHook.mutate({ id, data })`. On success (no error in result), closes the modal. On error, the modal remains open and the `EditPcModal` displays the API error banner.

- **`handleDeletePc({ pcId, nombre }) → void`**
  Opens `DeleteConfirmModal` with `actionType: 'pc'` and the server name for the confirmation message.

- **`handleAddService({ pcId, gpus, servicios }) → void`**
  Opens `AddServiceModal` with PC context: the server ID, full GPU array (`gpus`), and existing services array (`servicios`). This replaces the legacy `{ pcId, vram, currentGpuUsed }` shape (T12) so the modal can perform per-GPU capacity validation and render a GPU selector dropdown.

- **`handleSaveService(serviceData) → Promise<void>`**
  Persists a new service via `createServiceHook.mutate({ pcId, data })` and closes the modal.

- **`handleEditService({ pcId, index, service, gpus, services }) → void`**
  Opens `EditServiceModal` with the service data and full PC GPU/services context (T13). Replaces the legacy `{ pcId, index, service, vram, currentGpuUsed }` signature. Forwards `gpus` and `services` through the modal state payload so EditServiceModal can perform per-GPU capacity validation and render a GPU selector dropdown.

- **`handleEditServiceSubmit(serviceData) → Promise<void>`**
  Persists an edited service via `updateServiceHook.mutate({ pcId, index, data })` and closes the modal.

- **`handleDeleteService({ pcId, index }) → void`**
  Opens `DeleteConfirmModal` with `actionType: 'service'`.

- **`handleConfirmDelete() → Promise<void>`**
  Confirmation handler for delete modals. Dispatches based on `modalState.payload.actionType`: `'pc'` calls `deletePcHook.mutate(pcId)`, `'service'` calls `deleteServiceHook.mutate({ pcId, index })`. Awaits the mutation result and only closes the modal on success (`if (!result?.error) { closeModal(); }`). On error, the modal stays open and the `DeleteConfirmModal` displays the API error banner.

### Render structure

The component renders:
1. **`Header`** — server count summary, "Add PC" button, and "Export JSON" button (which internally serializes `pcs` to a timestamped JSON file download via native browser APIs).
2. **`PCGrid`** — responsive grid of PC cards with editing, add-service, and delete actions. Receives `serviceHealth={serviceHealth}` for per-service TCP status display within each card.
3. **FAB buttons** (dashboard-only):
   * **"Refresh Health"** — positioned at `bottom-[6.5rem] right-6` (above the "Add PC" FAB). Calls `serviceHealth.checkAll()` on click. Icon (refresh/circular arrows SVG) gets a conditional `animate-spin` class when `serviceHealth.loading` is truthy, providing visual feedback during health probes. Same styling as the existing "Add PC" FAB: `w-12 h-12 md:w-14 md:h-14`, rounded, accent-coloured, with shadow and hover/active transitions.
   * **"Add PC"** — positioned at `bottom-6 right-6`. Opens the AddPcModal via `setModalState({ type: 'addPc' })`.
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
| `./App.jsx` | `App` | Internal |
| `./index.css` | *(CSS side-effect import)* | Internal |

### Functions

*(No standalone functions — file executes mount logic at the module level.)*

**Module-level behavior:**

- **`ReactDOM.createRoot(node).render(children)`**
  Initializes a React 19 root with strict mode and renders the `App` component into the DOM node identified by `getElementById('app')`.
  - Mounts `<React.StrictMode><App /></React.StrictMode>` as the application tree.

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
