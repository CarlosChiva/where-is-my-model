# Modals

> Path: frontend/src/components/Modals
> Last updated: 2026-06-07
> Type: Leaf folder

This folder contains all modal dialog components used for CRUD operations on GPU servers and their services. Each modal implements a consistent pattern: a full-screen overlay with a centered form, live field-level validation via `touched` state gating, inline error display, and an Escape-key dismissal handler. The modals are organised into two functional groups — *PC/server management* (AddPcModal, EditPcModal) and *service management* (AddServiceModal, EditServiceModal), plus a generic destructive-action confirm dialog (DeleteConfirmModal).

---

## Shared design contract

Every component in this folder exports a **single default function component**. All share these structural conventions:

| Pattern | Details |
|---------|---------|
| **Overlay** | `fixed inset-0 z-50` with semi-transparent background + backdrop blur. Clicking the overlay calls the cancel/close callback. |
| **Form** | `role="dialog" aria-modal="true"`; click propagation is stopped (`e.stopPropagation()`). Responsive sizing: full-height mobile card, centred desktop card (`md:max-w-[420px]`). |
| **Validation** | Live validation on every field change via the corresponding helper from `../../utils/validators.js`. Errors display only after the field has been *touched*. Final validation re-runs on submit with all fields marked touched. |
| **Escape key** | A `useEffect` registers a global `keydown` listener that invokes `onCancel` / `onClose` when Escape is pressed. |
| **Loading indicator** | A disabled state with an inline SVG spinner replaces the button label while the parent's mutation is in-flight. |
| **API error surface** | When the `error` prop is truthy, a danger-styled banner renders above the action buttons. |

---

## 📄 AddServiceModal.jsx

Modal dialog for adding a new service to an existing GPU server. Collects name, port, desired VRAM allocation, and target GPU assignment. Validates that the requested VRAM fits within the selected GPU's *remaining* capacity by passing the full existing-services array (no exclusion, because this is a brand-new allocation).

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `useState`, `useEffect` | External |
| `../../utils/validators.js` | `validateServiceForm` | Internal |
| `../../utils/gpuHelpers.js` | `getRemainingVram` | Internal |

### Components

#### `AddServiceModal` *(default export — function component)*

React functional component rendering a form overlay to add services. Manages internal `formData`, `errors`, and `touched` state. Dispatches sanitised data upward via the `onSave` callback.

**Props:**

- **`pcId: string`** — MongoDB `_id` of the server to attach the service to.
- **`pcGpus: Array<{ name: string, vram: number }>`** — GPU inventory of the target server; used for both the dropdown and remaining-VRAM display.
- **`pcServices: Array<...>`** — Existing services on this server; passed to validators and `getRemainingVram` for capacity checks.
- **`onSave: (data: SavePayload) => void`** — Callback invoked on successful validation with `{ pcId, nombre, puerto, gpu, assignedGpu }`.
- **`onClose: () => void`** — Dismissal callback.
- **`loading: boolean`** *(default `false`)* — Disables submit button and shows spinner when true.
- **`error: string | null`** *(default `null`)* — API error message displayed in a danger banner.
- **`clearError: () => void`** — Invoked automatically via `useEffect` when the modal mounts to clear stale errors.

**Internal methods:**

| Method | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `handleChange(e)` | `e: React.ChangeEvent<HTMLInputElement \| HTMLSelectElement>` | `void` | Updates a single form field by reading `id` and `value`, runs live validation, marks the field as touched. |
| `handleSubmit(e)` | `e: React.FormEvent<HTMLFormElement>` | `void` | Marks all fields touched, re-validates, and if valid calls `onSave` with trimmed/typed payload. |

---

## 📄 EditServiceModal.jsx

Modal dialog for editing an *existing* service on a GPU server. Pre-fills all four form fields from the incoming `service` prop. The key behavioural difference versus *AddServiceModal*: before passing to validation and VRAM helpers, the filtered services array **excludes** the service being edited (`pcServices.filter((_, i) => i !== serviceIndex)`). This ensures that when editing on-the-same-GPU or reassigning to a different GPU, the current allocation is properly freed from the source GPU before capacity checks run.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `useState`, `useEffect` | External |
| `../../utils/validators.js` | `validateServiceForm` | Internal |
| `../../utils/gpuHelpers.js` | `getRemainingVram` | Internal |

### Components

#### `EditServiceModal` *(default export — function component)*

React functional component rendering a form overlay to edit services. Pre-populates state from the `service` prop object and excludes that service's current allocation when validating GPU capacity.

**Props:**

- **`pcId: string`** — MongoDB `_id` of the server hosting this service.
- **`serviceIndex: number`** — Array index of the service within its parent PC's servicios[]; used to filter it out during validation.
- **`service: { nombre: string, puerto: number, gpu: number, assignedGpu: number }`** — The existing service record; used as initial form data (with `?? ''` fallbacks).
- **`pcGpus: Array<{ name: string, vram: number }>`** — GPU inventory.
- **`pcServices: Array<...>`** — Full services array; internally filtered to remove the entry at `serviceIndex`.
- **`onSave: (data: { pcId, index, nombre, puerto, gpu, assignedGpu }) => void`** — Dispatched with both `pcId` and `index` so the parent can route through an *update* mutation.
- **`onCancel: () => void`** — Dismissal callback.
- **`loading: boolean`** *(default `false`)*
- **`error: string | null`** *(default `null`)*
- **`clearError: () => void`**

**Internal methods:**

| Method | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `handleChange(e)` | `e: React.ChangeEvent<HTMLInputElement>` | `void` | Same as AddServiceModal but validates against `pcServicesExSelf` (services minus the entry being edited). |
| `handleSubmit(e)` | `e: React.FormEvent<HTMLFormElement>` | `void` | Final validation, then dispatches `{ pcId, index, nombre, puerto, gpu, assignedGpu }` via `onSave`. |

---

## 📄 EditPcModal.jsx

Modal dialog for editing an existing GPU server. Identical layout and validation flow to *AddPcModal*, but uses a **lazy-initialised state** (`useState(() => { ... })`) that pre-fills the form from the `pc` prop. It handles legacy data by falling back from `pc.gpus[]` → `pc.vram` (scalar) → default empty GPU entry. After submission the payload includes `_id: pc._id` so the parent can route through a PUT request rather than POST.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `useState`, `useEffect` | External |
| `../../utils/validators.js` | `validatePcForm` | Internal |

### Components

#### `EditPcModal` *(default export — function component)*

React functional component rendering a form overlay to edit server details. Pre-populates state from the existing PC document, supporting backward-compat with old single-GPU schemas.

**Props:**

- **`pc: { _id: string, nombre: string, ip: string, gpus?: Array<{name, vram}>, vram?: number, servicios[] }`** — The full server document.
- **`onSave: (data: SavePayload) => void`** — Callback with `{ _id, nombre, ip, gpus }`.
- **`onClose: () => void`**
- **`loading: boolean`** *(default `false`)*
- **`error: string | null`** *(default `null`)*
- **`clearError: () => void`**

**Internal methods:**

| Method | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `handleChange(e)` | `e: React.ChangeEvent<HTMLInputElement>` | `void` | Updates scalar field (`nombre` / `ip`), runs live validation. |
| `handleGpuFieldChange(idx, field, value)` | `idx: number`, `field: string` (`'name'` or `'vram'`), `value: string` | `void` | Mutates a single GPU entry in the array by index, then re-validates. |
| `handleAddGpu()` | — | `void` | Appends `{ name: "GPU N+1", vram: "" }` to the gpus array. |
| `handleRemoveGpu(idx)` | `idx: number` | `void` | Removes the GPU at `idx`; guards against removing the last remaining GPU (min 1 required). |
| `handleSubmit(e)` | `e: React.FormEvent<HTMLFormElement>` | `void` | Final validation, dispatches `{ _id, nombre, ip, gpus }` via `onSave`. |

---

## 📄 AddPcModal.jsx

Modal dialog for adding a brand-new GPU server. Validates name, IP address, and the dynamically editable GPU list. Each GPU row has a name input, a VRAM (number) input, and a remove button. At least one GPU row is always present; the "Add GPU" button allows appending additional rows.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `useState`, `useEffect` | External |
| `../../utils/validators.js` | `validatePcForm` | Internal |

### Components

#### `AddPcModal` *(default export — function component)*

React functional component rendering a form overlay to register new servers. Initial state starts with one GPU entry `{ name: 'GPU 1', vram: '' }`.

**Props:**

- **`onSave: (data: { nombre: string, ip: string, gpus: Array<{name: string, vram: number}> }) => void`** — Dispatched after successful validation.
- **`onClose: () => void`**
- **`loading: boolean`** *(default `false`)*
- **`error: string | null`** *(default `null`)*
- **`clearError: () => void`**

**Internal methods:**

| Method | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `handleChange(e)` | `e: React.ChangeEvent<HTMLInputElement>` | `void` | Scalar field handler (name, ip). |
| `handleGpuFieldChange(idx, field, value)` | `idx: number`, `field: string`, `value: string` | `void` | GPU row field handler. |
| `handleAddGpu()` | — | `void` | Appends a new empty GPU entry. |
| `handleRemoveGpu(idx)` | `idx: number` | `void` | Removes a GPU row (min 1 required). |
| `handleSubmit(e)` | `e: React.FormEvent<HTMLFormElement>` | `void` | Final validation, dispatches `{ nombre, ip, gpus }`. |

---

## 📄 DeleteConfirmModal.jsx

Generic confirmation dialog rendered unconditionally in response to the `isOpen` boolean. Displays a user-supplied message and two action buttons: Cancel (secondary styling) and Delete (danger-red styling). After calling `onConfirm`, it fires once — the parent is responsible for hiding the modal by setting `isOpen = false`. Supports loading spinner on both buttons while a destructive mutation is in-flight.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `useEffect` | External |

### Components

#### `DeleteConfirmModal` *(default export — function component)*

Minimal React functional component for destructive-action confirmation. Conditionally returns `null` when `isOpen` is false; otherwise renders the overlay/dialog structure. No internal form state.

**Props:**

- **`isOpen: boolean`** — Controls visibility of the entire dialog.
- **`message: string`** — Body text shown to the user before confirming deletion.
- **`onConfirm: () => void`** — Invoked when the user clicks "Delete".
- **`onCancel: () => void`** — Invoked on Cancel, backdrop click, or Escape key.
- **`loading: boolean`** *(default `false`)* — Disables both buttons and swaps labels while a mutation runs.
- **`error: string | null`** *(default `null`)* — API error banner (same contract as other modals).

**Internal methods:**

| Method | Parameters | Return | Description |
|--------|-----------|--------|-------------|
| `handleConfirm()` | — | `void` | Thin wrapper around `onConfirm()`. |

---

## Cross-file relationships and dependencies

```
┌─────────────────────── external deps ───────────────┐
│                react (useState, useEffect)            │
├─────────────── internal deps ────────────────────────┤
│ validators.js          gpuHelpers.js                 │
│  validatePcForm        getRemainingVram               │
│  validateServiceForm                                    │
└──────────────────── dependents (this folder) ────────┘

AddPcModal  ──validatePcForm──▶  validates {nombre, ip, gpus[]}
EditPcModal ──validatePcForm──▶  same as AddPcModal; lazy-init from `pc` prop

AddServiceModal   ──validateServiceForm + getRemainingVram──▶  checks PC capacity
EditServiceModal  ──validateServiceForm + getRemainingVram──▶  same, but filters out self

DeleteConfirmModal ──(no validation import)────────────▶  pure confirmation UI
```

- **AddPcModal ↔ EditPcModal** share nearly identical GPU-list management logic and the same validator (`validatePcForm`). The only distinction is that EditPcModal pre-fills state from an existing PC document.
- **AddServiceModal ↔ EditServiceModal** are similarly paired; EditServiceModal adds a services-exclusion filter to avoid double-counting VRAM during validation. Both depend on `getRemainingVram` for the live GPU-dropdown display and the hint text beneath the VRAM input.
- **DeleteConfirmModal** is completely independent — it has no form state, no validator dependency, and simply acts as a safety gate before any mutation that removes resources.

---

## Shared data flow (parent → modal → parent)

1. Parent component calls an "open" function that sets visibility state to `true`.
2. Modal renders; its `useEffect` clears any stale API errors (`clearError()`).
3. User types into fields; `handleChange` fires, updating `formData` and running **live validation**. Errors appear only after the field has been touched.
4. User clicks the primary button; `handleSubmit` marks all fields touched and performs a **final validation pass**. If invalid, the submit is aborted and all errors surface.
5. On success, the modal dispatches sanitised data (trimmed strings, typed numbers) via its `onSave` / `onConfirm` callback.
6. The parent receives the payload, issues the corresponding API mutation (POST for create, PUT for update, DELETE via confirm), and toggles visibility state to dismiss the modal.
