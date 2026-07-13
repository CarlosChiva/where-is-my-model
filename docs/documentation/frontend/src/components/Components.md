# Components

> Path: `frontend/src/components`
> Last updated: 2026-07-13 (T9 revision — per-card health loading)
> Type: Composite folder

This folder is the primary UI assembly layer of the "Where Is My Model" React frontend. It contains all presentational and interactive components used across three distinct application areas: a **server/service dashboard** (Header, PCGrid, PCCard, ServiceRow, GPUBar, GPUDetails), an independent **GPU VRAM calculator** workspace (GpuCalculator subfolder), and a standalone **authentication page** (LoginPage). Modal dialogs for CRUD operations live in the Modals subfolder. Direct files provide building-block components consumed by pages or other wrappers; subfolders encapsulate self-contained feature modules.

---

## 📁 Subfolders

| Folder | Documentation | Description |
|--------|--------------|-------------|
| `GpuCalculator/` | [see docs](./components/GpuCalculator.md) | Interactive GPU VRAM calculator with form sections, computation engine integration, colour-coded results display, and prefix-cache visualisation. |
| `Modals/` | [see docs](./components/Modals.md) | Modal dialogs for CRUD operations on GPU servers (add/edit/delete PCs) and their services (add/edit), plus a generic destructive-action confirmation dialog. |

---

## 📄 Direct files

### 📄 GPUBar.jsx

Minimal, stateless presentational component that renders a horizontal, animated progress bar representing GPU memory occupancy. Uses the same colour-coding (`getGpuColorClass`) and warning-threshold (> 80%) logic as `GPUDetails` and the calculator's `ResultsDisplay`, ensuring visual consistency across the entire application.

#### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `../utils/gpuHelpers` | `clamp`, `getGpuColorClass` | Internal |

#### Functions

- **`GPUBar(gpuGb: number, vramGb: number) → JSX.Element`** *(default export)*
  Renders a color-coded progress bar with ARIA support (`role="progressbar"`). Computes the occupancy percentage from props, clamps it to [0, 100], applies the appropriate CSS colour class, and toggles an animation class when above the 80% warning threshold.
  - `gpuGb`: GB of VRAM consumed by this GPU or service.
  - `vramGb`: Total available VRAM on this GPU in gigabytes.

---

### 📄 GPUDetails.jsx

Per-GPU detail panel rendered inside a `PCCard`. Accepts a pre-computed `gpuUsage` array (produced by `computeGpuUsage` from PCCard) and renders one labeled progress bar per GPU, showing name, GB used vs. total, and the percentage fill. Returns `null` when there are no GPUs to display.

#### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `../utils/gpuHelpers` | `clamp`, `getGpuColorClass` | Internal |

#### Functions

- **`GPUDetails(gpuUsage: Array<{ gpuIndex, name, totalVram, usedVram }>) → JSX.Element \| null`** *(default export)*
  Iterates over the `gpuUsage` array and renders a row per GPU containing: (a) the GPU label, (b) a text readout of usage (`usedVram / totalVram GB` + percentage), (c) an animated progress bar using `getGpuColorClass` for colour-coding, and (d) warning animation when > 80% full.
  - `gpuUsage`: Array of computed GPU usage objects from `computeGpuUsage()`. Defaults to `[]`; if empty, returns `null`.

---

### 📄 Header.jsx

Application header component that sits at the top of the page layout. Displays the application title ("Where Is My Model"), a live server/service counter with `aria-live="polite"`, and tab navigation between Dashboard and GPU Calculator views. Uses no external imports beyond React (implicit). Stateless — delegates all navigation actions to parent via callback.

#### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| *(none)* | — | — |

#### Functions

- **`Header(pcs: Array, currentPage: string = 'dashboard', onPageChange: (pageId: string) => void, isAdmin: boolean = false) → JSX.Element`** *(default export)*
  Renders the top-level header bar. Computes aggregate statistics (`serverCount`, `serviceCount`) from the `pcs` array and delegates tab-switching to the `onPageChange` callback. Conditionally renders an "Admin" tab when `isAdmin` is `true`. Contains no action buttons or modals — pure presentation.
  - `pcs`: Full array of server objects; used to compute `{serverCount, serviceCount}` statistics. The service count safely handles missing or non-array `servicios` via `Array.isArray()` guard.
  - `currentPage`: Current active tab identifier (`'dashboard'`, `'calculator'`, or `'admin'`). Defaults to `'dashboard'`. Controls which tab appears selected (via `aria-selected`).
  - `onPageChange`: Callback to switch between tabs; receives the target tab ID string. Guarded with truthy check before invocation (`onPageChange && onPageChange(tab.id)`).
  - `isAdmin`: Boolean flag that conditionally appends an Admin tab to the navigation. Defaults to `false`. When `true`, a third tab `{ id: 'admin', label: 'Admin' }` is spread into the tabs array, enabling admin users to navigate to `<AdminPanel />`.

  **Tab configuration (local constant):**
  | id | label | Tailwind active styling | Tailwind inactive styling | Notes |
  |----|-------|------------------------|--------------------------|-------|
  | `dashboard` | Dashboard | `bg-accent text-bg-primary` | `bg-bg-input text-text-secondary hover:text-text-primary` | Always rendered |
  | `calculator` | Model Calculator | `bg-accent text-bg-primary` | `bg-bg-input text-text-secondary hover:text-text-primary` | Always rendered |
  | `admin` | Admin | `bg-accent text-bg-primary` | `bg-bg-input text-text-secondary hover:text-text-primary` | Only rendered when `isAdmin === true` (via spread syntax) |

  **Conditional Admin tab (T9):** The tabs array uses conditional spread — `...(isAdmin ? [{ id: 'admin', label: 'Admin' }] : [])` — to inject a third navigation option exclusively for users whose role is `'admin'`. This keeps the admin route invisible at the header level for non-admin users.

  **Accessibility features:**
  - Live region: server/service counter wrapped in `<span aria-live="polite">` for screen-reader announcements on data changes.
  - Tab semantics: each navigation button carries `role="tab"` and `aria-selected={currentPage === tab.id}`.
  - Focus ring: tabs receive `focus:ring-[0_0_0_2px] focus:ring-accent-dim` on keyboard focus.
  - Nav landmark: `<nav aria-label="Page navigation">` provides semantic grouping for assistive technology.

---

### 📄 PCCard.jsx

Dashboard card representing a single GPU server. Displays the server name, IP badge, running service count, individual service rows (via `ServiceRow`), per-GPU usage bars (via `GPUDetails`), and action buttons (Edit PC, Add Service, Delete PC, Check Services). Computes GPU usage state from raw `gpus[]` and `servicios[]` arrays using `computeGpuUsage`. **Health check is per-card**: uses `isThisPcLoading` (a per-card boolean) to spin the refresh icon and disable the check button independently of other cards.

#### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `./ServiceRow` | `default` (component) | Internal |
| `./GPUDetails` | `default` (component) | Internal |
| `../utils/gpuHelpers.js` | `computeGpuUsage` | Internal |

#### Functions

- **`PCCard(pc: { _id, nombre, ip, gpus?, servicios? }, index: number, isAdmin: boolean, onEditPc: (pc) => void, onAddService: ({ pcId, gpus, servicios }) => void, onDeletePc: ({ pcId, nombre }) => void, onEditService: (payload) => void, onDeleteService: ({ pcId, index }) => void, healthStatuses: Record<string, string>|Object = {}, isThisPcLoading: boolean = false, onCheckPc?: () => Promise<void>) → JSX.Element`** *(default export)*
  Renders a styled card with stagger enter animation (`animationDelay: ${index * 100}ms`). Computes GPU occupancy from the server's raw data, resolves each service to its assigned GPU for display context passed to `ServiceRow`, and wires Edit/Add/Delete callbacks through to parent handlers. Includes a "Check Services" button with a refresh-icon SVG that spins (via `animate-spin` on a `<span>` wrapper) and the button becomes disabled when `isThisPcLoading` is `true` — **this loading state is per-card, not global**.
  - `pc`: Server document containing `_id`, `nombre`, `ip`, `gpus[]`, `servicios[]`. All fields are null-safe (`??` guards).
  - `index`: Numeric index for stagger animation delay (100 ms increment per card).
  - `isAdmin`: Boolean flag that gates visibility of Edit PC, Add Service, and Delete PC buttons.
  - `onEditPc`: Callback receiving the full `pc` object when "Edit PC" is clicked.
  - `onAddService`: Callback receiving `{ pcId, gpus, servicios }` when "Add Service" is clicked.
  - `onDeletePc`: Callback receiving `{ pcId, nombre }` when "Delete PC" is clicked.
  - `onEditService`: Callback invoked by each `ServiceRow` with the edit payload enriched with `service`, `gpus`, and `services`.
  - `onDeleteService`: Callback passed through to `ServiceRow` for service deletion.
  - `healthStatuses`: Object keyed by `"${pcId}---${serviceIndex}"` with values `'up' | 'down' | null`. Passed through to each `ServiceRow` for per-service status display. Defaults to `{}`.
  - `isThisPcLoading`: Boolean indicating whether this specific PC is currently undergoing a health check. When true, the "Check Services" button is disabled (`disabled={isThisPcLoading}`) and the refresh icon SVG receives the `animate-spin` Tailwind class. Defaults to `false`. **Replaces the previous global `healthLoading` prop** — each card now tracks its own loading state independently.
  - `onCheckPc`: Optional callback invoked when the "Check Services" button is clicked. Called via optional chaining (`onCheckPc?.()`) so absence of the callback does not cause errors. When provided, it should trigger a single-server health probe (typically `serviceHealth.checkSinglePc(pc._id)` from the parent).

---

### 📄 PCGrid.jsx

Responsive grid layout that renders a collection of `PCCard` instances for all configured servers. Handles three states: loading spinner, empty-state prompt with call-to-action, and the populated grid (1 / 2 / 3 columns across breakpoints). Passes all action callbacks and per-card health-check props through to each card. **Health loading is per-card**: instead of a global loading flag, PCGrid resolves `isThisPcLoading` per PC via `serviceHealth?.isPcLoading(pc._id)`.

#### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `./PCCard` | `default` (component) | Internal |

#### Functions

- **`PCGrid(pcs: Array, loading: boolean, isAdmin: boolean, onEditPc: (pc) => void, onAddService: ({ pcId, gpus, servicios }) => void, onDeletePc: ({ pcId, nombre }) => void, onEditService: (payload) => void, onDeleteService: ({ pcId, index }) => void, serviceHealth: Object) → JSX.Element`** *(default export)*
  Renders a responsive CSS grid section with three mutually exclusive states gated by `loading` and `pcs.length`:
  (1) loading spinner with pulsing "Loading servers..." text spanning all columns;
  (2) empty-state card reading "No servers configured yet." / "Use the + button to add your first server.";
  (3) the full card list via `pcs.map()`. Wires through all six action callbacks plus three health-related props to each `PCCard` instance, keyed by `pc._id`.
  - `pcs`: Full array of server documents.
  - `loading`: Boolean controlling the spinner overlay state. When truthy, blocks rendering of empty or populated content via short-circuit logic.
  - `isAdmin`: Boolean flag passed through to each `<PCCard>` for admin-gated buttons.
  - `onEditPc`, `onAddService`, `onDeletePc`, `onEditService`, `onDeleteService`: All action callbacks passed down to each `PCCard` instance verbatim.
  - `serviceHealth`: Optional health-context object providing per-PC service-health data. Uses optional chaining (`?.`) on all derived props for safe fallback when the object is absent. Forwards three properties:
    - `healthStatuses={serviceHealth?.statuses}` — current health status map for all PCs.
    - `isThisPcLoading={serviceHealth?.isPcLoading(pc._id)}` — **per-card loading boolean** (replaces previous global `healthLoading={serviceHealth?.loading}`). Calls `isPcLoading()` with the specific PC's `_id` so each card independently knows whether its own health check is in flight.
    - `onCheckPc={() => serviceHealth?.checkSinglePc(pc._id)}` — zero-arg callback bound to the specific PC's `_id`, triggering a single-server health probe.

---

### 📄 LoginPage.jsx

Full-page authentication component providing tab-based login and registration. Manages local form state (username, password, field errors, API errors, pending-approval flag) while delegating credential operations to the global `AuthContext` via `useAuth()`. Handles three post-submit outcomes: **(a)** successful auto-login redirects to dashboard; **(b)** pending-registration displays an approval-info banner; **(c)** any API error renders a danger alert. Styled with dark-theme Tailwind classes consistent with the app's design system.

#### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `useState` | External |
| `../context/AuthContext` | `useAuth` | Internal |

#### Functions and internal logic

- **`LoginPage() → JSX.Element`** *(default export)*
  Renders a full-page centered card with login/register tabs. No external props — all state is internal or via AuthContext.

  - `mode: 'login' | 'register'` (default `'login'`) — determines which auth action to invoke and which labels/buttons to display. Tab clicks reset all errors **and** clear the pending flag (`setRegistrationPending(false)`).
  - `username`, `password` — controlled inputs for the credential fields.
  - `fieldErrors: Object` — client-side validation errors keyed by field. Checked on submit (`validate()`).
  - `apiError: String | null` — server error from `login()`/`register()`. Shown as a danger-styled alert banner above the submit button.
  - `registrationPending: boolean` (default `false`) — set to `true` when `register()` returns `{ pending: true }` (pending-admin-approval scenario). Renders an accent-colored info banner with instructional text. Cleared on tab switch.

  **`validate() → boolean`** — Synchronous check that both fields are non-empty. Sets field-level error messages; returns `true` if valid.

  **`handleSubmit(e) → Promise<void>`** — Prevents default, clears API error and pending flag, validates, then calls the appropriate action (`login` or `register`) from useAuth(). Three mutually exclusive branches on response:
    - **(1) `result.error` is truthy:** sets `apiError` → danger banner renders.
    - **(2) `result.pending` is truthy:** sets `registrationPending = true` → accent-colored approval-info banner renders (no redirect occurs).
    - **(3) Otherwise:** success — AuthContext flips state, triggering the authentication guard in `<App>` to swap `<LoginPage />` out for the dashboard.

  **Tab switching resets all transient state:** The tab handler executes `setMode(tab); setApiError(null); setFieldErrors({}); setRegistrationPending(false);`, ensuring that no leftover error or pending message bleeds across mode changes.

---

### 📄 ServiceRow.jsx

Presentational row component for a single running service within a PCCard's services list. Displays the service name, port badge, GPU assignment badge (when available), an inline occupancy bar via `GPUBar`, and pencil/X action buttons for edit and delete operations.

#### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `./GPUBar` | `default` (component) | Internal |

#### Functions

- **`ServiceRow(service: { nombre, puerto, gpu }, vramGb: number, index: number, pcId: string, onEdit: ({ pcId, index }) => void, onDelete: ({ pcId, index }) => void, gpuName: string | null) → JSX.Element`** *(default export)*
  Renders a flex row for one service. Deconstructs the `service` prop to access name, port, and assigned GPU number. Passes `gpu` (the assigned VRAM in GB) and `vramGb` (total GPU capacity) to `GPUBar`. Both action buttons fire their respective callbacks with `{ pcId, index }` payload.
  - `service`: Service record object with keys `nombre`, `puerto`, `gpu` (assigned VRAM).
  - `vramGb`: Total VRAM of the assigned GPU (resolved by the parent PCCard via `computeGpuUsage`).
  - `index`: Array index of this service within its server's `servicios[]`.
  - `pcId`: MongoDB `_id` of the parent server.
  - `onEdit`: Callback invoked with `{ pcId, index }` when the edit (pencil) button is clicked.
  - `onDelete`: Callback invoked with `{ pcId, index }` when the delete (X) button is clicked.
  - `gpuName`: Human-readable GPU name or `null` (displayed as an optional badge).

---

## Architecture overview and data flow

```
App / Page (parent)
  │
   ├── Header.jsx ──────────────── tab navigation + server/service counts
  │
  └── [dashboard page]
        │
        └── PCGrid.jsx ─────────── responsive grid container
              │
              └── PCCard.jsx ───── per-server card (× pcs.length)
                    ├── ServiceRow.jsx ──── per-service row (× servicios.length)
                    │     └── GPUBar.jsx ──── inline progress bar
                    │
                    └── GPUDetails.jsx ──── per-GPU usage breakdown
                          └── GPUBar is NOT used here; uses same
                              clamp/getGpuColorClass helpers directly
              │
        [modals wired by parent App]
        ├── Modals/AddPcModal.jsx
        ├── Modals/EditPcModal.jsx
        ├── Modals/AddServiceModal.jsx
        ├── Modals/EditServiceModal.jsx
        └── Modals/DeleteConfirmModal.jsx

  └── [calculator page]
        └── GpuCalculator/GPUCalculatorPage.jsx ── independent VRAM calculator feature
              ├── ModelFormSection
              ├── PrecisionFormSection
              ├── HardwareFormSection
              ├── WorkloadFormSection
              └── ResultsDisplay
                    └── uses same gpuHelpers (clamp, getGpuColorClass)
```

### Key relationships between direct files

| Consumer | Consumes | Purpose |
|----------|----------|---------|
| `PCGrid` → `PCCard` | Full `pc` object + 6 action callbacks | Render a card for each server in the data array. |
| `PCCard` → `ServiceRow` | `service`, resolved `vramGb`, `gpuName`, `pcId`, index, edit/delete handlers | Render each service row inside the card's services list. |
| `PCCard` → `GPUDetails` | Pre-computed `gpuUsage` array | Render per-GPU occupancy bars below the service list. |
| `ServiceRow` → `GPUBar` | `gpuGb` (assigned VRAM), `vramGb` (total GPU capacity) | Show a compact progress bar inline with each service entry. |

### Shared utility coupling

All visual components that display GPU memory usage share two helpers from `../utils/gpuHelpers`:
- **`clamp(value, min, max)`** — Ensures percentages stay within [0, 100].
- **`getGpuColorClass(percent)`** — Maps a percentage to a CSS class (green < 60%, yellow 60–80%, red > 80%).

In addition, `PCCard` calls **`computeGpuUsage(gpus, servicios)`** from the same module to reconcile service assignments against GPU inventory. The calculator module (`GpuCalculator/ResultsDisplay.jsx`) independently uses the same two helpers for its own visualisations, ensuring cross-module consistency in colour coding and clamping logic.

### How modals integrate

The parent App wraps the dashboard layout shown above. When an action callback fires (e.g., `onEditPc` from a `PCCard`), the parent opens the corresponding modal from the `Modals/` subfolder, passing it the necessary data and callbacks. The modal is not imported by any direct file here; ownership lives in the App-level component.

---

## 🔄 Changes in this update

### LoginPage.jsx — Pending-registration banner and state management (T8, 2026-07-12)
- **Updated** `LoginPage.jsx` documentation to describe the new `registrationPending` boolean state and its rendering logic.
- **Updated** `handleSubmit()` description with a three-way branching model: (1) error → `apiError`; (2) `result.pending` → accent-colored info banner; (3) success → redirect.
- **Added** documentation that tab switching now resets `registrationPending` alongside all other transient state (`setApiError`, `setFieldErrors`).
- **Corrected** imports: removed stale `useEffect` import reference — only `useState` is imported from React in the current source.

### LoginPage.jsx — New authentication page component (2026-07-11)
- **Added** `LoginPage.jsx` as a new direct-file document. Full-page login/register component with tab-switching UI, controlled form inputs, client-side validation, API error display, loading spinner, and auto-redirect on successful authentication. Delegates all credential operations to `AuthContext` via `useAuth()` hook (`login`, `register`, `isLoading`, `isAuthenticated`).
- **Updated** folder description paragraph to reference the third application area: standalone authentication page.

### 2026-06-07 revision — Header.jsx correction

### 2026-06-07 revision — Header.jsx correction
- **Removed** stale `onSave` prop and "Export JSON" button documentation from `Header.jsx`. The current source code no longer contains an Export JSON feature, Blob download logic, or the associated `handleExport()` helper.
-    **Removed** stale `onAddPc` prop entirely from documentation. The actual component now has only three props: `{ pcs, currentPage = 'dashboard', onPageChange }`. No action buttons ("Add PC") exist in this component.
- **Added** accessibility documentation for Header.jsx: `aria-live="polite"` on server/service counter, `role="tab"` + `aria-selected` on navigation buttons, focus ring classes, and `<nav aria-label="Page navigation">` landmark.
- **Added** Tailwind active/inactive styling to the tab configuration table.
- **Corrected** architecture diagram: replaced "Export JSON → Blob download" annotation with accurate description ("Add PC button (dashboard-only)").
-    **Updated** `PCGrid.jsx` documentation to precisely describe the current empty-state copy ("No servers configured yet." / "Use the + button to add your first server.") and three-way conditional rendering logic.

### Health passthrough — PCGrid.jsx forwards service-health context (legacy, superseded by T9)
- **Original (T8)**: `PCGrid.jsx` added `serviceHealth` to destructured parameters. Three props were forwarded per `<PCCard>`:
  - `healthStatuses={serviceHealth?.statuses}` — map of health statuses keyed by PC ID.
  - `healthLoading={serviceHealth?.loading}` — **global** loading flag for in-flight bulk health checks. *(Superseded by `isThisPcLoading` in T9.)*
  - `onCheckPc={() => serviceHealth?.checkSinglePc(pc._id)}` — per-PC bound callback for on-demand single-server health probes.
- All three use optional chaining (`?.`) so the component renders safely when the hook has not yet initialized or the prop is omitted. No breaking change.

### Per-card health loading — T9 (2026-07-13)
- **PCCard.jsx**: Replaced global `healthLoading` prop with `isThisPcLoading` (per-card boolean). Default is `false`. When true, the "Check Services" button is disabled (`disabled={isThisPcLoading}`) and the refresh-icon SVG is wrapped in a `<span className={isThisPcLoading ? 'animate-spin' : ''}>` for per-card spinning animation. Added optional `onCheckPc` callback (invoke guarded with `onCheckPc?.()`).
- **PCGrid.jsx**: Changed `healthLoading={serviceHealth?.loading}` → `isThisPcLoading={serviceHealth?.isPcLoading(pc._id)}`. Previously every card shared the same loading state (all spinners animated simultaneously during a bulk check). Now each card independently tracks its own loading state via the `isPcLoading(pcId)` method from the service health context. This allows concurrent per-card health checks without cross-card spinner interference.
- **Architecture impact**: The parent health-check hook exposes an `isPcLoading(id)` method (in addition to the existing `loading` global flag). Each `PCGrid` → `PCCard` chain now queries this method with the specific `pc._id`, enabling granular per-server loading semantics.
