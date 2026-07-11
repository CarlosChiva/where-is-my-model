# `components`

> Path: `frontend/src/components/`
> Last updated: 2026-06-07
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

Presentational header component with tab-based page navigation. Renders the application title, live server/service summary statistics, and a horizontal tab switcher (Dashboard / Model Calculator). Minimal layout: centered column with no action buttons or export functionality — those responsibilities have been delegated to parent-level components.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| *(none)* | — | — |

This component has no imports; it uses only native browser APIs internally.

### Functions

#### `Header({ pcs, currentPage, onPageChange }) → JSX.Element` _(default export)_

Renders the application header with title, summary stats, and tab navigation.

- **`pcs: Array<PC>`** — Full array of server objects; used to compute `serverCount` (array length) and `serviceCount` (sum of all `pc.servicios.length`).
- **`currentPage: string`** _(default: `'dashboard'`)_ — Active page identifier. Accepted values: `'dashboard'` or `'calculator'`. Determines which tab is visually highlighted.
- **`onPageChange: (pageId: string) => void`** _(optional)_ — Callback invoked when the user clicks a tab. Receives the `id` of the selected tab (`'dashboard'` or `'calculator'`). Guard-checked (`onPageChange && onPageChange(tab.id)`) so it is safe to omit.

**Tab configuration**:

A local constant array defines the two navigation tabs:
```js
const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'calculator', label: 'Model Calculator' },
];
```
Each tab is rendered via `.map()` producing a `<button>` with `role="tab"` and `aria-selected` bound to the active state. Active tab uses accent-filled styling (`bg-accent text-bg-primary`); inactive tabs use input-bg styling with hover highlight (`bg-bg-input text-text-secondary hover:text-text-primary`). The nav container has `aria-label="Page navigation"`.

**Layout**: Header root `<header>` uses centered flex column (`flex flex-col items-center gap-4`). Inner content is a centered column (`flex flex-col gap-2 text-center items-center`) containing the title, live summary stats, and tab navigation. No conditional rendering — no action buttons are rendered by this component.

### Accessibility features

- `aria-live="polite"` on summary span for screen reader announcements.
- Tab `<nav>` has `aria-label="Page navigation"`. Each tab button has `role="tab"` with `aria-selected` dynamically bound to the active page. All buttons use `type="button"`. Focus ring uses `focus:ring-[0_0_0_2px] focus:ring-accent-dim`.

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

**Animated fill mechanism:** The inner `<div>` uses a CSS custom property (`--gpu-target-width: ${percent}%`) together with an explicit inline style `width: '0%'`. The `'0%'` value prevents React from collapsing the bar to zero width during re-renders (when component state triggers a full re-render rather than an incremental update). The CSS transition on the element gradually animates `width` from its CSS-initial `0%` to the target defined by `--gpu-target-width`, producing a smooth fill effect. Without the explicit `width: '0%'`, React could re-apply the previously computed inline width and skip the animation or cause a visual flicker.

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

#### `ServiceRow({ service, vramGb, index, pcId, onEdit, onDelete, gpuName, status }) → JSX.Element` _(default export)_

Renders a horizontal row for one service with three-zone layout: name+port+gpu-badge (left), GPU bar (center, fixed width), action buttons (right). The left zone includes a colored health-status dot before the service name, and a conditional GPU assignment badge that displays the human-readable GPU name assigned to this service.

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

#### `PCCard({ pc, index, onEditPc, onAddService, onDeletePc, onEditService, onDeleteService, healthStatuses, healthLoading, onCheckPc }) → JSX.Element` _(default export)_

The primary dashboard widget showing server details, services list, GPU summary, and CRUD action buttons. Derives `gpus`, `services`, and `gpuUsage` locally before passing to children. Extended with three health-check props enabling per-service health status indicators and on-demand health probes (health check integration).

- **`pc: Object`** — Shape: `{ _id, nombre, ip, gpus[], servicios[] }`. GPU usage is computed via `computeGpuUsage(gpus, servicios)` (T15 JSDoc update).
- **`index: number`** — Array position for stagger animation delay (`index * 100ms`).
- **`onEditPc: (pc) => void`** — Edit PC callback.
- **`onAddService: ({ pcId, gpus, servicios }) => void`** — Add service callback. Passes the full GPU array (`pc?.gpus ?? []`) and existing services array (`pc?.servicios ?? []`) so the modal can perform per-GPU capacity validation and render a GPU selector dropdown. Replaces the legacy flat `{ pcId, vram, currentGpuUsed }` shape (T12).
- **`onDeletePc: ({ pcId, nombre }) => void`** — Delete PC callback.
- **`onEditService: (context) => void`** — Passthrough to ServiceRow edit. Enriched with `service`, `gpus`, and `services` (T13).
- **`onDeleteService: (context) => void`** — Passthrough to ServiceRow delete.
- **`healthStatuses: Object`** _(default: `{}`)_ — Key-value map keyed by `"pcId---serviceIndex"` strings, with values of `'up'`, `'down'`, or `null`. Populated by the parent health-check hook. Each card uses this to look up the status of individual services within its `.map()` loop.
- **`healthLoading: boolean`** _(default: `false`)_ — Boolean flag indicating whether a health check is currently in flight. When truthy, disables the "Check Services" icon button and suppresses duplicate probe triggers.
- **`onCheckPc: () => Promise<void>`** _(optional)_ — Zero-arg callback that triggers an on-demand health probe for this specific PC. Guard-calling via optional chaining (`onCheckPc?.()`) so the component renders safely when the prop is absent. Bound per-card by the parent `PCGrid` to `serviceHealth?.checkSinglePc(pc._id)`.

**Derived values:**
- `services`: `pc?.servicios ?? []`
- `gpus`: `pc?.gpus ?? []` (local variable, replaces the typo-prone inline access pattern)
- `gpuUsage`: result of `computeGpuUsage(gpus, services)` — array of `{ gpuIndex, name, totalVram, usedVram }`, one entry per GPU

**GPU data flow (T15):** Computation is centralized in PCCard rather than delegated to GPUDetails. PCCard calls `computeGpuUsage(gpus, services)` once, then passes the pre-computed `gpuUsage` array to `<GPUDetails gpuUsage={gpuUsage} />`. For the ServiceRow mapping, each service's `vramGb` is resolved by looking up the GPU assigned to that service (`service.assignedGpu ?? 0`) within the local `gpuUsage` array via `.find(g => g.gpuIndex === assignedIdx)`, retrieving `serviceGpuData?.totalVram ?? 0`. This eliminates the legacy reference to `pc?.vram` and correctly handles multi-GPU servers where each GPU has its own VRAM capacity.

**GPU name propagation (T16):** Inside the `services.map()` callback, PCCard resolves the human-readable GPU name via `serviceGpuData?.name ?? null` (same lookup that provides `resolvedVramGb`) and passes it to `<ServiceRow>` as `gpuName={resolvedGpuName}`. This enables ServiceRow to render a visual badge (`gpu: {gpuName}`) so users can identify which GPU each service is assigned to — particularly useful for multi-GPU servers where assignments must be distinguishable at a glance. If the lookup yields `null` (legacy data or missing `assignedGpu`), ServiceRow gracefully omits the badge.

**Health status key computation:** Inside the `services.map()` callback, after resolving GPU data, PCCard computes a composite health-key per service: `` const healthKey = `${pc?._id}---${i}` `` — a string concatenation of the PC's MongoDB `_id`, three literal dashes (`---`), and the 0-based service loop index `i`. It then looks up `` const serviceStatus = healthStatuses[healthKey] ?? null `` to retrieve the current health state (`'up'`, `'down'`, or `null`) for that specific service. This keyed lookup allows PCCard to forward individual service statuses down to each `<ServiceRow>` instance without requiring ServiceRow to know its parent PC ID or global keys.

**Health status forwarding:** The resolved `serviceStatus` is passed to each `<ServiceRow>` via the `status={serviceStatus}` prop. This enables each row to render visual health indicators (color dots, tooltips, or disabled styling) based on that service's current probe result. If the key has no match in `healthStatuses`, the null-coalescing fallback (`?? null`) ensures a safe default of `null` — indicating "unknown" rather than conflating absence with an explicit `'down'` status.

**"Check Services" icon button:** A fourth action button is appended after "Delete PC". It features:
- **Icon:** 16×16 refresh SVG (Lucide-style rotate-CW icon with two arc paths and arrow heads). Uses `stroke="currentColor"` so it inherits the button's text color.
- **Styling:** Outlined variant — `border border-text-secondary text-text-secondary` with hover state `hover:bg-bg-input`. Compact square form factor (`p-2 px-3 py-2`) to differentiate from the full-width text CRUD buttons.
- **Loading state:** When `healthLoading` is truthy, the button is disabled (`disabled={healthLoading}`) and the SVG rotates continuously via the `animate-spin` class (toggled: `` className={healthLoading ? 'animate-spin' : ''} ``).
- **Accessibility:** Dynamic `aria-label` incorporating server name (`Check services on {pc.nombre}`). Includes a native `title="Check Services"` tooltip attribute for hover users.

**Accessibility:** Action buttons have dynamic `aria-label` with server name. Card has `data-pc-id` attribute. Server name uses `<h2>` heading.

---

## 📄 `PCGrid.jsx`

Responsive grid layout container with three conditional rendering states: loading, empty, populated.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `./PCCard` | `PCCard` | Internal |

### Functions

#### `PCGrid({ pcs, loading, onEditPc, onAddService, onDeletePc, onEditService, onDeleteService, serviceHealth }) → JSX.Element` _(default export)_

Root container for PC cards. Renders a responsive CSS Grid (1 col mobile, 2 col md+, 3 col lg+) with three mutually exclusive states. Now forwards health-check context from the parent hook down to each `PCCard`.

- **`pcs: Array<PCObject>`** — Full server array.
- **`loading: boolean`** — Data fetch in-flight flag.
- **`onEditPc`, `onAddService`, `onDeletePc`, `onEditService`, `onDeleteService`** — All callbacks passed through to each `PCCard` instance.
- **`serviceHealth: Object|null`** _(optional)_ — Health-context object from the parent hook containing health status data and check functions. All derived props use optional chaining (`?.`) so PCGrid renders correctly even when this prop is absent (e.g., before the health hook initializes).

**Three forwarded health props per PCCard:**
| Forwarded prop | Source | Purpose |
|---|---|---|
| `healthStatuses` | `serviceHealth?.statuses` | Current health status map keyed by PC ID. Passed so each card can display per-service health indicators. |
| `healthLoading` | `serviceHealth?.loading` | Global boolean indicating whether a bulk health check is in flight. Cards can show a loading skeleton or disabled state during checks. |
| `onCheckPc` | `() => serviceHealth?.checkSinglePc(pc._id)` | Zero-arg callback bound to the specific PC's `_id`. Allows each card to trigger an on-demand health probe for that single server without re-checking all servers. |

**States:**
1. `loading` → centered "Loading servers..." with `animate-pulse`.
2. `!loading && pcs.length === 0` → "No servers configured yet" with guidance text.
3. `!loading && pcs.length > 0` → maps `pcs[]` to `<PCCard>` instances, keyed by `pc._id`.

**Spacing (T29):** The root `<section>` carries `mt-8 md:mt-10` — 32px top margin on mobile, 40px on desktop (`md:` breakpoint). This creates visual breathing room between the Header's tab/action-row and the PC card grid on the Dashboard page.

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

### GPUBar — Fixed bar width collapse on React re-renders
- **Updated** `GPUBar.jsx`: added explicit inline style `width: '0%'` to the inner `<div>` (the animated progress fill element). The bar already uses CSS custom property `--gpu-target-width` for the target width value together with a CSS transition. However, during full React re-renders (e.g., when parent state changes and triggers complete subtree reconciliation), React can skip applying the CSS transition if the inline `width` style is absent — causing the bar to snap to its final width instantly or collapse to 0px before animating. The explicit `width: '0%'` ensures a reliable initial value so the CSS `transition` property always animates from zero to `--gpu-target-width`.
- **Why this matters:** This fix eliminates visual flicker/glitch on dashboard update cycles when hook data refetches cause the entire PCGrid tree to re-render. The animation is now deterministic across all React rendering paths (incremental updates and full re-renders alike).

### T29 — PCGrid top-margin spacing between Header and card grid
- **Updated** `PCGrid.jsx`: the root `<section>` element now carries `mt-8 md:mt-10` Tailwind classes — 32px (`2rem`) top margin on mobile, 40px (`2.5rem`) on desktop (`md:` breakpoint and above).
- **Purpose:** Creates visual breathing room between the Header's tab switcher / action-button row and the PC card grid on the Dashboard page. Without this spacing, the navigation controls visually run into the first row of cards.
- **No behavioral changes:** All props, state logic, callback passthroughs, conditional rendering states (loading / empty / populated), and accessibility attributes remain unchanged. This is a purely cosmetic addition to the Tailwind class list on line 5 (`<section className="mt-8 md:mt-10 grid ...">`).

### Tab label rename — "Calculadora GPU" → "Model Calculator"
- **Updated** `Header.jsx`: the second tab label changed from `'Calculadora GPU'` to `'Model Calculator'`. The internal `id` remains `'calculator'`, so all routing logic, `currentPage` comparisons (`currentPage === 'calculator'`), and parent component state handling are unaffected.
- **Removed** props `onAddPc` and `onSave`, the "Add PC" button, the "Export JSON" button, and the `handleExport()` internal method from `Header.jsx`. These responsibilities have been delegated to parent-level components (likely `App.jsx`). The component is now purely navigational: title + live stats + tab switcher.
- **Reverted** layout back to a centered column (`items-center` on root `<header>`, `text-center items-center` on inner container). The previous T08 asymmetric left-zone / desktop-inline layout has been removed.

### Health data passthrough — PCGrid forwards service-health context to PCCard
- **Updated** `PCGrid.jsx`: added `serviceHealth` to the function-parameter destructuring (line 3). This object is provided by the parent component's health-check hook and gives each card access to per-server health status information.
- **Three new forwarded props per `<PCCard>` in the `.map()` loop:**
  - `healthStatuses={serviceHealth?.statuses}` — current health-status map keyed by PC ID. Consumed by each card to render per-service health indicators (green/yellow/red dots, tooltips, or status text).
  - `healthLoading={serviceHealth?.loading}` — boolean flag indicating whether a bulk health probe is in flight. Cards use this to gate UI states (e.g., dim the check icon, show a spinner overlay on the card).
  - `onCheckPc={() => serviceHealth?.checkSinglePc(pc._id)}` — zero-arg callback **bound per-PC** inside the map closure. Each card invokes it independently to trigger an on-demand health probe for only that server without re-checking all servers in the grid.
- **All three props use optional chaining (`?.`)** so PCGrid renders safely when `serviceHealth` is `undefined` (e.g., before a hook initializes or if the parent omits the prop). No breaking change for consumers.

### Health check integration — PCCard accepts and consumes health-check props, adds "Check Services" button
- **Updated** `PCCard.jsx` JSDoc: added documentation for three new props — `healthStatuses`, `healthLoading`, and `onCheckPc` — with their default values and purpose.
- **Updated** `PCCard.jsx` function signature: extended destructuring to include `healthStatuses = {}`, `healthLoading = false`, and `onCheckPc`. The empty object default for `healthStatuses` prevents errors during property lookups when the parent hasn't initialized health data yet. `onCheckPc` is unguarded in destructuring but guard-called in the click handler via `onCheckPc?.()` — making it a safe optional prop.
- **Added** "Check Services" icon button to the action-buttons bar (positioned after "Delete PC"). Button features: 16×16 refresh SVG icon, outlined styling with `border-text-secondary` and `text-text-secondary`, compact `p-2` padding. When `healthLoading` is truthy, the button is disabled (`disabled={healthLoading}`) and the icon spins via Tailwind's `animate-spin` class (dynamically toggled in the SVG element's className). Includes both `aria-label` (`Check services on {pc.nombre}`) and native `title="Check Services"` for accessibility.
- **Added** health status computation inside `services.map()`: `` `healthKey = ${pc?._id}---${i}` `` — a composite string key concatenating the PC's MongoDB `_id`, three dashes separator, and the 0-based service loop index. The code then looks up `healthStatuses[healthKey] ?? null` to retrieve the current per-service health state (`'up'`, `'down'`, or `null`).
- **Added** `status={serviceStatus}` prop forwarding to each `<ServiceRow>` instance. This enables ServiceRow to render visual health indicators (dots, color coding, or status text) based on that specific service's probe result. The null-coalescing default (`?? null`) ensures an explicit "unknown" distinction from a confirmed `'down'` status.
