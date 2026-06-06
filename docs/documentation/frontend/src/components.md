# `components`

> Path: `frontend/src/components/`
> Last updated: 2026-06-04
> Type: Composite folder

React UI components for the GPU Infrastructure Dashboard. Contains six presentational components (Header, GPUBar, GPUDetails, ServiceRow, PCCard, PCGrid) that follow a strict unidirectional data-flow pattern: they receive data and callbacks as props, perform no data fetching, and delegate all mutations back to the root `App.jsx`. Includes a `Modals/` subfolder with five modal-dialog components for data-entry, editing, and deletion confirmations.

---

## 📁 Subfolders

| Folder | Documentation | Description |
|--------|--------------|-------------|
| `Modals/` | [see docs](./components/modals.md) | Five modal-dialog components: AddPcModal, EditPcModal, AddServiceModal, EditServiceModal, and DeleteConfirmModal — all with loading/error/clearError integration. |
| `GpuCalculator/` | [see docs](./components/GpuCalculator.md) | Controlled, stateless form-section components for the GPU Calculator feature: HardwareFormSection (VRAM + utilization inputs), ModelFormSection (transformer parameters), PrecisionFormSection (quantization selects). |

---

## 📄 Direct files

## 📄 `Header.jsx`

Presentational header component with tab-based page navigation. Renders the application title, live server/service summary statistics, a horizontal tab switcher (Dashboard / Calculadora GPU), and two action buttons ("Add PC" and "Export JSON") that appear only on the Dashboard page. Layout adapts responsively: stacked column on mobile, inline row on desktop (`md:` breakpoint).

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| *(none)* | — | — |

This component has no imports; it uses only native browser APIs internally.

### Functions

#### `Header({ pcs, onAddPc, onSave, currentPage, onPageChange }) → JSX.Element` _(default export)_

Renders the application header with title, summary stats, tab navigation, and conditional action buttons.

- **`pcs: Array<PC>`** — Full array of server objects; used to compute `serverCount` (array length) and `serviceCount` (sum of all `pc.servicios.length`), and as the payload for JSON export.
- **`onAddPc: () => void`** — Callback fired when "Add PC" button is clicked.
- **`onSave: () => void`** — Callback fired after JSON export completes (backward compatibility).
- **`currentPage: string`** _(default: `'dashboard'`)_ — Active page identifier. Accepted values: `'dashboard'` or `'calculator'`. Determines which tab is visually highlighted and whether action buttons are rendered.
- **`onPageChange: (pageId: string) => void`** _(optional)_ — Callback invoked when the user clicks a tab. Receives the `id` of the selected tab (`'dashboard'` or `'calculator'`). Guard-checked (`onPageChange && onPageChange(tab.id)`) so it is safe to omit.

**Tab configuration (T08)**:

A local constant array defines the two navigation tabs:
```js
const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'calculator', label: 'Calculadora GPU' },
];
```
Each tab is rendered via `.map()` producing a `<button>` with `role="tab"` and `aria-selected` bound to the active state. Active tab uses accent-filled styling (`bg-accent text-bg-primary`); inactive tabs use input-bg styling with hover highlight (`bg-bg-input text-text-secondary hover:text-text-primary`). The nav container has `aria-label="Page navigation"`.

**Layout changes (T08)**:

- Header root `<header>` changed from `items-center` to `items-start` for proper mobile stacking when the tab row is present.
- Left-zone `<div>` uses `w-full md:w-auto` — full-width on mobile (title stacks above stats and tabs), auto-width on desktop (all elements flow in a single row).
- Action buttons ("Add PC", "Export JSON") are wrapped in a conditional render: `{currentPage === 'dashboard' && (...)}`. They appear only when the Dashboard tab is active, hiding them on the Calculadora GPU page.

**Internal methods:**

- **`handleExport() → void`**
  Serializes the `pcs` array to a formatted JSON string, wraps it in a `Blob` with MIME type `application/json`, creates an object URL, generates a timestamped filename (`gpu-infra-{ISO-timestamp}.json`), programmatically triggers the browser download via a temporary anchor element, then cleans up the DOM and revokes the object URL. After export, invokes `onSave()` if it is a function.
  - Serialization: `JSON.stringify(pcs, null, 2)`
  - Blob: `new Blob([json], { type: 'application/json' })`
  - URL: `URL.createObjectURL(blob)`
  - Filename: `gpu-infra-{timestamp}.json` where timestamp is ISO 8601 with `:` and `.` replaced by `-`
  - Cleanup: removes anchor from DOM, calls `URL.revokeObjectURL(url)`

### Accessibility features

- `aria-live="polite"` on summary span for screen reader announcements.
- Both SVG icons (plus, download) have `aria-hidden="true"`.
- All buttons use `type="button"`.
- Tab `<nav>` has `aria-label="Page navigation"`. Each tab button has `role="tab"` with `aria-selected` dynamically bound to the active page. Focus ring uses `focus:ring-[0_0_0_2px] focus:ring-accent-dim`.

---

## 📄 `GPUBar.jsx`

Reusable animated GPU usage progress bar. Used per-service within `ServiceRow`.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `../utils/gpuHelpers` | `clamp`, `getGpuColorClass` | Internal |

### Functions

#### `GPUBar({ gpuGb, vramGb }) → JSX.Element` _(default export)_

Renders an animated horizontal progress bar showing GPU VRAM utilization percentage with color-tier styling and optional warning pulse.

- **`gpuGb: number`** — Current VRAM consumed by this service (in GB).
- **`vramGb: number`** — Parent PC's total VRAM capacity (in GB).

**Derived values:**
- `percent`: `(gpuGb / vramGb) * 100`, clamped to [0, 100] via `clamp()` utility; defaults to 0 if `vramGb === 0`.
- `colorClass`: from `getGpuColorClass(percent)` — green ≤35, yellow 36–70, red >70.
- `isWarning`: `percent > 80` — triggers pulsing warning glow animation.

**Accessibility:** Uses `role="progressbar"` with `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`.

---

## 📄 `GPUDetails.jsx`

Pure presentational component for per-GPU progress bars within a PC card. Renders one row per GPU showing GPU name label, color-coded occupancy bar, and text readout of GB used vs total. Accepts pre-computed `gpuUsage` from `PCCard` — no longer performs any computation itself (T15 refactor centralizes `computeGpuUsage` in the parent).

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `../utils/gpuHelpers` | `clamp`, `getGpuColorClass` | Internal |

### Functions

#### `GPUDetails({ gpuUsage = [] }) → JSX.Element` _(default export)_

Iterates over the pre-computed `gpuUsage` array. Returns `null` if there are no GPUs to display. For each GPU entry, renders a label row (GPU name + numeric readout) and an animated occupancy progress bar with color-tier styling and warning-pulse animation. Entirely presentational — no data transformation or computation.

- **`gpuUsage: Array<Object>`** _(default: [])_ — Pre-computed array from `computeGpuUsage()`. Each element: `{ gpuIndex: number, name: string, totalVram: number, usedVram: number }`. Supplied by `PCCard.jsx` which calls `computeGpuUsage(gpus, services)` and passes the result.

**Derived values per GPU (pure presentation):**
- `rawPercent`: `(usedVram / totalVram) * 100`, or 0 if `totalVram === 0`. Used for text display (allows >100% if overcommitted).
- `percent`: `clamp(rawPercent, 0, 100)` — used for CSS bar width and color-tier determination.
- `colorClass`: from `getGpuColorClass(percent)` — green ≤35%, yellow 36–70%, red >70%.
- `isWarning`: `percent > 80` — triggers `animate-gpu-warning` pulsing glow on the bar container.

**Rendering:** Each GPU row is wrapped in `<div key={gpuIndex}>`. The progress bar uses CSS custom property `--gpu-target-width` for animated fill (`width: '0%'` → target via CSS transition). Accessibility: `role="progressbar"` with `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"`.

**Readout format:** `{usedVram.toFixed(1)} / {totalVram} GB ({Math.round(rawPercent)}%)` — e.g., "16.5 / 80 GB (21%)".

---

## 📄 `ServiceRow.jsx`

Single-column row displaying one AI service: name, port badge, GPU assignment badge (T16), GPU usage bar, edit/delete icon buttons.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `./GPUBar` | `GPUBar` | Internal |

### Functions

#### `ServiceRow({ service, vramGb, index, pcId, onEdit, onDelete, gpuName }) → JSX.Element` _(default export)_

Renders a horizontal row for one service with three-zone layout: name+port+gpu-badge (left), GPU bar (center, fixed width), action buttons (right). The left zone now includes a conditional GPU assignment badge that displays the human-readable GPU name assigned to this service.

- **`service: Object`** — Shape: `{ nombre: string, puerto: number|string, gpu: number }`.
- **`vramGb: number`** — Parent PC's total VRAM; forwarded to GPUBar.
- **`index: number`** — Service array index; passed to callbacks.
- **`pcId: string`** — MongoDB ObjectId of parent server.
- **`onEdit: (context: { pcId, index }) => void`** — Callback for edit button.
- **`onDelete: (context: { pcId, index }) => void`** — Callback for delete button.
- **`gpuName: string|null`** _(T16)_ — Human-readable GPU name resolved by the parent `PCCard`. When truthy, renders a badge showing `gpu: {gpuName}` between the port badge and the GPU bar. When falsy (null/undefined), the badge is omitted entirely, providing backward compatibility with legacy data that lacks per-service GPU assignment metadata.

**Badge rendering behavior (T16):**
- **Condition:** `{gpuName && (...)}` — renders only when `gpuName` is truthy (non-empty string).
- **Content:** Literal text `gpu: ` followed by the resolved GPU name (e.g., `gpu: Nvidia RTX 3090`).
- **Styling:** `shrink-0 text-xs text-text-muted bg-accent/10 text-accent px-2 py-0.5 rounded font-medium` — small, accent-colored text on a subtle semi-transparent background; does not shrink in the flex layout.
- **Position:** Between the port badge (`{puerto}`) and the GPU bar container.
- **Legacy data handling:** If `gpuName` is `null` or `undefined`, no badge element is rendered — existing UI (name, port, bar, buttons) remains unchanged. This allows incremental rollout on servers whose services still lack `assignedGpu` metadata.

**Accessibility:** Icon buttons have dynamic `aria-label` incorporating service name.

---

## 📄 `PCCard.jsx`

Card component representing one GPU server. Composes ServiceRow and GPUDetails. Includes hover interactions, stagger animation, and three action buttons. Centralizes per-GPU usage computation via `computeGpuUsage()` and passes pre-computed data to child components (T15 refactor).

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `./ServiceRow` | `ServiceRow` | Internal |
| `./GPUDetails` | `GPUDetails` | Internal |
| `../utils/gpuHelpers.js` | `computeGpuUsage` | Internal |

### Functions

#### `PCCard({ pc, index, onEditPc, onAddService, onDeletePc, onEditService, onDeleteService }) → JSX.Element` _(default export)_

The primary dashboard widget showing server details, services list, GPU summary, and CRUD action buttons. Derives `gpus`, `services`, and `gpuUsage` locally before passing to children.

- **`pc: Object`** — Shape: `{ _id, nombre, ip, gpus[], servicios[] }`. GPU usage is computed via `computeGpuUsage(gpus, servicios)` (T15 JSDoc update).
- **`index: number`** — Array position for stagger animation delay (`index * 100ms`).
- **`onEditPc: (pc) => void`** — Edit PC callback.
- **`onAddService: ({ pcId, gpus, servicios }) => void`** — Add service callback. Passes the full GPU array (`pc?.gpus ?? []`) and existing services array (`pc?.servicios ?? []`) so the modal can perform per-GPU capacity validation and render a GPU selector dropdown. Replaces the legacy flat `{ pcId, vram, currentGpuUsed }` shape (T12).
- **`onDeletePc: ({ pcId, nombre }) => void`** — Delete PC callback.
- **`onEditService: (context) => void`** — Passthrough to ServiceRow edit. Enriched with `service`, `gpus`, and `services` (T13).
- **`onDeleteService: (context) => void`** — Passthrough to ServiceRow delete.

**Derived values:**
- `services`: `pc?.servicios ?? []`
- `gpus`: `pc?.gpus ?? []` (local variable, replaces the typo-prone inline access pattern)
- `gpuUsage`: result of `computeGpuUsage(gpus, services)` — array of `{ gpuIndex, name, totalVram, usedVram }`, one entry per GPU

**GPU data flow (T15):** Computation is centralized in PCCard rather than delegated to GPUDetails. PCCard calls `computeGpuUsage(gpus, services)` once, then passes the pre-computed `gpuUsage` array to `<GPUDetails gpuUsage={gpuUsage} />`. For the ServiceRow mapping, each service's `vramGb` is resolved by looking up the GPU assigned to that service (`service.assignedGpu ?? 0`) within the local `gpuUsage` array via `.find(g => g.gpuIndex === assignedIdx)`, retrieving `serviceGpuData?.totalVram ?? 0`. This eliminates the legacy reference to `pc?.vram` and correctly handles multi-GPU servers where each GPU has its own VRAM capacity.

**GPU name propagation (T16):** Inside the `services.map()` callback, PCCard resolves the human-readable GPU name via `serviceGpuData?.name ?? null` (same lookup that provides `resolvedVramGb`) and passes it to `<ServiceRow>` as `gpuName={resolvedGpuName}`. This enables ServiceRow to render a visual badge (`gpu: {gpuName}`) so users can identify which GPU each service is assigned to — particularly useful for multi-GPU servers where assignments must be distinguishable at a glance. If the lookup yields `null` (legacy data or missing `assignedGpu`), ServiceRow gracefully omits the badge.

**Accessibility:** Action buttons have dynamic `aria-label` with server name. Card has `data-pc-id` attribute. Server name uses `<h2>` heading.

---

## 📄 `PCGrid.jsx`

Responsive grid layout container with three conditional rendering states: loading, empty, populated.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `./PCCard` | `PCCard` | Internal |

### Functions

#### `PCGrid({ pcs, loading, onEditPc, onAddService, onDeletePc, onEditService, onDeleteService }) → JSX.Element` _(default export)_

Root container for PC cards. Renders a responsive CSS Grid (1 col mobile, 2 col md+, 3 col lg+) with three mutually exclusive states.

- **`pcs: Array<PCObject>`** — Full server array.
- **`loading: boolean`** — Data fetch in-flight flag.
- **`onEditPc`, `onAddService`, `onDeletePc`, `onEditService`, `onDeleteService`** — All callbacks passed through to each `PCCard` instance.

**States:**
1. `loading` → centered "Loading servers..." with `animate-pulse`.
2. `!loading && pcs.length === 0` → "No servers configured yet" with guidance text.
3. `!loading && pcs.length > 0` → maps `pcs[]` to `<PCCard>` instances, keyed by `pc._id`.

**Accessibility:** Uses `<section>` for semantic grouping.

---

## 🔄 Changes in this update

### Initial creation (T13)
- **Created** `docs/documentation/frontend/src/components.md` — composite folder documentation for `frontend/src/components/`.
- **Documented** six direct component files: Header.jsx (with new Export JSON functionality from T13), GPUBar.jsx, GPUDetails.jsx, ServiceRow.jsx, PCCard.jsx, PCGrid.jsx.
- **Added** subfolder entry for `Modals/` linking to existing `./components/modals.md`.

### T12 — PCCard onAddService callback signature change
- **Updated** `PCCard.jsx` `onAddService` prop documentation: callback now passes `{ pcId, gpus, servicios }` instead of the legacy `{ pcId, vram, currentGpuUsed }` shape. JSDoc comment updated to reflect the new signature. This allows AddServiceModal to perform per-GPU capacity validation and render a GPU selector dropdown.

### T13 — PCCard onEditService payload enriched with gpus and services
- **Updated** `PCCard.jsx` edit callback for ServiceRow (line ~45): the `onEdit` handler now spreads `(editPayload)` and attaches `service`, `gpus: pc?.gpus ?? []`, and `services: pc?.servicios ?? []`. This means `onEditService` receives `{ pcId, index, service, gpus, services }` instead of the legacy flat `{ pcId, index, service }` shape.
- **Data flow chain**: PCCard → ServiceRow's onEdit → App.jsx's `handleEditService({ pcId, index, service, gpus, services })` → modal state payload → EditServiceModal receives `pcGpus={payload.gpus ?? []}` and `pcServices={payload.services ?? []}`. This enables the same per-GPU GPU selector dropdown and cross-reassignment validation that AddServiceModal received in T12.

### T16 — ServiceRow GPU assignment badge; PCCard passes resolved GPU name
- **Updated** `ServiceRow.jsx`: new prop `gpuName: string|null`. When truthy, renders a small accent-colored badge with text `gpu: {gpuName}` positioned between the port badge and the GPU usage bar. Badge is conditionally rendered (`{gpuName && (...)}`), so it gracefully disappears for legacy data lacking per-service GPU assignment metadata. Styled with `shrink-0 text-xs bg-accent/10 text-accent px-2 py-0.5 rounded font-medium`.
- **Updated** `PCCard.jsx`: inside the services `.map()` callback, after resolving `serviceGpuData` via `gpuUsage.find(g => g.gpuIndex === assignedIdx)`, now extracts `const resolvedGpuName = serviceGpuData?.name ?? null` and passes it to `<ServiceRow gpuName={resolvedGpuName} />`. This reuses the same lookup that already provides `resolvedVramGb`, so no additional computation is needed.
- **Stakeholder value:** Users scanning a multi-GPU server card can now see which GPU each service occupies without hovering over bars or comparing numeric indices. Particularly useful when multiple services share the same port range but different GPUs, or when troubleshooting VRAM contention across discrete devices.

### T023 — New GpuCalculator/ subfolder; HardwareFormSection.jsx documented
- **Added** `GpuCalculator/` to the Subfolders table in this composite document, linking to `[see docs](./components/GpuCalculator.md)`.
- **Created** new leaf documentation file: `docs/documentation/frontend/src/components/GpuCalculator.md` — full documentation for the new `HardwareFormSection.jsx` component (controlled form section with VRAM total and GPU memory utilization inputs).
- The `GpuCalculator/` folder also contains `ModelFormSection.jsx` and `PrecisionFormSection.jsx`, previously documented in the Phase 4 flat document (`frontend-components-phase4.md`). Going forward, all three components are centralized under the GpuCalculator leaf doc.

### T08 — Header.jsx tab switcher; currentPage/onPageChange props; conditional action buttons
- **Updated** `Header.jsx`: added two new props — `currentPage` (string: `'dashboard' | 'calculator'`, default `'dashboard'`) and `onPageChange` (optional callback, guard-checked). These drive a `<nav>` tab switcher with two tabs: "Dashboard" and "Calculadora GPU". Tabs use WAI-ARIA tab pattern (`role="tab"`, dynamic `aria-selected`).
- **Updated** `Header.jsx`: layout changed from centered flex to start-aligned. Left zone now stacks vertically on mobile (`flex-col w-full`) and flows inline on desktop (`md:flex-row` on parent, `md:w-auto` on left zone). Tab `<nav>` sits between summary stats and action buttons.
- **Updated** `Header.jsx`: "Add PC" and "Export JSON" buttons are conditionally rendered inside `{currentPage === 'dashboard' && (...)}` block. They remain untouched when Dashboard is active; they disappear entirely on the calculator page, removing redundant UI from a screen where those actions have no meaning.
