# Components

> Path: `frontend/src/components`
> Last updated: 2026-06-07
> Type: Composite folder

This folder is the primary UI assembly layer of the "Where Is My Model" React frontend. It contains all presentational and interactive components used across two distinct application areas: a **server/service dashboard** (Header, PCGrid, PCCard, ServiceRow, GPUBar, GPUDetails) and an independent **GPU VRAM calculator** workspace (GpuCalculator subfolder). Modal dialogs for CRUD operations live in the Modals subfolder. Direct files provide building-block components consumed by pages or other wrappers; subfolders encapsulate self-contained feature modules.

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

Application header component that sits at the top of the page layout. Displays the application title ("Where Is My Model"), a live server/service counter, tab navigation between Dashboard and GPU Calculator views, and action buttons (Add PC, Export JSON) scoped to the dashboard tab only.

#### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| *(none)* | — | — |

#### Functions

- **`Header(pcs: Array, onAddPc: () => void, onSave: () => void, currentPage: string = 'dashboard', onPageChange: (pageId: string) => void) → JSX.Element`** *(default export)*
  Renders the top-level header bar. Computes aggregate statistics from the `pcs` array and delegates tab-switching to the `onPageChange` callback. The "Export JSON" button serialises the full `pcs` data, creates a Blob URL, triggers a download with a timestamped filename, revokes the URL, and calls the optional `onSave` hook.
  - `pcs`: Full array of server objects; used to compute counts and export payload.
  - `onAddPc`: Invocation callback for opening the "Add PC" modal.
  - `onSave`: Optional callback invoked after a successful JSON export.
  - `currentPage`: Current active tab identifier (`'dashboard'` or `'calculator'`). Defaults to `'dashboard'`.
  - `onPageChange`: Callback to switch between tabs; receives the target tab ID string.

  **Internal helper:**
  - **`handleExport() → void`**
    Serialises `pcs` to JSON, creates a Blob URL, triggers a download via a hidden `<a>` element with filename pattern `gpu-infra-<ISO-timestamp>.json`, cleans up the DOM node and URL object, then calls `onSave()` if defined.

  **Tab configuration (local constant):**
  | id | label |
  |----|-------|
  | `dashboard` | Dashboard |
  | `calculator` | Calculadora GPU |

---

### 📄 PCCard.jsx

Dashboard card representing a single GPU server. Displays the server name, IP badge, running service count, individual service rows (via `ServiceRow`), per-GPU usage bars (via `GPUDetails`), and three action buttons (Edit PC, Add Service, Delete PC). Computes GPU usage state from raw `gpus[]` and `servicios[]` arrays using `computeGpuUsage`.

#### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `./ServiceRow` | `default` (component) | Internal |
| `./GPUDetails` | `default` (component) | Internal |
| `../utils/gpuHelpers.js` | `computeGpuUsage` | Internal |

#### Functions

- **`PCCard(pc: { _id, nombre, ip, gpus?, servicios? }, index: number, onEditPc: (pc) => void, onAddService: ({ pcId, gpus, servicios }) => void, onDeletePc: ({ pcId, nombre }) => void, onEditService: (payload) => void, onDeleteService: ({ pcId, index }) => void) → JSX.Element`** *(default export)*
  Renders a styled card with stagger enter animation (`animationDelay: ${index * 100}ms`). Computes GPU occupancy from the server's raw data, resolves each service to its assigned GPU for display context passed to `ServiceRow`, and wires Edit/Add/Delete callbacks through to parent handlers.
  - `pc`: Server document containing `_id`, `nombre`, `ip`, `gpus[]`, `servicios[]`. All fields are null-safe (`??` guards).
  - `index`: Numeric index for stagger animation delay (100 ms increment per card).
  - `onEditPc`: Callback receiving the full `pc` object when "Edit PC" is clicked.
  - `onAddService`: Callback receiving `{ pcId, gpus, servicios }` when "Add Service" is clicked.
  - `onDeletePc`: Callback receiving `{ pcId, nombre }` when "Delete PC" is clicked.
  - `onEditService`: Callback invoked by each `ServiceRow` with the edit payload enriched with `service`, `gpus`, and `services`.
  - `onDeleteService`: Callback passed through to `ServiceRow` for service deletion.

---

### 📄 PCGrid.jsx

Responsive grid layout that renders a collection of `PCCard` instances for all configured servers. Handles three states: loading spinner, empty-state prompt with call-to-action, and the populated grid (1 / 2 / 3 columns across breakpoints). Passes all action callbacks through to each card.

#### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `./PCCard` | `default` (component) | Internal |

#### Functions

- **`PCGrid(pcs: Array, loading: boolean, onEditPc: (pc) => void, onAddService: ({ pcId, gpus, servicios }) => void, onDeletePc: ({ pcId, nombre }) => void, onEditService: (payload) => void, onDeleteService: ({ pcId, index }) => void) → JSX.Element`** *(default export)*
  Renders a responsive CSS grid section. Conditionally shows either a loading message ("Loading servers..."), an empty-state with guidance text ("Click Add PC to get started"), or the full card list. Iterates `pcs.map()` wiring through all six action callbacks.
  - `pcs`: Full array of server documents.
  - `loading`: Boolean controlling the spinner overlay state.
  - `onEditPc`, `onAddService`, `onDeletePc`, `onEditService`, `onDeleteService`: All action callbacks passed down to each `PCCard` instance verbatim.

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
  ├── Header.jsx ──────────────── tab navigation + server counts
  │                               Export JSON → Blob download
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
