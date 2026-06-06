# modals

> Path: frontend/src/components/modals/
> Last updated: 2026-06-05 (T13)
> Type: Leaf folder

Phase 5 modal-dialog components for the GPU dashboard, implementing form-based overlays for data-entry, editing flows, and destructive-action confirmations. Contains five modals: AddPcModal (T021), EditPcModal (T021), AddServiceModal (T023), EditServiceModal (T024, T10, T13), and DeleteConfirmModal (T025). All five modals now accept `loading`, `error`, and `clearError` (except DeleteConfirmModal which only needs `loading` and `error`) from their parent's mutation hooks to display API error banners, disable buttons during in-flight requests, and clear stale errors on mount. **AddServiceModal (T12) and EditServiceModal (T13)** share an identical architecture: both use a GPU selector dropdown with per-GPU free VRAM display, pre-selection of `assignedGpu`, and the shared 3-argument `validateServiceForm` signature for cross-GPU reassignment validation.

---

## 📄 AddPcModal.jsx

Controlled-form modal dialog for adding a new GPU server. Renders as a fixed-position overlay with two static form inputs (Name, IP Address) plus a **dynamic GPU list section** that renders one or more GPU rows via `.map()`. Each GPU row contains a name text input, a vram number input (GB), and a remove-X button. An "Add GPU" button (with + SVG icon) appends new GPU entries. Implements live touch-gated validation via shared `validatePcForm` utility which now validates a `gpus[]` array (replacing the scalar `vram` field). Supports per-row inline validation errors and section-level error display. Accepts `loading`, `error`, and `clearError` props from the parent's mutation hook to display API error banners, disable the submit button during in-flight requests, and clear stale errors on mount. Complete WAI-ARIA accessibility attributes, responsive breakpoints (mobile full-screen / md+ centered card), and keyboard + backdrop dismissals.

### Imports and dependencies

| Module | Elements imported | Type |
|--------|------------------|------|
| `react` | `useState`, `useEffect` | External (React core) |
| `../../utils/validators.js` | `validatePcForm` | Internal — Phase 4 validator for PC/add-server flows |

### Functions (Component-level)

- **`AddPcModal({ onSave, onClose, loading, error, clearError }) → JSX.Element`** *(default export)*
  A controlled React form modal that renders only when its parent (`App.jsx`) sets `modalState.type === 'addPc'`. Owns three internal state slices: draft form data, per-field validation errors, and touch-gate booleans. Delegates all heavy lifting upward via props — no data-fetching or persistence logic.
  - **`onSave(data: { nombre: string, ip: string, gpus: Array<{ name: string, vram: number }> }) => void`** — Callback invoked on successful validation + sanitize before emit. The payload now includes an array of GPU objects (each with `name` and `vram`) instead of a scalar `vram`. The parent's `handleAddPc` handler pipes this payload through the Express backend (`createPc`) and then refetches the full server list.
  - **`onClose(): () => void`** — Cancellation callback triggered by Cancel button, Escape key, or clicking outside the panel bounds (overlay backdrop). Parent resets `modalState` to idle `{ type: null, payload: null }`.
  - **`loading: boolean`** (default `false`) — When `true`, the submit button is disabled and shows a spinning SVG loader with "Adding..." text.
  - **`error: string | null`** (default `null`) — API error message returned from the `createPc` mutation. Displayed in a styled danger banner above the form buttons.
  - **`clearError: () => void`** — Callback to reset the parent's error state. Called on mount via `useEffect` to dismiss stale errors from a previous submission attempt.

#### Internal state (managed via hooks)

| Hook | Variable | Initial value | Role |
|------|----------|---------------|------|
| `useState` | `formData` | `{ nombre: '', ip: '', vram: '' }` | Draft values keyed by input `id`; updated via functional-updater pattern in live-validation handler. |
| `useState` | `errors` | `{}` | Per-field validation error strings; shape mirrors subset of formData keys with optional string values. |
| `useState` | `touched` | `{ nombre: false, ip: false, vram: false }` | Touch-gate booleans; prevents blank-state errors from showing on initial render before user has interacted with a field. |

#### Lifecycle side-effects

**`useEffect(() => { keydown → onClose() }, [onClose])`**
Registers a global `keydown` handler on `window`. When `event.key === 'Escape'`, invokes `onClose()`. Cleanup via `removeEventListener` on unmount to prevent stale closures under React StrictMode.

**`useEffect(() => { if (clearError) clearError(); }, [clearError])`**
Clears any stale API error from the parent's mutation hook when the modal mounts. This ensures the user does not see an old error message if they reopen the modal after a previous failed submission.

#### Inner methods (component body)

- **`handleChange(e: React.ChangeEvent<HTMLInputElement>) → void`**
  Bound to `onChange` on all three form inputs. Extracts `{ id, value }` from `event.target`, updates matching key in `formData` via functional setter, triggers immediate live validation by calling `validatePcForm(updatedData)` → stores returned error map in state, and marks that field as touched (`true`). Dual data+validation update on every keystroke eliminates need for explicit submit-to-validate round-trips.

- **`handleSubmit(e: React.FormEvent<HTMLFormElement>) → void`**
  Bound to `<form onSubmit={...}>`. First marks all fields as touched, then performs final full-form validation via `validatePcForm(formData)`. If any errors exist, aborts early (errors remain in state and render). On success: trims string fields (`nombre`, `ip`) and coerces `vram` → Number before dispatching clean payload upward through `onSave(...)`.

#### Validation rules (delegated to shared helper)

| Field | Rule enforced by `validatePcForm` | Example error message |
|-------|-----------------------------------|-----------------------|
| `nombre` | Non-empty string after `.trim()` | `"Server name is required"` |
| `ip` | IPv4 format, four octets each ∈ [0, 255] | `"IP address is required"` / `"Must be a valid IPv4 address (e.g., 192.168.1.100)"` / `"Each octet must be between 0 and 255"` |
| `vram` | Positive number ≥ 1; rejects empty/null/NaN | `"Total VRAM must be a positive number (≥ 1 GB)"` |

Validation runs twice: live on every keystroke AND final at submit time. Both phases call the same Phase-4 helper (`validatePcForm`).

#### Form layout rendered

| Position | Input `id` | HTML type | Label text | Placeholder value |
|----------|-----------|-----------|------------|-------------------|
| 1st field | `nombre` | `text` | "Name" | `"e.g. render-node-01"` |
| 2nd field | `ip` | `text` | "IP Address" | `"e.g. 192.168.1.100"` |
| 3rd field | `vram` | `number` (min="1") | "Total VRAM (GB)" | `"e.g. 24"` |

#### Accessibility features implemented

- **Dialog semantics** — `<form>` element carries `role="dialog"` + `aria-modal="true"`, signaling modal context to assistive tech on open.
- **Accessible label** — `aria-label="Add new server"` read aloud by screen-readers when modal mounts.
- **Label-Input binding** — each `<label htmlFor="{id}">` matches the corresponding input's `id`, providing native focus association.
- **Error-state indicator** — `aria-invalid={true/false}` dynamically applied per-field using combined (error ∧ touched) guard.
- **Error description link** — `aria-describedby` references respective error `<p>` node (`nombre-error`, `ip-error`, or `vram-error`) only while visible.
- **Escape key dismissal** — registered through useEffect, cleaned up on unmount.
- **Backdrop click dismissal** — outer `<div>` has `onClick={onClose}`; inner `<form>` stops propagation to prevent accidental dismissals when interacting with inputs or buttons.

#### API error banner and loading spinner

When the parent passes `error` and `loading` props (from the `useCreatePc` mutation hook), the modal displays:

- **API error banner** — A styled `<div>` with `bg-danger/10` background, `border-danger/30` border, and `text-danger` text. Renders conditionally when `error` is truthy. Positioned above the form buttons, below the VRAM input field.
- **Submit button loading state** — When `loading` is `true`:
  - Button is disabled (`disabled={loading}`) with reduced opacity (`disabled:opacity-50`) and a not-allowed cursor.
  - An animated spinning SVG loader (`animate-spin h-4 w-4`) is displayed inline.
  - Button text changes from "Add Server" to "Adding...".

These UI elements allow the modal to remain open on API errors so the user can correct input and retry, while providing clear visual feedback during in-flight requests.

#### Responsive behavior (mobile ↔ desktop)

| Breakpoint | Presentación |
|-----------|-------------|
| Mobile (`< 768px`) | Full-screen overlay: `h-screen`, `w-full max-w-none`, no outer margins, no border-radius — fills viewport. |
| Desktop (`≥ 768px md+`) | Centered card: `max-w-[420px]`, `m-4`, rounded-lg corners. Padding scales up at `md:p-6` and `lg:p-8`. |

#### Animation detail

Entrance animation uses project-wide Tailwind keyframe class **`animate-dialog-fade`** (defined in `tailwind.config.js`). Produces fade-in effect consistent with existing Phase 4 transition conventions. Backdrop fills with semi-transparent `bg-bg-primary/82` plus `backdrop-blur-sm` depth separation from dashboard behind it.

---

## 📄 EditPcModal.jsx

Modal dialog for editing an existing GPU server. Mirrors `AddPcModal` in layout and validation but **pre-fills form fields** from an incoming `pc` prop using a **lazy-state initializer** (`useState(() => { ... })`) with a **three-tier legacy fallback cascade**. Dispatches an update payload including `_id` for PUT routing. Accepts `loading`, `error`, and `clearError` props from the parent's mutation hook to display API error banners, disable the submit button during in-flight requests, and clear stale errors on mount.

The GPU list UI (add/remove/field-change handlers) is **pixel-identical** to AddPcModal's GPU section (T6), but uniquely pre-populates from existing data rather than starting blank. The lazy initializer pattern (React best practice per Vercel guidelines) ensures the fallback logic executes exactly once on mount, avoiding repeated computations during re-renders.

### Imports and dependencies

| Module | Elements imported | Type |
|--------|------------------|------|
| `react` | `useState`, `useEffect` | External (React core) |
| `../../utils/validators.js` | `validatePcForm` | Internal — Phase 4 validator for PC/add-server flows |

### Functions (Component-level)

- **`EditPcModal({ pc, onSave, onClose, loading, error, clearError }) → JSX.Element`** *(default export)*
  A controlled React form modal that renders when its parent (`App.jsx`) sets `modalState.type === 'editPc'`. Pre-populates internal state from the `pc` prop via a **lazy initializer function** passed directly to `useState()`. Delegates persistence upward via props — no data-fetching logic.
  - **`pc: Object`** — Existing PC document `{ _id, nombre, ip, gpus?, vram?, servicios[] }`. The presence of the optional `gpus?` key (modern schema) or scalar `vram` (legacy schema) determines which branch of the three-tier fallback cascade is taken during state initialization.
  - **`onSave(data: { _id: string, nombre: string, ip: string, gpus: Array<{ name: string, vram: number }> }) => void`** — Callback invoked on successful validation + sanitize before emit. The payload **now includes a `gpus[]` array** (not scalar `vram`) so the backend can route through `updatePc()` with multi-GPU data.
  - **`onClose(): () => void`** — Cancellation callback triggered by Cancel button, Escape key, or clicking outside the panel bounds (overlay backdrop). Parent resets `modalState` to idle `{ type: null, payload: null }`.
  - **`loading: boolean`** (default `false`) — When `true`, the submit button is disabled and shows a spinning SVG loader with "Saving..." text.
  - **`error: string | null`** (default `null`) — API error message returned from the `updatePc` mutation. Displayed in a styled danger banner above the form buttons.
  - **`clearError: () => void`** — Callback to reset the parent's error state. Called on mount via `useEffect` to dismiss stale errors from a previous submission attempt.

#### State initialization: lazy initializer with three-tier legacy fallback

Unlike AddPcModal which uses static defaults, EditPcModal passes a **function** as the initial argument to `useState`. This function executes exactly once during component mount (React best practice, avoiding unnecessary recomputation on every render). The function implements a **three-tier cascade** to handle schema migration:

```
TIER 1 (Modern):  if Array.isArray(pc.gpus) && pc.gpus.length > 0
                  → map each gpu → { name: gpu.name ?? `GPU ${idx+1}`, vram: String(gpu.vram ?? '') }

TIER 2 (Legacy):  else if pc.vram != null && pc.vram !== ''
                  → [{ name: 'GPU 1', vram: String(pc.vram) }]

TIER 3 (Default): else
                  → [{ name: 'GPU 1', vram: '' }]
```

This fallback allows the modal to gracefully handle both **modern PC documents** (which store GPUs as an array with per-GPU `name` and `vram`) and **legacy documents** (which store a scalar `vram` value representing total VRAM).

#### Internal state (managed via hooks)

| Hook | Variable | Initial value | Role |
|------|----------|---------------|------|
| `useState(() => { ... })` | `formData` | Computed lazily: `{ nombre: pc?.nombre, ip: pc?.ip, gpus: <computed from 3-tier cascade> }`. `gpus` is an **array** of `{ name: string, vram: string }` objects (vram stored as string in form for number-input compatibility). | Draft values pre-filled from the `pc` prop; updated via functional-updater pattern in live-validation handler. The lazy initializer ensures the 3-tier fallback runs exactly once on mount. |
| `useState` | `errors` | `{}` | Per-field validation error strings; shape mirrors subset of formData keys with optional string values. |
| `useState` | `touched` | `{ nombre: false, ip: false, gpus: false }` | Touch-gate booleans — tracks `{ nombre, ip, gpus }` (not the old scalar `vram`). Prevents blank-state errors from showing on initial render before user has interacted with a field. |

#### Lifecycle side-effects

**`useEffect(() => { keydown → onClose() }, [onClose])`**
Registers a global `keydown` handler on `window`. When `event.key === 'Escape'`, invokes `onClose()`. Cleanup via `removeEventListener` on unmount to prevent stale closures under React StrictMode.

**`useEffect(() => { if (clearError) clearError(); }, [clearError])`**
Clears any stale API error from the parent's mutation hook when the modal mounts. This ensures the user does not see an old error message if they reopen the modal after a previous failed submission.

#### Inner methods (component body)

- **`handleChange(e: React.ChangeEvent<HTMLInputElement>) → void`**
  Bound to `onChange` on the two scalar form inputs (`nombre`, `ip`). Extracts `{ id, value }` from `event.target`, updates matching key in `formData` via functional setter, triggers immediate live validation by calling `validatePcForm(updatedData)` → stores returned error map in state, and marks that field as touched (`true`).

- **`handleGpuFieldChange(idx: number, field: string, value: string) → void`**
  Bound to `onChange` on each GPU row's name text input and vram number input. Replaces the GPU at index `idx` in the `gpus[]` array with an updated copy (`{ ...updatedGpus[idx], [field]: value }`). Triggers live validation via `validatePcForm(updatedData)` and marks `gpus` as touched. **Identical to AddPcModal's handler** (T6 parity).
  - `idx`: zero-based index of the GPU row in the `formData.gpus[]` array.
  - `field`: either `'name'` or `'vram'`.
  - `value`: the raw string value from the input element.

- **`handleAddGpu() → void`**
  Appends a new GPU entry `{ name: \`GPU ${prev.gpus.length + 1}\`, vram: '' }` to the end of `formData.gpus[]`. Marks `gpus` as touched. **Identical to AddPcModal's handler** (T6 parity).

- **`handleRemoveGpu(idx: number) → void`**
  Removes the GPU at index `idx` from `formData.gpus[]` via `.filter()`. Enforces a minimum of one GPU — if `prev.gpus.length <= 1`, returns the state unchanged (remove button is also `disabled` at this threshold). Triggers live validation. **Identical to AddPcModal's handler** (T6 parity).

- **`handleSubmit(e: React.FormEvent<HTMLFormElement>) → void`**
  Bound to `<form onSubmit={...}>`. First marks all fields as touched (`{ nombre: true, ip: true, gpus: true }`), then performs final full-form validation via `validatePcForm(formData)`. If any errors exist, aborts early (errors remain in state and render). On success: trims string fields (`nombre`, `ip`) and maps the `gpus[]` array to coerce each GPU's `name` (defaults to `\`GPU ${idx+1}\``) and `vram` → Number. Dispatches clean payload including `pc?._id` upward through `onSave(...)`.
  
  **Payload shape:** `{ _id: pc?._id, nombre: trimmed string, ip: trimmed string, gpus: [{ name, vram: number }] }`

#### GPU list rendered section

The third form section renders a dynamic GPU list identical to AddPcModal (T6):
- Section header with "GPUs" label and "+ Add GPU" button (with SVG plus icon).
- Each GPU row is a two-column grid (`grid-cols-[1fr_auto]`): name text input (flex-grow) + vram number input (fixed `w-20`) + remove-X icon button.
- Remove button is disabled when only one GPU remains: `disabled={formData.gpus.length <= 1}` with `disabled:opacity-30` and `disabled:cursor-not-allowed`.
- Section-level error display (`{errors.gpus && touched.gpus}`) above the rows.
- Per-row inline error display (`{errors[\`gpus[${idx}]\`] && touched.gpus}`) below each row.
- Each GPU input has dynamic `id={\`gpu-name-${idx}\`}` and `id={\`gpu-vram-${idx}\`}` for accessibility binding.

#### Form layout rendered

| Position | Input `id` | HTML type | Label text | Placeholder value |
|----------|-----------|-----------|------------|-------------------|
| 1st field | `nombre` | `text` | "Name" | `"e.g. render-node-01"` |
| 2nd field | `ip` | `text` | "IP Address" | `"e.g. 192.168.1.100"` |
| 3rd section | `gpu-name-${idx}` / `gpu-vram-${idx}` (dynamic) | `text` / `number` | "GPUs" | Dynamic per-row: GPU name placeholder, "GB" for VRAM |

#### Parity with AddPcModal (T6)

The GPU list section of EditPcModal is **pixel-identical** to AddPcModal's GPU section: same Tailwind classes, same SVG icons, same grid layout, same per-row error bindings, and the same three handler functions (`handleGpuFieldChange`, `handleAddGpu`, `handleRemoveGpu`). The only distinguishing features are:

1. **State pre-filling**: AddPcModal initializes with a single empty GPU row; EditPcModal uses the lazy initializer with three-tier fallback to pre-populate from existing data.
2. **Touch tracking key**: Both use `{ nombre, ip, gpus }` — updated in T11 for parity (previously EditPcModal tracked scalar `vram`).

#### API error banner and loading spinner

When the parent passes `error` and `loading` props (from the `useUpdatePc` mutation hook), the modal displays:

- **API error banner** — A styled `<div>` with `bg-danger/10` background, `border-danger/30` border, and `text-danger` text. Renders conditionally when `error` is truthy. Positioned above the form buttons, below the GPUs section.
- **Submit button loading state** — When `loading` is `true`:
  - Button is disabled (`disabled={loading}`) with reduced opacity (`disabled:opacity-50`) and a not-allowed cursor.
  - An animated spinning SVG loader (`animate-spin h-4 w-4`) is displayed inline.
  - Button text changes from "Update Server" to "Saving...".

These UI elements allow the modal to remain open on API errors so the user can correct input and retry, while providing clear visual feedback during in-flight requests.

#### Responsive behavior (mobile ↔ desktop)

| Breakpoint | Presentation |
|-----------|-------------|
| Mobile (`< 768px`) | Full-screen overlay: `h-screen`, `w-full max-w-none`, no outer margins, no border-radius — fills viewport. |
| Desktop (`≥ 768px md+`) | Centered card: `max-w-[420px]`, `m-4`, rounded-lg corners. Padding scales up at `md:p-6` and `lg:p-8`. |

#### Accessibility features implemented

- **Dialog semantics** — `<form>` element carries `role="dialog"` + `aria-modal="true"`, signaling modal context to assistive tech on open.
- **Accessible label** — `aria-label="Edit server"` read aloud by screen-readers when modal mounts.
- **Label-Input binding** — each `<label htmlFor="{id}">` matches the corresponding input's `id`, providing native focus association.
- **Error-state indicator** — `aria-invalid={true/false}` dynamically applied per-field using combined (error ∧ touched) guard. Per-GPU rows use `aria-invalid` keyed by `errors[\`gpus[${idx}]\`]`.
- **Error description link** — `aria-describedby` references respective error `<p>` node only while visible.
- **Escape key dismissal** — registered through useEffect, cleaned up on unmount.
- **Backdrop click dismissal** — outer `<div>` has `onClick={onClose}`; inner `<form>` stops propagation to prevent accidental dismissals.

---

## 📄 AddServiceModal.jsx

Controlled-form modal dialog for adding a new service to a GPU server. Renders as a fixed-position overlay with **four** form controls: name, port, a **GPU selector dropdown** (new in T12), and GPU VRAM amount. Implements live touch-gated validation entirely via the shared `validateServiceForm` utility with its 3-argument signature (`data`, `services`, `gpus`) — which now handles both base field validation AND per-GPU capacity checks internally, eliminating the need for a local `checkGpuCap` helper. The GPU selector dropdown labels each option with the GPU name and remaining free VRAM on that specific GPU (computed via `getRemainingVram`). Now accepts `loading`, `error`, and `clearError` props from the parent's mutation hook to display API error banners, disable the submit button during in-flight requests, and clear stale errors on mount. Follows the same pattern established in T6 (AddPcModal), T7 (EditPcModal), and T8 (DeleteConfirmModal).

### Imports and dependencies

| Module | Elements imported | Type |
|--------|------------------|------|
| `react` | `useState`, `useEffect` | External (React core) |
| `../../utils/validators.js` | `validateServiceForm` | Internal — Phase 4 validator for service forms (now called with 3 args: data, services, gpus) |
| `../../utils/gpuHelpers.js` | `getRemainingVram` | Internal — computes free VRAM on a specific GPU index (new import in T12) |

### Functions (Component-level)

- **`AddServiceModal({ pcId, pcGpus, pcServices, onSave, onClose, loading, error, clearError }) → JSX.Element`** *(default export)*
  A controlled React form modal that renders only when its parent (`App.jsx`) sets `modalState.type === 'addService'`. Owns three internal state slices: draft form data (now including `assignedGpu`), per-field validation errors, and touch-gate booleans. Delegates all heavy lifting upward via props — no data-fetching or persistence logic.
  - **`pcId: string`** — MongoDB `_id` of the parent GPU server to attach the service to. Included in the submitted payload for routing.
  - **`pcGpus: Array<{ name: string, vram: number }>`** *(replaces legacy `pcVram`)* — Full array of GPU objects on the target server. Used to populate the GPU selector dropdown options and fed into `validateServiceForm` + `getRemainingVram` for per-GPU capacity checks.
  - **`pcServices: Array<Object>`** *(replaces legacy `currentGpuUsed`)* — Existing services array on that server. Fed into `validateServiceForm` so it can compute what VRAM is already consumed on each GPU. For the ADD flow this includes ALL current services; when EditServiceModal reuses this pattern, it passes services MINUS the entry being edited.
  - **`onSave(data: { pcId: string, nombre: string, puerto: number, gpu: number, assignedGpu: number }) => void`** — Callback invoked on successful validation + sanitize before emit. The payload now includes `assignedGpu` (the zero-based GPU index) so the backend can assign the service to a specific GPU. The parent's `handleSaveService` handler pipes this payload through the Express backend (`createService`) and then refetches the full server list.
  - **`onClose(): () => void`** — Cancellation callback triggered by Cancel button, Escape key, or clicking outside the panel bounds (overlay backdrop). Parent resets `modalState` to idle `{ type: null, payload: null }`.
  - **`loading: boolean`** (default `false`) — When `true`, the submit button is disabled and shows a spinning SVG loader with "Adding..." text.
  - **`error: string | null`** (default `null`) — API error message returned from the `createService` mutation. Displayed in a styled danger banner above the form buttons.
  - **`clearError: () => void`** — Callback to reset the parent's error state. Called on mount via `useEffect` to dismiss stale errors from a previous submission attempt.

#### Internal state (managed via hooks)

| Hook | Variable | Initial value | Role |
|------|----------|---------------|------|
| `useState` | `formData` | `{ nombre: '', puerto: '', gpu: '', assignedGpu: '0' }` *(updated: includes `assignedGpu`)* | Draft values keyed by input `id`; updated via functional-updater pattern in live-validation handler. `assignedGpu` defaults to `'0'` (first GPU). |
| `useState` | `errors` | `{}` | Per-field validation error strings; shape mirrors subset of formData keys with optional string values (now includes `assignedGpu`). |
| `useState` | `touched` | `{ nombre: false, puerto: false, gpu: false, assignedGpu: false }` *(updated: includes `assignedGpu`)* | Touch-gate booleans; prevents blank-state errors from showing on initial render before user has interacted with a field. Tracks four fields now. |

#### Lifecycle side-effects

**`useEffect(() => { keydown → onClose() }, [onClose])`**
Registers a global `keydown` handler on `window`. When `event.key === 'Escape'`, invokes `onClose()`. Cleanup via `removeEventListener` on unmount to prevent stale closures under React StrictMode.

**`useEffect(() => { if (clearError) clearError(); }, [clearError])`**
Clears any stale API error from the parent's mutation hook when the modal mounts. This ensures the user does not see an old error message if they reopen the modal after a previous failed submission.

#### Inner methods (component body)

~*Legacy `checkGpuCap` function deleted in T12 — per-GPU capacity validation is now handled entirely by `validateServiceForm(data, services, gpus)` which uses `getRemainingVram` internally.*~

- **`handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) → void`**
  Bound to `onChange` on all four form inputs (three text/number fields + one select). Extracts `{ id, value }` from `event.target`, updates matching key in `formData` via functional setter, triggers immediate live validation by calling **`validateServiceForm(updatedData, pcServices, pcGpus)`** with three arguments → stores returned error map directly into state (no merging needed since validateServiceForm now handles everything including per-GPU capacity), and marks that field as touched (`true`). Single-call validation replaces the old two-call pattern (`validateServiceForm` + `checkGpuCap`).

- **`handleSubmit(e: React.FormEvent<HTMLFormElement>) → void`**
  Bound to `<form onSubmit={...}>`. First marks all four fields as touched (`{ nombre: true, puerto: true, gpu: true, assignedGpu: true }`), then performs final full-form validation via a single call to **`validateServiceForm(formData, pcServices, pcGpus)`**. If `finalResult.valid` is false, aborts early (errors remain in state and render). On success: trims `nombre`, coerces `puerto`, `gpu`, AND `assignedGpu` → Number before dispatching clean payload upward through `onSave(...)`.

  **Payload shape:** `{ pcId, nombre: trimmed string, puerto: number, gpu: number, assignedGpu: number }` — note that `assignedGpu` is the zero-based GPU index.

#### Validation rules (delegated to shared helper)

All validation now flows through a single call to `validateServiceForm(data, pcServices, pcGpus)`. The helper performs field-level checks AND per-GPU capacity checks using `getRemainingVram(gpus, services, assignedIdx)` internally.

| Field | Rule enforced by `validateServiceForm` | Example error message |
|-------|----------------------------------------|-----------------------|
| `nombre` | Non-empty string after `.trim()` | `"Service name is required."` |
| `puerto` | Integer in range [1, 65535]; rejects empty/null/NaN | `"Port must be a number between 1 and 65535."` |
| `gpu` | Number ≥ 0; rejects empty/null/NaN | `"GPU usage must be a number ≥ 0."` |
| `assignedGpu` *(new)* | Must be present, coercible to non-negative integer, within `[0, gpus.length)` | *"Please select a GPU for this service."* / *"GPU index must be a non-negative integer."* / *"Selected GPU index {N} is out of range."* |
| `gpu` (per-GPU overflow) *(new)* | `newGpu ≤ getRemainingVram(gpus, services, assignedIdx)` — checks selected GPU specifically | *"Not enough free VRAM on {gpuName}. Only {remaining} GB remaining."* |

Validation runs twice: live on every keystroke AND final at submit time. Both phases call the **same single** `validateServiceForm(updatedData, pcServices, pcGpus)`. No separate `checkGpuCap` needed (deleted in T12).

#### GPU Selector Dropdown Section *(new in T12)*

A new form section between "Port" and "GPU VRAM (GB)" fields:

**Layout:**
```
[Port input]
↓
[label: "Assign to GPU"]
  └─> <select id="assignedGpu">
        ├─> Option 0: "{gpu.name || 'GPU 1'} — {remain} GB free"
        ├─> Option 1: "{gpu.name || 'GPU 2'} — {remain} GB free"
        └─> ...one <option> per GPU in pcGpus array
      </select>
      └─> {errors.assignedGpu && touched.assignedGpu ? <p id="assignedGpu-error">...</p> : null}
↓
[GPU VRAM input]
```

**Option generation:** Each `<option>` is created via `.map()` on `pcGpus`. The label format is `{gpu.name || \`GPU ${idx+1}\`} — {remain} GB free` where:
- `remain = getRemainingVram(pcGpus, pcServices, idx)` — computed per-option
- `value = String(idx)` — zero-based GPU index

**Empty guard:** If `pcGpus.length === 0`, the dropdown is replaced by a disabled message rendered as `<p className="... italic">No GPUs available on this server.</p>` — no `<select>` element is rendered, preventing interactions when there is nothing to assign.

#### Form layout rendered *(updated for T12)*

| Position | Input `id` | HTML type | Label text | Placeholder value |
|----------|-----------|-----------|------------|-------------------|
| 1st field | `nombre` | `text` | "Name" | `"e.g. stable-diffusion-webui"` |
| 2nd field | `puerto` | `number` (min="1", max="65535") | "Port" | `"e.g. 7860"` |
| 3rd control *(new)* | `assignedGpu` | `select` (dropdown) | "Assign to GPU" | Dynamically generated: `{gpuName} — {freeGB} GB free` per option |
| 4th field | `gpu` | `number` (min="0") | "GPU VRAM (GB)" | `"e.g. 12"` |

#### Accessibility features implemented

- **Dialog semantics** — `<form>` element carries `role="dialog"` + `aria-modal="true"`, signaling modal context to assistive tech on open.
- **Accessible label** — `aria-label="Add new service"` read aloud by screen-readers when modal mounts.
- **Label-Input binding** — each `<label htmlFor="{id}">` matches the corresponding input's `id`, providing native focus association (now covers four controls including the new `assignedGpu` select).
- **Error-state indicator** — `aria-invalid={true/false}` dynamically applied per-field using combined (error ∧ touched) guard; extends to the GPU selector dropdown. Error description link references `assignedGpu-error` when visible.
- **Hint text** — The GPU VRAM field shows a `<p id="gpu-hint">` with remaining VRAM count for the *selected* GPU when no error is present, linked via `aria-describedby` by default.
- **Escape key dismissal** — registered through useEffect, cleaned up on unmount.
- **Backdrop click dismissal** — outer `<div>` has `onClick={onClose}`; inner `<form>` stops propagation to prevent accidental dismissals when interacting with inputs or buttons.

#### API error banner and loading spinner

When the parent passes `error` and `loading` props (from the `useCreateService` mutation hook), the modal displays:

- **API error banner** — A styled `<div>` with `bg-danger/10` background, `border-danger/30` border, and `text-danger` text. Renders conditionally when `error` is truthy. Positioned above the form buttons, below the GPU input field.
- **Submit button loading state** — When `loading` is `true`:
  - Button is disabled (`disabled={loading}`) with reduced opacity (`disabled:opacity-50`) and a not-allowed cursor.
  - An animated spinning SVG loader (`animate-spin h-4 w-4`) is displayed inline.
  - Button text changes from "Add Service" to "Adding...".

These UI elements allow the modal to remain open on API errors so the user can correct input and retry, while providing clear visual feedback during in-flight requests. This follows the same pattern established in T6 (AddPcModal), T7 (EditPcModal), and T8 (DeleteConfirmModal).

#### Responsive behavior (mobile ↔ desktop)

| Breakpoint | Presentation |
|-----------|-------------|
| Mobile (`< 768px`) | Full-screen overlay: `h-screen`, `w-full max-w-none`, no outer margins, no border-radius — fills viewport. |
| Desktop (`≥ 768px md+`) | Centered card: `max-w-[420px]`, `m-4`, rounded-lg corners. Padding scales up at `md:p-6` and `lg:p-8`. |

#### Animation detail

Entrance animation uses project-wide Tailwind keyframe class **`animate-dialog-fade`** (defined in `tailwind.config.js`). Produces fade-in effect consistent with existing Phase 5 transition conventions. Backdrop fills with semi-transparent `bg-bg-primary/82` plus `backdrop-blur-sm` depth separation from dashboard behind it.

#### Remaining VRAM indicator *(updated for per-GPU display)* ~~old~~

~~The GPU input field displayed a generic `{remainingVram} GB remaining` hint computed as `Math.max(0, pcVram - currentGpuUsed)` — an aggregate across all GPUs.~~

**New (T12):** The GPU VRAM input field displays a per-**selected-GPU** hint using an IIFE inline in JSX:
```jsx
(() => {
  const selectedIdx = Number(formData.assignedGpu);
  if (!isNaN(selectedIdx) && Array.isArray(pcGpus) && selectedIdx >= 0 && selectedIdx < pcGpus.length) {
    const gpuRemain = getRemainingVram(pcGpus, pcServices, selectedIdx);
    return (<p id="gpu-hint">...{gpuRemain} GB remaining on {pcGpus[selectedIdx].name || `GPU ${selectedIdx + 1}`}</p>);
  }
  return null;
})()
```
This shows `{N} GB remaining on {gpuName}` — named GPU, not aggregate. The hint is replaced by an error message when the entered GPU value exceeds available capacity (via `validateServiceForm`'s internal per-GPU check). Guards against index out-of-bounds and non-array inputs by returning `null`.

---

## 📄 DeleteConfirmModal.jsx

Minimal confirmation dialog for destructive operations (e.g., deleting a GPU server or an AI service). Displays a dynamic warning message with Cancel (secondary) and Delete (danger) action buttons. After the user clicks Delete, `onConfirm` fires — the modal does NOT auto-close. The parent (`App.jsx`) controls whether to close the modal based on the mutation result, allowing error banners to be displayed on failure.

### Imports and dependencies

| Module | Elements imported | Type |
|--------|------------------|------|
| `react` | `useEffect` | External (React core) |

### Component

#### `DeleteConfirmModal({ isOpen, message, onConfirm, onCancel, loading, error }) → JSX.Element | null` *(default export)*

A lightweight confirmation modal. Renders a fixed-position overlay with a centered card containing the warning text and two action buttons. Returns `null` when `isOpen` is falsy (no hidden-DOM clutter). Now accepts `loading` and `error` props from the parent's mutation hook to display an API error banner, disable both buttons during in-flight requests, and show a spinner on the Delete button.

- **`isOpen: boolean`** — Controls whether the dialog is visible. Parent manages this state; component performs conditional render (`if (!isOpen) return null`).
- **`message: string`** — Dynamic body text rendered as a `<p>` inside the dialog. Caller supplies context-specific warning (e.g., `"Delete server 'render-node-01'? This action cannot be undone."`).
- **`onConfirm: () => void`** — Invoked when user clicks the Delete button. Fires `onConfirm()` only; does NOT auto-close the modal. The parent (`App.jsx`) controls whether to close based on the mutation result.
- **`onCancel: () => void`** — Invoked on Cancel click, backdrop click, or Escape key press. Shared path for all dismissal scenarios.
- **`loading: boolean`** (default `false`) — When `true`, both buttons are disabled and the Delete button shows a spinning SVG loader with "Deleting..." text.
- **`error: string | null`** (default `null`) — API error message returned from the mutation hook. Displayed in a styled danger banner between the message text and the action buttons.

#### Lifecycle side-effect (Escape listener)

**`useEffect(() => { keydown → onCancel() }, [onCancel])`**
Registers a global `keydown` handler on `window`. When `event.key === 'Escape'`, invokes `onCancel()`. Cleanup via `removeEventListener` on unmount to prevent stale closures under React StrictMode.

#### Inner methods (component body)

- **`handleConfirm() → void`**
  Bound to the Delete button's `onClick`. Fires `onConfirm()` only. Does NOT auto-close the modal — the parent (`App.jsx`) decides whether to close based on the mutation result. If the mutation succeeds, the parent calls `closeModal()`; if it fails, the modal stays open and the `error` banner is displayed.

- **`(e) => e.stopPropagation()`** *(anonymous, inline)*
  Bound to the inner `<div>`'s `onClick`. Prevents backdrop click from bubbling to the outer container, ensuring that interactions inside the card (inputs, buttons, scrolling) never accidentally dismiss the dialog.

#### Confirmation flow

| User action | Callback chain | Final modal state |
|-------------|---------------|-------------------|
| Click **Delete** (mutation succeeds) | `handleConfirm()` → `onConfirm()` → parent calls `closeModal()` | Closed |
| Click **Delete** (mutation fails) | `handleConfirm()` → `onConfirm()` → parent does NOT close | Open, error banner displayed |
| Click **Cancel** | `onCancel()` | Closed |
| Click **backdrop** (outside card) | `onCancel()` | Closed |
| Press **Escape** key | `onCancel()` (via useEffect listener) | Closed |

#### Accessibility features implemented

- **Dialog semantics** — `<div>` carries `role="dialog"` + `aria-modal="true"`, signaling a modal context to assistive technology.
- **Accessible label** — `aria-label="Confirm delete"` read aloud by screen-readers when modal mounts.
- **Escape key dismissal** — registered through useEffect, cleaned up on unmount.
- **Backdrop click dismissal** — outer `<div>` has `onClick={onCancel}`; inner `<div>` stops propagation via `(e) => e.stopPropagation()`.

#### API error banner and loading spinner

When the parent passes `error` and `loading` props (from the `useDeletePc` or `useDeleteService` mutation hooks), the modal displays:

- **API error banner** — A styled `<div>` with `bg-danger/10` background, `border-danger/30` border, and `text-danger` text. Renders conditionally when `error` is truthy. Positioned between the message `<p>` and the action buttons, separated by a top border. This follows the same pattern as `AddPcModal` (T6) and `EditPcModal` (T7).
- **Delete button loading state** — When `loading` is `true`:
  - Both Cancel and Delete buttons are disabled (`disabled={loading}`) with reduced opacity (`disabled:opacity-50`) and a not-allowed cursor (`disabled:cursor-not-allowed`).
  - An animated spinning SVG loader (`animate-spin h-4 w-4`) is displayed inline before the button text.
  - Button text changes from "Delete" to "Deleting...".
- **Modal stays open on error** — The `handleConfirm` callback no longer auto-closes the modal. The parent (`App.jsx`) awaits the mutation result and only calls `closeModal()` if `!result?.error`. This allows the user to see the error banner and retry the deletion.

These UI elements follow the same pattern established in T6 (`AddPcModal`) and T7 (`EditPcModal`): spinner SVG, error banner, disabled states, and conditional close.

#### Visual design

| Element | Styling details |
|---------|----------------|
| Backdrop overlay | Fixed-position, full viewport: `fixed inset-0 z-50`. Semi-transparent `bg-bg-primary/82` with `backdrop-blur-sm` to visually separate from dashboard content behind it. |
| Card container | Dark surface (`bg-bg-card`), rounded corners (`rounded-lg`), elevation shading via layered `box-shadow`. Centered vertically/horizontally via flexbox on backdrop. |
| Header | `<h2>` with `text-xl font-bold text-text-primary`: reads "Confirm Delete". |
| Message body | `<p>` with `text-base text-text-secondary`, relaxed line-height (`leading-relaxed`). Dynamically filled by the `message` prop. |
| Error banner (conditional) | `<div>` with `bg-danger/10` background, `border-danger/30` border, `rounded-md`, containing a `<p>` with `text-sm text-danger`. Appears between message and buttons when `error` is truthy. |
| Cancel button | Secondary style: bordered (`border border-border`), muted text (`text-text-secondary`), hover fill (`hover:bg-bg-hover`). Spans 50% width via `flex-1`. Disabled during loading with `disabled:opacity-50` and `disabled:cursor-not-allowed`. |
| Delete button | Danger style: solid red background (`bg-danger`), white bold text, shadow effect (`shadow-btn-danger`), hover darkening (`hover:bg-danger-hover`). Spans 50% width via `flex-1`. Flex container (`flex items-center justify-center gap-2`) to accommodate inline spinner SVG. Disabled during loading with `disabled:opacity-50` and `disabled:cursor-not-allowed`. |

#### Responsive behavior (mobile ↔ desktop)

| Breakpoint | Presentation |
|-----------|-------------|
| Mobile (`< 768px`) | Full-screen overlay: `h-screen`, `w-full max-w-none`, no outer margins, no border-radius — fills viewport for thumb-friendly dismiss. |
| Desktop (`≥ 768px md+`) | Centered card: `max-w-[420px]`, `m-4`, rounded-lg corners. Padding scales up at `md:p-6` and `lg:p-8`. |

#### Animation detail

Entrance animation uses project-wide Tailwind keyframe class **`animate-dialog-fade`** (defined in `tailwind.config.js`). Produces fade-in effect consistent with existing Phase 5 transition conventions.

---

## 📄 EditServiceModal.jsx

Modal dialog for editing an existing service on a GPU server. **Refactored in T13** to support GPU dropdown pre-selection, cross-GPU reassignment validation, and per-GPU remaining VRAM hints — aligning its architecture with AddServiceModal (T12). Pre-fills form fields from the `service` prop including current `assignedGpu`. Validates against per-GPU capacity by excluding the service being edited from the services array (`pcServicesExSelf`), ensuring both same-GPU VRAM changes and cross-GPU reassignment are checked correctly (the freed allocation on source GPU is accounted for automatically). Now accepts `loading`, `error`, and `clearError` props from the parent's mutation hook.

### Imports and dependencies

| Module | Elements imported | Type |
|--------|------------------|------|
| `react` | `useState`, `useEffect` | External (React core) |
| `../../utils/validators.js` | `validateServiceForm` | Internal — Phase 4 validator for service forms (now called with 3 args: data, services, gpus) |
| `../../utils/gpuHelpers.js` | `getRemainingVram` | Internal — computes free VRAM on a specific GPU index (new import in T13) |

### Functions (Component-level)

- **`EditServiceModal({ pcId, serviceIndex, service, pcGpus, pcServices, onSave, onCancel, loading, error, clearError }) → JSX.Element`** *(default export)*
  A controlled React form modal that renders when its parent (`App.jsx`) sets `modalState.type === 'editService'`. Pre-populates four internal state slices from the `service` prop (now including `assignedGpu`). Delegates persistence upward via props — no data-fetching logic.
  - **`pcId: string`** — MongoDB `_id` of the parent GPU server. Included in the submitted payload for routing.
  - **`serviceIndex: number`** — Array index of the service being edited. Used both in the submitted payload (for backend `updateService`) and to filter out this service from `pcServicesExSelf`.
  - **`service: Object`** — Existing service object `{ nombre, puerto, gpu, assignedGpu }`. Used to pre-fill form data including the GPU assignment.
  - **`pcGpus: Array<{ name: string, vram: number }>`** *(replaces legacy `pcVram`)* — Full array of GPU objects on the target server. Used to populate the GPU selector dropdown options and fed into `validateServiceForm` + `getRemainingVram` for per-GPU capacity checks.
  - **`pcServices: Array<Object>`** *(replaces legacy `currentGpuUsed`)* — Current services array on this PC (full, including the entry being edited). The modal internally filters out the service-at-index to produce `pcServicesExSelf` for correct per-GPU capacity validation.
  - **`onSave(data: { pcId: string, index: number, nombre: string, puerto: number, gpu: number, assignedGpu: number }) => void`** — Callback invoked on successful validation + sanitize before emit. The payload now includes `assignedGpu` for backend schema compliance. The parent's `handleEditServiceSubmit` handler pipes this through the Express backend (`updateService`) and closes the modal on success.
  - **`onCancel(): () => void`** — Cancellation callback triggered by Cancel button, Escape key, or clicking outside the panel bounds (overlay backdrop). Parent resets `modalState` to idle `{ type: null, payload: null }`.
  - **`loading: boolean`** (default `false`) — When `true`, the submit button is disabled and shows a spinning SVG loader with "Updating..." text.
  - **`error: string | null`** (default `null`) — API error message returned from the `updateService` mutation. Displayed in a styled danger banner above the form buttons.
  - **`clearError: () => void`** — Callback to reset the parent's error state. Called on mount via `useEffect` to dismiss stale errors from a previous submission attempt.

#### Internal state (managed via hooks)

| Hook | Variable | Initial value | Role |
|------|----------|---------------|------|
| `useState` | `formData` | `{ nombre: service?.nombre ?? '', puerto: String(service?.puerto ?? ''), gpu: String(service?.gpu ?? ''), assignedGpu: String(service?.assignedGpu ?? '0') }` *(updated in T13: includes `assignedGpu`)* | Draft values pre-filled from the `service` prop; updated via functional-updater pattern in live-validation handler. `assignedGpu` defaults to `'0'` (first GPU) if not present in legacy service data. |
| `useState` | `errors` | `{}` | Per-field validation error strings; shape mirrors subset of formData keys with optional string values (now includes `assignedGpu`). |
| `useState` | `touched` | `{ nombre: false, puerto: false, gpu: false, assignedGpu: false }` *(updated in T13: includes `assignedGpu`)* | Touch-gate booleans; prevents blank-state errors from showing on initial render before user has interacted with a field. |

#### Computed values

| Variable | Computation | Role |
|----------|------------|------|
| `pcServicesExSelf` | `pcServices.filter((_, i) => i !== serviceIndex)` | **Critical new computed value in T13.** Captures the services array minus the entry being edited. This ensures per-GPU capacity validation correctly frees this service's prior allocation from its GPU before checking — enabling both same-GPU VRAM changes and cross-GPU reassignments without double-counting. Replaces the old `oldGpu`/`remainingVram` scalar computation. |

~~**Legacy computed values (replaced in T13):**~~

~~| Variable | Computation | Role |
~~|----------|------------|------|
~~| `oldGpu` | `Number(service?.gpu) ?? 0` | ~~Captures the original GPU allocation at render time. ~~|
~~| `remainingVram` | `Math.max(0, pcVram - currentGpuUsed + oldGpu)` | ~~Remaining VRAM after freeing the old allocation. ~~|

#### Lifecycle side-effects

**`useEffect(() => { keydown → onCancel() }, [onCancel])`**
Registers a global `keydown` handler on `window`. When `event.key === 'Escape'`, invokes `onCancel()`. Cleanup via `removeEventListener` on unmount to prevent stale closures under React StrictMode.

**`useEffect(() => { if (clearError) clearError(); }, [clearError])`**
Clears any stale API error from the parent's mutation hook when the modal mounts. This ensures the user does not see an old error message if they reopen the modal after a previous failed submission.

#### Inner methods (component body)

~*Legacy `checkGpuCap` function deleted in T13 — per-GPU capacity validation is now handled entirely by `validateServiceForm(data, services, gpus)` which uses `getRemainingVram` internally.*~

- **`handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) → void`**
  Bound to `onChange` on all four form inputs (three text/number fields + one select for GPU assignment). Extracts `{ id, value }` from `event.target`, updates matching key in `formData` via functional setter, triggers immediate live validation by calling **`validateServiceForm(updatedData, pcServicesExSelf, pcGpus)`** with three arguments → stores returned error map directly into state (no merging needed since validateServiceForm now handles everything including per-GPU capacity), and marks that field as touched (`true`). Single-call validation replaces the old two-call pattern (`validateServiceForm` + `checkGpuCap`).

- **`handleSubmit(e: React.FormEvent<HTMLFormElement>) → void`**
  Bound to `<form onSubmit={...}>`. First marks all four fields as touched (`{ nombre: true, puerto: true, gpu: true, assignedGpu: true }`), then performs final full-form validation via a single call to **`validateServiceForm(formData, pcServicesExSelf, pcGpus)`**. If `finalResult.valid` is false, aborts early (errors remain in state and render). On success: trims `nombre`, coerces `puerto`, `gpu`, AND `assignedGpu` → Number before dispatching clean payload upward through `onSave(...)`.

  **Payload shape:** `{ pcId, index: serviceIndex, nombre: trimmed string, puerto: number, gpu: number, assignedGpu: number }` — note that `assignedGpu` is included for backend schema compliance.

#### Validation rules (delegated to shared helper)

All validation now flows through a single call to `validateServiceForm(data, pcServicesExSelf, pcGpus)`. The helper performs field-level checks AND per-GPU capacity checks using `getRemainingVram(gpus, services, assignedIdx)` internally.

| Field | Rule enforced by `validateServiceForm` | Example error message |
|-------|----------------------------------------|-----------------------|
| `nombre` | Non-empty string after `.trim()` | `"Service name is required."` |
| `puerto` | Integer in range [1, 65535]; rejects empty/null/NaN | `"Port must be a number between 1 and 65535."` |
| `gpu` | Number ≥ 0; rejects empty/null/NaN | `"GPU usage must be a number ≥ 0."` |
| `assignedGpu` | Must be present, coercible to non-negative integer, within `[0, gpus.length)` | *"Please select a GPU for this service."* / *"GPU index must be a non-negative integer."* / *"Selected GPU index {N} is out of range."* |
| `gpu` (per-GPU overflow) | `newGpu ≤ getRemainingVram(gpus, services, assignedIdx)` — checks selected GPU specifically | *"Not enough free VRAM on {gpuName}. Only {remaining} GB remaining."* |

Validation runs twice: live on every keystroke AND final at submit time. Both phases call the **same single** `validateServiceForm(updatedData, pcServicesExSelf, pcGpus)`. No separate `checkGpuCap` needed (deleted in T13).

#### GPU Selector Dropdown Section *(new in T13)*

A new form section between "Port" and "GPU VRAM (GB)" fields:

**Layout:**
```
[Port input]
↓
[label: "Assign to GPU"]
  └─> <select id="assignedGpu">
        ├─> Option 0: "{gpu.name || 'GPU 1'} — {remain} GB free"
        ├─> Option 1: "{gpu.name || 'GPU 2'} — {remain} GB free"
        └─> ...one <option> per GPU in pcGpus array
      </select>
      └─> {errors.assignedGpu && touched.assignedGpu ? <p id="assignedGpu-error">...</p> : null}
↓
[GPU VRAM input]
```

**Option generation:** Each `<option>` is created via `.map()` on `pcGpus`. The label format is `{gpu.name || \`GPU ${idx+1}\`} — {remain} GB free` where:
- `remain = getRemainingVram(pcGpus, pcServicesExSelf, idx)` — computed per-option, critically using `pcServicesExSelf` (which excludes the edited service) so remaining VRAM accurately reflects capacity after freeing this service's current allocation
- `value = String(idx)` — zero-based GPU index

**Pre-selection:** The dropdown value is bound to `formData.assignedGpu`, which is initialized from `service?.assignedGpu ?? '0'` — ensuring the currently assigned GPU appears selected on mount.

**Empty guard:** If `!Array.isArray(pcGpus) || pcGpus.length === 0`, the dropdown is replaced by a disabled message rendered as `<p className="... italic">No GPUs available on this server.</p>` — no `<select>` element is rendered, preventing interactions when there is nothing to assign.

#### Form layout rendered *(updated for T13)*

| Position | Input `id` | HTML type | Label text | Placeholder value |
|----------|-----------|-----------|------------|-------------------|
| 1st field | `nombre` | `text` | "Name" | `"e.g. stable-diffusion-webui"` |
| 2nd field | `puerto` | `number` (min="1", max="65535") | "Port" | `"e.g. 7860"` |
| 3rd control *(new in T13)* | `assignedGpu` | `select` (dropdown) | "Assign to GPU" | Dynamically generated: `{gpuName} — {freeGB} GB free` per option |
| 4th field | `gpu` | `number` (min="0") | "GPU VRAM (GB)" | `"e.g. 12"` |

#### Accessibility features implemented

- **Dialog semantics** — `<form>` element carries `role="dialog"` + `aria-modal="true"`, signaling modal context to assistive tech on open.
- **Accessible label** — `aria-label="Edit service"` read aloud by screen-readers when modal mounts.
- **Label-Input binding** — each `<label htmlFor="{id}">` matches the corresponding input's `id`, providing native focus association (now covers four controls including the new `assignedGpu` select).
- **Error-state indicator** — `aria-invalid={true/false}` dynamically applied per-field using combined (error ∧ touched) guard; extends to the GPU selector dropdown. Error description link references `assignedGpu-error` when visible.
- **Hint text** — The GPU VRAM field shows a `<p id="gpu-hint">` with remaining VRAM count for the *selected* GPU when no error is present, linked via `aria-describedby` by default.
- **Escape key dismissal** — registered through useEffect, cleaned up on unmount.
- **Backdrop click dismissal** — outer `<div>` has `onClick={onCancel}`; inner `<form>` stops propagation to prevent accidental dismissals when interacting with inputs or buttons.

#### API error banner and loading spinner

When the parent passes `error` and `loading` props (from the `useUpdateService` mutation hook), the modal displays:

- **API error banner** — A styled `<div>` with `bg-danger/10` background, `border-danger/30` border, and `text-danger` text. Renders conditionally when `error` is truthy. Positioned above the form buttons, below the GPU input field.
- **Submit button loading state** — When `loading` is `true`:
  - Button is disabled (`disabled={loading}`) with reduced opacity (`disabled:opacity-50`) and a not-allowed cursor.
  - An animated spinning SVG loader (`animate-spin h-4 w-4`) is displayed inline.
  - Button text changes from "Update Service" to "Updating...".

These UI elements allow the modal to remain open on API errors so the user can correct input and retry, while providing clear visual feedback during in-flight requests. This follows the same pattern established in T6 (AddPcModal), T7 (EditPcModal), T8 (DeleteConfirmModal), and T12 (AddServiceModal).

#### Responsive behavior (mobile ↔ desktop)

| Breakpoint | Presentation |
|-----------|-------------|
| Mobile (`< 768px`) | Full-screen overlay: `h-screen`, `w-full max-w-none`, no outer margins, no border-radius — fills viewport. |
| Desktop (`≥ 768px md+`) | Centered card: `max-w-[420px]`, `m-4`, rounded-lg corners. Padding scales up at `md:p-6` and `lg:p-8`. |

#### Animation detail

Entrance animation uses project-wide Tailwind keyframe class **`animate-dialog-fade`** (defined in `tailwind.config.js`). Produces fade-in effect consistent with existing Phase 5 transition conventions. Backdrop fills with semi-transparent `bg-bg-primary/82` plus `backdrop-blur-sm` depth separation from dashboard behind it.

#### Remaining VRAM indicator *(updated for per-GPU display)* ~~old~~

~~The GPU input field displays a hint paragraph showing the available VRAM: `{remainingVram} GB available`, computed as `Math.max(0, pcVram - currentGpuUsed + oldGpu)`. This reflected the recalculated capacity after freeing the old allocation using aggregate VRAM.~~

**New (T13):** The GPU VRAM input field displays a per-**selected-GPU** hint using an IIFE inline in JSX:
```jsx
(() => {
  const selectedIdx = Number(formData.assignedGpu);
  if (!isNaN(selectedIdx) && Array.isArray(pcGpus) && selectedIdx >= 0 && selectedIdx < pcGpus.length) {
    const gpuRemain = getRemainingVram(pcGpus, pcServicesExSelf, selectedIdx);
    return (<p id="gpu-hint">...{gpuRemain} GB remaining on {pcGpus[selectedIdx].name || `GPU ${selectedIdx + 1}`}</p>);
  }
  return null;
})()
```
This shows `{N} GB remaining on {gpuName}` — a named GPU, not an aggregate. The hint is replaced by an error message when the entered GPU value exceeds available capacity (via `validateServiceForm`'s internal per-GPU check). Guards against index out-of-bounds and non-array inputs by returning `null`. Critically uses `pcServicesExSelf` so that if the user changes the VRAM amount but stays on the same GPU, or moves to a different GPU, the available capacity is always computed with this service's allocation excluded.

---

## 🔄 Changes in this update

### Original creation (T021)
- **Created** new leaf-folder doc for modals/ directory as part of T021 deliverable (first Phase 5 modal).
- **Documented** full AddPcModal component: props contract (onSave closure, onClose callback), three-hook internal state, two inner methods with signatures, validation rules table, form field matrix, a11y checklist, responsive breakpoints, and animation class reference.

### T025 — DeleteConfirmModal addition
- **Added** full documentation for `DeleteConfirmModal.jsx` (T025): props contract (`isOpen`, `message`, `onConfirm`, `onCancel`), auto-closing confirmation flow table, one inner method (`handleConfirm`), Escape-key lifecycle effect, a11y features, button styling matrix, responsive breakpoints, and animation reference.
- **Updated** folder scope summary to include five modals (was four).

### T6 — AddPcModal loading/error props integration
- **Updated** `AddPcModal.jsx` props contract: now accepts `loading` (boolean), `error` (string|null), and `clearError` (function) in addition to `onSave` and `onClose`.
- **Added** lifecycle side-effect: `useEffect` calls `clearError()` on mount to dismiss stale API errors from previous submission attempts.
- **Added** API error banner documentation: styled `<div>` with `bg-danger/10` background displayed when `error` prop is truthy, positioned above form buttons.
- **Added** submit button loading state documentation: button disabled with `disabled:opacity-50` and `disabled:cursor-not-allowed`, animated spinning SVG loader, text changes to "Adding..." during in-flight requests.
- **Updated** component description to reflect new error handling and loading state capabilities.

### T7 — EditPcModal loading/error props integration
- **Added** full documentation for `EditPcModal.jsx`: props contract (`pc`, `onSave`, `onClose`, `loading`, `error`, `clearError`), three-hook internal state with pre-filled `formData` from `pc` prop, two inner methods with signatures, lifecycle side-effects (Escape listener + clearError on mount), API error banner and loading spinner documentation, responsive breakpoints, and accessibility features.
- **Updated** folder scope description to reflect EditPcModal's new error/loading capabilities.

### T8 — DeleteConfirmModal loading/error props integration
- **Updated** `DeleteConfirmModal.jsx` props contract: now accepts `loading` (boolean, default `false`) and `error` (string|null, default `null`) in addition to `isOpen`, `message`, `onConfirm`, `onCancel`.
- **Updated** `handleConfirm()` behavior: no longer calls `onCancel()` after `onConfirm()`. Parent (`App.jsx`) controls modal close based on mutation result.
- **Added** API error banner documentation: styled `<div>` with `bg-danger/10` background, `border-danger/30` border, `text-danger` text, rendered conditionally when `error` is truthy, positioned between message and action buttons.
- **Added** loading state documentation: both Cancel and Delete buttons receive `disabled={loading}`; Delete button shows animated spinning SVG loader (`animate-spin h-4 w-4`) and text changes from "Delete" to "Deleting..." when `loading === true`.
- **Updated** confirmation flow table: Delete now has two outcomes (succeeds → parent closes modal; fails → modal stays open with error banner).
- **Updated** visual design table: Cancel and Delete button entries now include disabled-state styling; new Error banner row added.
- **Updated** component description to reflect new error handling and loading state capabilities.

### T9 — AddServiceModal loading/error/clearError props integration
- **Added** full documentation for `AddServiceModal.jsx`: props contract (`pcId`, `pcVram`, `currentGpuUsed`, `onSave`, `onClose`, `loading`, `error`, `clearError`), three-hook internal state, two lifecycle effects (Escape listener + clearError on mount), two inner methods (`handleChange`, `handleSubmit`), `checkGpuCap` helper for VRAM overflow validation, API error banner and loading spinner documentation, and form field matrix.
- **Documented** that `AddServiceModal` follows the same pattern established in T6 (AddPcModal), T7 (EditPcModal), and T8 (DeleteConfirmModal): accepts `loading`, `error`, and `clearError` from the parent's `useCreateService` mutation hook.
- **Documented** the VRAM overflow validation: `checkGpuCap` computes `currentGpuUsed + newGpu > pcVram` and returns a per-field error on overflow.

### T10 — EditServiceModal loading/error/clearError props integration
- **Added** full documentation for `EditServiceModal.jsx`: props contract (`pcId`, `serviceIndex`, `service`, `pcVram`, `currentGpuUsed`, `onSave`, `onCancel`, `loading`, `error`, `clearError`), three-hook internal state with pre-filled `formData` from `service` prop, two computed values (`oldGpu`, `remainingVram`), two lifecycle effects (Escape listener + clearError on mount), three inner methods (`checkGpuCap`, `handleChange`, `handleSubmit`), API error banner and loading spinner documentation, form field matrix, responsive breakpoints, and accessibility features.
- **Documented** that `EditServiceModal` follows the same pattern established in T6 (AddPcModal), T7 (EditPcModal), T8 (DeleteConfirmModal), and T9 (AddServiceModal): accepts `loading`, `error`, and `clearError` from the parent's `useUpdateService` mutation hook.
- **Documented** the recalculation VRAM overflow validation: `checkGpuCap` computes `remaining = pcVram - currentGpuUsed + oldGpu` (freeing the old allocation first) and returns a per-field error when `newGpu > remaining`.
- **Updated** folder scope description to note all five modals now support `loading`/`error`/`clearError` integration.

### T11 — EditPcModal GPU list UI refactor with lazy initializer and legacy fallback
- **Replaced** the entire EditPcModal.jsx documentation section (lines 109-183 in prior version) with comprehensive coverage of the T11 refactor:
  - **Lazy state initializer**: Documented that `formData` now uses `useState(() => { ... })` (React best practice per Vercel guidelines) to compute initial GPUs exactly once on mount.
  - **Three-tier legacy fallback cascade**: Tier 1 checks `Array.isArray(pc?.gpus)` for modern schema, Tier 2 falls back to scalar `pc.vram`, Tier 3 defaults to `[{ name: 'GPU 1', vram: '' }]`. Documented with code-block showing the full cascade logic.
  - **Touch tracking change**: Updated from `{ nombre, ip, vram }` to `{ nombre, ip, gpus }` — now tracks the GPU array field instead of scalar vram.
  - **New handlers added**: `handleGpuFieldChange(idx, field, value)`, `handleAddGpu()`, `handleRemoveGpu(idx)` — identical signatures and behavior to AddPcModal (T6 parity).
  - **handleSubmit updated**: Now sends `{ _id: pc?._id, nombre, ip, gpus[] }` instead of scalar vram. Each GPU in the payload maps `{ name, vram: Number(gpu.vram) }`.
  - **JSX GPU list section**: Documented that the rendered GPU section is pixel-identical to AddPcModal (same Tailwind classes, same SVG icons, same grid layout).
  - **Parity note added**: New "Parity with AddPcModal" subsection explaining that both modals share the same GPU handler implementations, distinguishing only in state pre-filling strategy.
  - **Form layout table updated**: Replaced the old 3-field static table (nombre/ip/vram) with the new dynamic row: nombre + ip + GPU list (gpu-name-${idx} / gpu-vram-${idx}).

### T13 — EditServiceModal refactor: GPU dropdown pre-selection, cross-GPU reassignment validation
- **Complete rewrite** of the `EditServiceModal.jsx` documentation section to reflect the T13 refactor:
  - **New import**: `getRemainingVram` from `../../utils/gpuHelpers.js` is now imported (matching AddServiceModal T12).
  - **Props signature change**: Replaced legacy `{ pcVram, currentGpuUsed }` with `{ pcGpus, pcServices }`. The modal receives the full GPU array and ALL current services (including the entry being edited), then internally computes `pcServicesExSelf = pcServices.filter((_, i) => i !== serviceIndex)` for correct per-GPU capacity validation.
  - **Internal state expanded**: `formData` now includes `assignedGpu: String(service?.assignedGpu ?? '0')` — pre-selects the current GPU assignment on mount. `touched` tracking now covers four fields: `{ nombre, puerto, gpu, assignedGpu }`.
  - **Legacy computed values removed**: `oldGpu` and `remainingVram` are replaced by `pcServicesExSelf` which provides accurate per-GPU remaining VRAM for both same-GPU edits and cross-GPU reassignments.
  - **`checkGpuCap` deleted**: Per-GPU capacity validation is now handled entirely by the shared `validateServiceForm(data, pcServicesExSelf, pcGpus)` with its 3-argument signature (same as AddServiceModal). No more two-call pattern.
  - **handleChange updated**: Now handles four form inputs including the GPU selector dropdown. Calls `validateServiceForm(updatedData, pcServicesExSelf, pcGpus)` with three arguments — single-call validation replaces old `validateServiceForm` + `checkGpuCap` merge.
  - **handleSubmit updated**: Marks all four fields as touched on submit. Payload now includes `assignedGpu: Number(formData.assignedGpu)` for backend schema compliance. Shape: `{ pcId, index, nombre, puerto, gpu, assignedGpu }`.
  - **GPU Selector Dropdown**: New section between "Port" and "GPU VRAM (GB)". Renders `<select id="assignedGpu">` with options generated via `.map()` on `pcGpus`, each labeled `{gpu.name} — {remain} GB free` where remaining is computed via `getRemainingVram(pcGpus, pcServicesExSelf, idx)`. Pre-selected to the service's current `assignedGpu`. Empty guard shows "No GPUs available" message.
  - **Validation rules updated**: Table now has four rows including `assignedGpu` and per-GPU overflow check via `getRemainingVram`. Example messages match AddServiceModal (T12) for parity.
  - **Form layout table expanded**: Four controls documented: nombre + puerto + assignedGpu dropdown (NEW) + gpu VRAM field.
  - **Accessibility features extended**: Now covers four controls including the new `assignedGpu` select; error description link references `assignedGpu-error`.
  - **Remaining VRAM indicator updated**: Replaced aggregate hint with per-selected-GPU hint using inline IIFE in JSX, showing `{N} GB remaining on {gpuName}`. Uses `pcServicesExSelf` for accurate capacity computation.
  - **Parity confirmed**: EditServiceModal now mirrors AddServiceModal's T12 architecture: same 3-arg validator signature, same `getRemainingVram` helper, same GPU dropdown pattern, with the key distinction being that `pcServicesExSelf` excludes the edited entry for correct validation.
