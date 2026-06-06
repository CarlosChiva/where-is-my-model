# Phase 4 — Frontend Components

> Path: frontend/src/components/ + frontend/src/App.jsx
> Last updated: 2026-06-06
> Type: Component documentation

This document covers the eight React components that constitute Phase 4 of the "Where Is My Model" GPU dashboard. Phase 4 represents the migration from vanilla HTML/CSS/JS to a componentized React + Vite + Tailwind CSS architecture. All components follow a **presentational pattern** — they receive data and callbacks as props, contain no data-fetching logic themselves, and delegate all business operations back to the root `App.jsx`.

---

## Component Composition Diagram

```
App.jsx (root — owns state, API calls, modal routing)
│
├── Header.jsx                          ← receives pcs[] for summary stats; callbacks bubble up via props
│     ├── onAddPc  → opens "addPc" modal (Phase 5 stubs)
│     ├── onSave   → no-op callback (Header handles export internally)
│     └── handleExport () → serializes pcs[] to timestamped JSON file download (Blob + createObjectURL)
│
└── PCGrid.jsx                          ← receives pcs[], loading flag, all CRUD callbacks
      │
      ├── [loading && empty states]      ← conditionally rendered placeholders
      │
      └── PCCard.jsx  (one per PC in pcs[])
            │     styled with stagger-delay via index prop
            │
            ├── ServiceRow.jsx    (one per service in pc.servicios[])
            │     │
            │     └── GPUBar.jsx          ← visualizes per-service VRAM usage
            │
            ├── GPUDetails.jsx    ← aggregate VRAM bar for the whole PC
            │
            └── [3 action buttons]  ← edit PC / add service / delete PC
```

---

## Data Flow Overview

### Top-down: State → Props

| Layer | What flows down | Carried by |
|-------|----------------|------------|
| `App.jsx` → children | `pcs[]` array, `loading` boolean | Direct props on `<Header>` and `<PCGrid>` |
| `App.jsx` → `PCGrid.jsx` | Six callback handlers (`onEditPc`, `onAddService`, `onDeletePc`, `onEditService`, `onDeleteService`, plus implicit passthrough) | Props |
| `PCGrid.jsx` → `PCCard.jsx` | Single `pc` object, `index` for animation stagger, all six callbacks (unchanged — prop drilling through one level) | Props per `<PCCard>` instance |
| `PCCard.jsx` → `ServiceRow.jsx` | Individual `service` object, parent `vramGb`, parent `pcId`, service index, `onEditService`, `onDeleteService` | Props per `<ServiceRow>` instance |
| `PCCard.jsx` → `GPUDetails.jsx` | Computed `totalGpuGb` (sum of services' GPU), parent's `vramGb` | Props |
| `_ServiceRow_` → `GPUBar.jsx` | Service-level `gpu` (VRAM in GB), parent's `vramGb` | Props |

### Bottom-up: Events → State Updates

All user-initiated actions propagate upward through callback props. The root `App.jsx` is the sole component with `useState` and `useEffect`. Actions follow a uniform pattern:

1. User clicks an action button anywhere in the tree
2. A callback fires, passing context (`pcId`, `index`, payloads) to `App.jsx`
3. `App.jsx` either (a) opens a modal via `setModalState({ type, payload })` or (b) directly calls the API layer to persist changes
4. On successful mutation, the entire `pcs[]` list is **refetched** from the backend (not optimistically updated), ensuring server-to-client consistency

```
User clicks ──▶ onClick on deepest component
                 │
                 ▼
             callback prop bubbles through ~2 levels
                 │
                 ▼
         App.jsx handler
                 │
                 ├── setModalState()       (opens Phase-5 modal)
                 │
                 └── API call (createPc, updatePc, deletePc, deleteService)
                           │
                           ▼
                     fetchPcs() refetch ──▶ setPcs(refreshed data)
                                              │
                                              ▼
                                         React re-renders entire tree with new pcs[]
```

**Design rationale**: The team chose full refetch over optimistic updates because the dashboard is a low-frequency CRUD application — server round-trips are acceptable, and this eliminates stale-client / race-condition bugs entirely.

---

## Component Reference

### T014 — `Header.jsx`

> **File:** `frontend/src/components/Header.jsx`
>
> Pure presentational component. Renders the page title, live summary statistics, and two primary action buttons.

#### What it does

Displays a responsive header at the top of the dashboard. Computes server count (length of `pcs`) and total service count (sum of all `pc.servicios.length`). Provides "Add PC" (accent-colored primary button) and "Export JSON" (secondary bordered button that serializes the entire `pcs` data array to a timestamped JSON file download).

#### Props interface

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `pcs` | `Array<PC>` | Yes | Full array of server objects; used to compute summary counts and as the export payload |
| `onAddPc` | `() => void` | Yes | Callback fired when "Add PC" button is clicked |
| `onSave` | `() => void` | Yes | Callback fired after the JSON export completes, for backward compatibility (currently a no-op in App) |

#### Internal state

**None.** This component uses no hooks. It derives `serverCount` and `serviceCount` directly from props at render time — both are recomputed on every re-render of the parent, which is acceptable since array traversal over these arrays is negligible for dashboard-scale data.

#### Internal functions

- **`handleExport() → void`**
  Serializes the `pcs` array to a formatted JSON string (`JSON.stringify(pcs, null, 2)`), wraps it in a `Blob` with MIME type `application/json`, creates an object URL via `URL.createObjectURL(blob)`, generates a download link with a timestamped filename (`gpu-infra-{ISO-timestamp}.json`), programmatically clicks the link to trigger the browser download, then cleans up the DOM anchor and revokes the object URL. After the export, invokes `onSave()` if it is a function (backward compatibility).

#### Structure / JSX tree

```
header (flex flex-col md:flex-row)
├── div (title column)
│   ├── h1: "Where Is My Model"
│   └── span [aria-live="polite"]: "{serverCount} servers, {serviceCount} services"
└── div (actions row)
    ├── button: Add PC  (+ inline SVG "plus" icon)
    └── button: Export JSON  (+ inline SVG "download" icon)
```

#### Styling approach

- **Layout:** `flex flex-col md:flex-row items-center justify-between` — stacks vertically on mobile, single row on >=768px.
- **Title:** `text-2xl md:text-3xl font-bold tracking-tight text-text-primary` — scaling type with breathing room.
- **Add PC button:** Accent primary pattern — `bg-accent text-bg-primary` (teal fill, dark text), with hover state and `shadow-btn-primary`.
- **Export JSON button:** Secondary bordered pattern — `border border-border text-text-secondary` with neutral colors; no fill so it does not compete visually with Add PC. Hover changes text color to `text-text-primary`.

#### Accessibility features

- `aria-live="polite"` on the summary stat span ensures screen readers announce count changes without interrupting focus.
- Both SVG icons (plus for Add PC, download arrow for Export JSON) have `aria-hidden="true"` — purely decorative.
- Both buttons use `type="button"` to prevent accidental form submission.

#### Design decisions

- **No `key` usage on buttons:** Buttons are not dynamically generated from arrays; they are static. No reconciliation needed.
- **Summary stats as derived values:** Counts are computed inline rather than passed as props, keeping `App.jsx` thin. This avoids duplicating data at two levels of the tree.
- **Export handled internally:** The `handleExport` function lives inside `Header` rather than in `App.jsx`. This keeps the export logic co-located with its trigger (the Export JSON button) and avoids an additional callback prop in the chain. The `onSave` callback is still fired for backward compatibility, allowing `App.jsx` to react to the export event if needed in the future.
- **Native browser download:** Uses `Blob` + `URL.createObjectURL` + programmatic anchor click instead of a backend endpoint. This is zero-server-overhead, works offline, and provides immediate feedback to the user.

---

### T015 — `GPUBar.jsx`

> **File:** `frontend/src/components/GPUBar.jsx`
>
> Reusable animated GPU usage progress bar. Used per-service within `ServiceRow`.

#### What it does

Accepts a service's current GPU VRAM usage (`gpuGb`) and the parent PC's total VRAM capacity (`vramGb`). Computes the utilization percentage, clamps it to [0, 100], selects a color tier (green / yellow / red), and renders an animated horizontal progress bar. Adds a pulsing warning glow when utilization exceeds 80%.

#### Props interface

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `gpuGb` | `number` | Yes | — | Current VRAM consumed by this service (in GB) |
| `vramGb` | `number` | Yes | — | Parent PC's total VRAM capacity (in GB). Used as denominator for percentage calculation |

No default values are defined. If `gpuGb` or `vramGb` is `undefined`, the component will receive `NaN` from division — however, the parent components (`ServiceRow`, `PCCard`) consistently pass fallback values (e.g., `?? 0`).

#### Internal state

**None.** No hooks. All computation is synchronous and deterministic given props.

Key derived values:
- `percent`: `(gpuGb / vramGb) * 100`, clamped via the imported `clamp()` utility, or `0` if `vramGb === 0`.
- `colorClass`: returned from `getGpuColorClass(percent)` utility.
- `isWarning`: boolean — `percent > 80`.

#### Structure / JSX tree

```
div (container: relative, h-2.5, rounded track)
└── div [role="progressbar"] (fill: absolute, animated)
      styled via CSS custom property --gpu-target-width
```

#### Styling approach

| Aspect | Implementation |
|--------|---------------|
| Track | `bg-bg-input` (#1e2a3a) — dark input background; `h-2.5` for compact height; `rounded-full overflow-hidden` |
| Fill colors | Delegated to `getGpuColorClass()` → `bg-gpu-green` / `bg-gpu-yellow` / `bg-gpu-red` |
| Animation entry | `animate-gpu-fill` — keyframe animates `width` from `0%` to `var(--gpu-target-width)` over 0.6s with custom easing |
| Warning pulse | `animate-gpu-warning` — infinite `boxShadow` pulse in red when `isWarning` is true; layered on top of the fill animation |

The animation uses a **CSS custom property** (`--gpu-target-width`) to set the target width dynamically, avoiding inline style recalculation on every animation frame. The CSS keyframe reads this variable:

```css
gpuBarFill {
  from: { width: '0%' };
  to:   { width: 'var(--gpu-target-width, 100%)' };
}
```

#### Accessibility features

- `role="progressbar"` identifies the fill rectangle as a visual progress indicator.
- `aria-valuenow` (rounded integer), `aria-valuemin="0"`, `aria-valuemax="100"` provide semantic range information to assistive technologies.

#### Utility dependencies

| Import | Source | Purpose |
|--------|--------|---------|
| `clamp` | `../utils/gpuHelpers` | Restricts percentage to [0, 100]; handles `NaN` input gracefully (returns min) |
| `getGpuColorClass` | `../utils/gpuHelpers` | Maps numeric percentage → Tailwind class name using three-tier thresholds |

#### Design decisions

- **Animation via CSS custom properties rather than React state:** Instead of using a `useEffect` + setInterval to gradually animate the width value, the component leverages a native CSS animation that reads `--gpu-target-width`. This is both more performant (compositor-only) and simpler (no additional state management).
- **No `<progress>` HTML element:** The custom fill div with `role="progressbar"` gives full control over visual styling while maintaining accessibility. A native `<progress>` would be harder to theme consistently in the dark palette.

---

### T016 — `GPUDetails.jsx`

> **File:** `frontend/src/components/GPUDetails.jsx`
>
> Aggregate "TOTAL GPU" bar displayed at the bottom of each PC card. Mirrors GPUBar's logic but adds human-readable readout and wider dimensions.

#### What it does

Displays an aggregate VRAM usage summary for an entire server. Shows a numeric readout (e.g., "16.5 / 80 GB (21%)") alongside a wider progress bar with the same color-tier and warning-pulse logic as GPUBar.

#### Props interface

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `totalGpuGb` | `number` | No | `0` | Sum of all services' GPU VRAM on this PC |
| `vramGb` | `number` | No | `0` | Parent PC's total VRAM capacity (in GB) |

Both props have explicit default values in the destructuring signature: `{ totalGpuGb = 0, vramGb = 0 }`. This ensures the component renders gracefully even when called without props or with `undefined` values.

#### Internal state

**None.** No hooks. All computation is synchronous. Key derived values mirror GPUBar's logic but are **inline rather than delegated to utilities**:

- `rawPercent`: `(totalGpuGb / vramGb) * 100`, or `0` when `vramGb === 0`. Used for display (allows values > 100% if services over-allocate VRAM).
- `percent`: `clamp(rawPercent, 0, 100)` — used for bar width and color selection.
- `colorClass`: inline ternary chain (same thresholds as GPUBar: <=35 green, 36–70 yellow, >70 red).
- `isWarning`: `percent > 80`.

#### Structure / JSX tree

```
div (mt-4 pt-4 border-t) — section separator within card
├── div (flex justify-between mb-2) — header row
│   ├── span: "TOTAL GPU" label (uppercase, tracking-wider)
│   └── span: readout "X.X / Y GB (Z%)" (font-mono)
└── div (bar container: h-4, rounded-full)
      └── div [role="progressbar"] — animated fill bar
```

#### Styling approach

| Aspect | GPUBar | GPUDetails | Rationale |
|--------|--------|------------|-----------|
| Bar height | `h-2.5` (10px) | `h-4` (16px) | Aggregate bar is more prominent — warrants greater visual weight |
| Readout | None | "X.X / Y GB (Z%)" in mono font | Aggregate usage benefits from explicit numbers; per-service bars rely on quick color scanning |
| Label | None | "TOTAL GPU" uppercase badge | Differentiates aggregate from individual service bars |
| Animation target width | `--gpu-target-width` CSS variable only | Both `--gpu-target-width` **and** explicit `width: '0%'` inline | The inline `style={{ '--gpu-target-width': ...%, width: '0%' }}` pattern is critical: the keyframe sets final width via the CSS variable, while `width: 0%` initializes to empty before animation kicks in. GPUBar relies less on this because it has no explicit initial width style — its container overflow handles it |
| Separator | None | `border-t border-border pt-4 mt-4` | Visually separates GPU summary from the services list above |

#### Accessibility features

Same as GPUBar: `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`. Note that `aria-valuenow` receives `percent` (clamped) rather than `rawPercent`, so users always hear a value within the 0–100 range.

#### Design decisions

- **Inline color logic vs. utility import:** GPUDetails duplicates the color-tier logic inline instead of importing `getGpuColorClass`. This appears to be an oversight — both functions could share the utility. The thresholds match exactly, making this a safe refactoring target for Phase 7 (cleanup).
- **Default values in destructuring:** Provides self-documenting signatures and prevents NaN rendering if props are accidentally omitted.

---

### T017 — `ServiceRow.jsx`

> **File:** `frontend/src/components/ServiceRow.jsx`
>
> Single-column row displaying one AI service: name, port badge, GPU usage bar, edit/delete icon buttons.

#### What it does

Renders a horizontal row for one service belonging to a server. Displays the service name (truncated with CSS), port number in a mono badge, an embedded GPUBar showing VRAM usage, and two action icon buttons (edit pencil / delete X). Rows are separated by a bottom border that drops on the last item via `last:border-b-0`.

#### Props interface

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `service` | `ServiceObject` | Yes | Shape: `{ nombre: string, puerto: number\|string, gpu: number }` |
| `vramGb` | `number` | Yes | Parent PC's total VRAM — forwarded to GPUBar as denominator |
| `index` | `number` | Yes | Service index within parent's service array; used to construct `{ pcId, index }` for callbacks |
| `pcId` | `string` | Yes | MongoDB ObjectId of the parent server |
| `onEdit` | `(context: { pcId, index }) => void` | Yes | Callback for the edit (pencil) button — opens EditServiceModal (Phase 5) |
| `onDelete` | `(context: { pcId, index }) => void` | Yes | Callback for the delete (X) button — opens DeleteConfirmModal (Phase 5) |

#### Internal state

**None.** No hooks. Destructures `service` at render time: `{ nombre, puerto, gpu }`.

#### Structure / JSX tree

```
div (flex row, border-b separator)
├── div (left: service name + port badge)
│   ├── span (truncate): service.name
│   └── span (mono badge): service.port
│
├── div (center: GPU bar — w-24 fixed width)
│   └── GPUBar gpuGb={gpu} vramGb={vramGb}
│
└── div (right: action buttons)
    ├── button [aria-label="Edit service {nombre}"]: edit SVG icon
    └── button [aria-label="Delete service {nombre}"]: delete SVG icon
```

#### Styling approach

- **Three-zone layout:** Left (flexible, name + port), center (fixed `w-24` for the GPU bar), right (shrink-to-fit icon buttons). Uses `shrink-0` on center and right zones to prevent them from collapsing.
- **Name truncation:** `truncate` class applies `text-overflow: ellipsis` — prevents long service names from overflowing the card.
- **Port badge:** `font-mono text-sm bg-bg-input px-2 py-0.5 rounded` — compact, machine-readable styling for port numbers.
- **Icon buttons:** `p-1.5 rounded` with hover color transitions (`accent` for edit, `danger` for delete). Uses duration-200 transition for snappy feedback.

#### Accessibility features

- Both icon buttons have dynamic `aria-label` attributes incorporating the service name: \`aria-label={`Edit service ${nome}`}\`. This disambiguates icon-only buttons where visual text is absent.
- SVG icons have no explicit `aria-hidden` — however, they are inside button elements with accessible labels, so screen readers will announce the button label rather than trying to interpret the SVG path data directly.

#### Imports

| Import | Source | Type | Purpose |
|--------|--------|------|---------|
| `GPUBar` | `./GPUBar` | Internal | Renders VRAM usage visualization inline |

#### Design decisions

- **Index-based identity rather than service `_id`:** Services are addressed by their index within the parent PC's services array, not by a unique identifier. This matches the backend API contract where services are array-indexed (`PUT /pcs/:id/services/:index`). It trades some resilience (array mutations shift indices) for direct compatibility with the Express + Mongoose document model.
- **No `key` prop on SVGs:** Icon SVGs are inline, not keyed — they never update or reorder.

---

### T018 — `PCCard.jsx`

> **File:** `frontend/src/components/PCCard.jsx`
>
> Card component representing one GPU server. Composes ServiceRow and GPUDetails. Includes hover interactions, stagger animation, and three action buttons.

#### What it does

The primary dashboard widget. Shows a server's name, IP address badge, running service count, a list of services (each with its own GPU bar), an aggregate GPU summary bar, and three action buttons (Edit PC / Add Service / Delete PC). Cards enter the grid with a slide-up stagger animation based on their index within the full servers array.

#### Props interface

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `pc` | `PCObject` | Yes | Shape: `{ _id: string, nombre: string, ip: string, vram: number, servicios: ServiceObject[] }` |
| `index` | `number` | Yes | Position in the full pcs array; used for stagger animation delay (`index * 100ms`) |
| `onEditPc` | `(pc) => void` | Yes | Callback when "Edit PC" is clicked — opens EditPcModal (Phase 5) |
| `onAddService` | `({ pcId, vram, currentGpuUsed }) => void` | Yes | Callback when "Add Service" is clicked — opens AddServiceModal with context |
| `onDeletePc` | `({ pcId, nombre }) => void` | Yes | Callback when "Delete PC" is clicked — opens DeleteConfirmModal (Phase 5) |
| `onEditService` | `(context) => void` | Yes | Passthrough to ServiceRow's edit button |
| `onDeleteService` | `(context) => void` | Yes | Passthrough to ServiceRow's delete button |

#### Internal state

**None.** No hooks. Derives:
- `services`: safe fallback via `pc?.servicios ?? []`.
- `currentGpuUsed`: `services.reduce((sum, s) => sum + (s.gpu ?? 0), 0)` — total VRAM consumed by all services on this server.

#### Structure / JSX tree

```
div (card container: bg-card, rounded-lg, shadow, hover-lift, animate-card-enter)
│   data-pc-id={pc._id}
│   style={{ animationDelay: index * 100ms }}
│
├── div (header row: border-bottom)
│   ├── h2: server name
│   └── span: IP address badge (mono)
│
├── div (service count: "N service(s) running")
│
├── div (services list area — px-4 py-2)
│   └── ServiceRow[]  (mapped over pc.servicios, keyed by index)
│
├── div (aggregate GPU section)
│   └── GPUDetails totalGpuGb={currentGpuUsed} vramGb={pc.vram}
│
└── div (action buttons: border-top separator)
    ├── button: "✏ Edit PC"       — primary accent style, flex-1
    ├── button: "+ Add Service"   — outlined accent style, flex-1
    └── button: "✕ Delete PC"     — outlined danger style, flex-1
```

#### Styling approach

| Feature | Implementation | Detail |
|---------|---------------|--------|
| Card appearance | `bg-bg-card rounded-lg shadow-card border border-border` | Dark card on slightly darker background with subtle top-lit shadow |
| Hover interaction | `hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300` | Lifts card 4px and adds a teal-tinted glow shadow; smooth 300ms transition |
| Entry animation | `animate-card-enter` with staggered delay | Slide-up from 24px below with fade-in; each subsequent card delayed by 100ms (`index * 100`) |
| Section separation | `border-b` after header, `border-t` before actions and GPUDetails | Clear visual hierarchy without excessive spacing |
| Action buttons | Three distinct styles using Tailwind's color system | Edit: solid accent. Add Service: outlined accent (ghost variant). Delete: outlined danger — creates a clear affordance hierarchy |

#### Animation details

The stagger animation is accomplished via inline `style={{ animationDelay: \`${index * 100}ms\` }}`. Combined with the CSS keyframe:

```css
cardSlideInUp {
  from: { opacity: '0', transform: 'translateY(24px)' };
  to:   { opacity: '1', transform: 'translateY(0)' };
}
```

The Tailwind config applies this with `both` fill mode, meaning the card starts invisible and at translated position before the animation begins. The stagger delay produces a cascading entrance effect across multiple cards.

#### Accessibility features

- All three action buttons have dynamic `aria-label` attributes incorporating the server name (e.g., \`aria-label={`Edit server ${pc.nombre}`}\`).
- Card container includes `data-pc-id={pc._id}` for external tooling / debugging.
- Server name is wrapped in an `<h2>` heading, providing document outline structure.

#### Imports

| Import | Source | Type | Purpose |
|--------|--------|------|---------|
| `ServiceRow` | `./ServiceRow` | Internal | Renders each service as a row within the card |
| `GPUDetails` | `./GPUDetails` | Internal | Renders aggregate GPU usage at the bottom of the card |

#### Design decisions

- **Optimistic rendering without data fetch:** The PC object arrives fully populated with its services array from the backend (`GET /pcs` returns embedded services). There is no nested data fetching — a single API call hydrates the entire component tree.
- **Null-safe property access throughout:** Every `pc.nombre`, `pc.ip`, `pc.vram`, etc., uses optional chaining with fallbacks (`pc?.nombre ?? ''`). This guards against partial data during transitions or backend schema changes.
- **Characters in button labels:** The action buttons use Unicode symbols for brevity — a trade-off that slightly reduces visual polish but improves scanability across cards.

---

### T021 — `ModelFormSection.jsx`

> **File:** `frontend/src/components/GpuCalculator/ModelFormSection.jsx`
>
> Controlled, stateless form section for the GPU Calculator feature. Renders five number inputs for transformer model architecture parameters using the same Tailwind styling tokens as the Phase 5 modal dialogs. This component marks the beginning of the GPU Calculator module (a feature separate from the Phase 4 dashboard view/editing flow).

#### What it does

Part of the **GPU Calculator** — a dedicated tool that estimates VRAM requirements for running transformer models on GPU hardware. `ModelFormSection` renders the "Model" configuration section (`<section>`) containing five `<input type="number">` fields: number of hidden layers, key/value heads, head dimension, hidden size, and parameter count.

The component is fully controlled: all values are received via the `values` prop object, and changes propagate upward through the `onChange(fieldName, rawValue)` callback. Validation is inline and per-field — each input shows a red error message when the entered value is non-positive (≤ 0), and displays a contextual hint text when valid (or empty).

#### Props interface

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `values` | `Object` | Yes | `{}` | Object keyed by field ID, holding current input values. Expected keys: `num_hidden_layers`, `num_key_value_heads`, `head_dim`, `hidden_size`, `num_parameters` |
| `onChange` | `(fieldName: string, rawValue: string) => void` | Yes | — | Callback invoked on every keystroke in any field. Receives the field ID (string) and the raw input value (string). Parent is responsible for coercion, validation accumulation, and state storage |

`values` defaults to an empty object `{}`, ensuring that a completely unconfigured parent still renders functional (empty) inputs rather than crashing on `values[id]` access.

#### Field definitions

| Field ID | Label | Placeholder | Hint text | Example value |
|----------|-------|-------------|-----------|---------------|
| `num_hidden_layers` | Num Hidden Layers | `32` | Transformer depth (e.g., 32 for Llama-3 8B) | 32 |
| `num_key_value_heads` | Num Key / Value Heads | `8` | GQA/MQA heads count (e.g., 8) | 8 |
| `head_dim` | Head Dim | `128` | Dimension per KV head (e.g., 128) | 128 |
| `hidden_size` | Hidden Size | `4096` | Total hidden dimension (e.g., 4096) | 4096 |
| `num_parameters` | Num Parameters | `7000000000` | Total trainable parameters (e.g., 7000000000 for a 7B model) | 7,000,000,000 |

All fields share these HTML attributes:
- `type="number"` with `min="0"` and `step="any"` — accepts non-negative integers or decimals.
- `value={values[id] ?? ''}` — displays the value from the `values` object if present; otherwise shows an empty string (HTML5 number input treats empty string as "no value entered", distinct from `0`).

#### Internal state

**None.** No hooks (`useState`, `useEffect`, etc.). All rendering is deterministic and synchronous given props. The component derives:

- **`fields`** — A static array of five field configuration objects (defined once per render, no memoisation).
- **`inputCls`** — A computed CSS class string for the shared input styling (reused across all five fields).
- **`value`** — Per-field current value: `values[id] ?? ''`.
- **`isInvalid`** — Per-field validation flag: `value !== '' && value !== undefined && Number(value) <= 0`. This means:
  - Empty input → valid (no error shown; hint is visible).
  - Positive number → valid (no error shown; hint is visible).
  - Zero or negative number → invalid (error message replaces hint text).

#### Validation behavior

| State | Border color | Error message | Hint text |
|-------|-------------|---------------|-----------|
| Empty (`''`) | Default (`border-border` from input classes) | Hidden | Shown in muted text |
| Positive number | Default | Hidden | Shown in muted text |
| Zero or negative | `border-danger` (red) | "Must be a positive number." (shown in danger color) | Hidden |

The validation is **inline and immediate** — it triggers on every re-render when the parent passes updated values, not only on blur or submit. This matches the UX pattern established by the Phase 5 modal dialogs (AddPcModal, EditServiceModal).

#### Structure / JSX tree

```
section
├── h2: "📐 Modelo" (text-lg, font-bold, mb-4)
│
└── div[] (one per field, mapped from fields array)
    ├── label [htmlFor={id}]: Field label (uppercase, mono, muted)
    │
    ├── input[type="number"]
    │     id={id}
    │     value={values[id] ?? ''}
    │     placeholder={placeholder}
    │     min="0", step="any"
    │     aria-invalid={isInvalid}
    │     className={inputCls + (isInvalid ? ' border-danger' : '')}
    │     onChange={(e) => onChange(id, e.target.value)}
    │
    ├── [IF isInvalid]
    │   └── p: "Must be a positive number." (text-danger, id="{$id}-error")
    │
    └── [IF !isInvalid && hint]
          └── p: contextual hint text (text-xs, text-text-muted)
```

#### Styling approach

| Element | Tokens / Classes | Notes |
|---------|-----------------|-------|
| Section heading (`h2`) | `text-lg font-bold text-text-primary mb-4` | Preceded by a 📐 emoji icon; separates the Model section from other calculator sections (Hardware, Results) that would follow in the same parent form |
| Labels | `block text-xs font-mono uppercase tracking-wide text-text-muted mb-1.5` | Consistent with modal field labels (AddPcModal, EditServiceModal): small, monospace, uppercase, muted color for visual hierarchy |
| Inputs | `inputCls` — compound class string (see table below) | Mirrors Phase 5 modal input styling exactly to maintain cross-feature consistency |
| Error message | `mt-1 text-sm text-danger` | Red text (`danger` token: `#ff6b6b`) directly below the offending input |
| Hint text | `mt-1 text-xs text-text-muted` | Small muted text providing field context and example values |

**Shared input class string (`inputCls`):**

```
w-full
bg-bg-input
border border-border
rounded-sm
px-3.5 py-2.5
font-mono text-base
text-text-primary
outline-none
transition-colors
focus:border-accent
focus:ring-[0_0_0_3px] focus:ring-accent-dim
placeholder:text-text-muted
```

When `isInvalid` is true, `border-danger` is appended (overrides the default `border-border`).

This styling is intentionally identical to the input fields in AddPcModal and EditServiceModal — the same Tailwind custom tokens (`bg-bg-input`, `border-border`, `text-text-primary`, `accent`, `danger`, etc.) are reused to ensure a unified visual language across the application.

#### Accessibility features

- Each `<input>` has a corresponding `<label>` linked via `htmlFor={id}` / `id={id}`, ensuring screen readers announce the field purpose when the input receives focus.
- `aria-invalid={isInvalid}` on each input dynamically communicates validation state to assistive technologies. When `true`, screen readers announce that the field contains an error.
- Error messages have their own semantic `<p>` element with a stable ID (`${id}-error`) for potential future linkage via `aria-describedby`.
- Input types are `number` with `min="0"` — provides built-in accessibility semantics about expected input range.

#### Design decisions

- **Stateless component (no local state):** All data flows through props. The parent GPU Calculator page (not yet implemented) accumulates values in a single object and re-renders this section on every keystroke. This keeps the component trivially testable — given any `values` object, output is fully deterministic.
- **Inline validation (no Zod/Yup/React Hook Form):** Validation logic lives inside the render function as simple boolean checks. For five fields with uniform rules ("must be positive when non-empty"), a full form library would add unnecessary overhead and complexity. If the GPU Calculator grows to 20+ fields with cross-field validation, this pattern would warrant re-evaluation.
- **String values, not coerced numbers:** `onChange` fires with `(fieldName, rawValue)` where `rawValue` is always a string (`e.target.value`). The parent decides when and how to coerce — typically via `Number(value)` before passing it to the VRAM estimation formula. This avoids losing empty-input state (coercing `''` → `0` would be incorrect).
- **Hint text as fallback UX:** Each field shows example values ("32 for Llama-3 8B", "7000000000 for a 7B model") below the input. This reduces the cognitive burden on users unfamiliar with transformer architecture terminology (GQA, head dimensions, etc.).
- **Emoji in section heading (`📐`):** Provides an at-a-glance visual anchor that matches the informal, developer-facing tone of the dashboard UI. Other sections of the GPU Calculator form are expected to follow this convention (e.g., `🖥️ Hardware`, `📊 Results`).

---

### T022 — `PrecisionFormSection.jsx`

> **File:** `frontend/src/components/GpuCalculator/PrecisionFormSection.jsx`
>
> Controlled, stateless form section for the GPU Calculator feature. Renders two `<select>` dropdowns for model dtype precision and KV-cache dtype precision using the same Tailwind styling tokens as ModelFormSection and the Phase 5 modal dialogs. This is the second component in the GPU Calculator module.

#### What it does

Part of the **GPU Calculator** — a dedicated tool that estimates VRAM requirements for running transformer models on GPU hardware. `PrecisionFormSection` renders the "Precision / Quantization" configuration section (`<section>`) containing two `<select>` dropdowns: one for model precision (bytes per parameter) and one for KV-cache precision (bytes per token in the cache).

The component is fully controlled: all values are received via the `values` prop object, and changes propagate upward through the `onChange(fieldName, value)` callback. Unlike ModelFormSection's number inputs, this component uses native `<select>` elements — no validation errors are possible because every option is inherently a valid positive numeric string.

#### Props interface

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `values` | `Object` | Yes | `{}` | Object keyed by field ID, holding current select values. Expected keys: `dtype_bytes`, `kv_cache_dtype_bytes` |
| `onChange` | `(fieldName: string, value: string) => void` | Yes | — | Callback invoked on every selection change. Receives the field ID (string) and the selected option value (string). Parent is responsible for coercion, state storage, and feeding values back |

`values` defaults to an empty object `{}`, ensuring that a completely unconfigured parent still renders functional selects with the default option selected rather than crashing on `values[id]` access.

#### Field definitions

| Field ID | Label (rendered) | Default value | Meaning of default |
|----------|------------------|---------------|-------------------|
| `dtype_bytes` | "Precision del modelo (dtype_bytes)" | `'2'` (bfloat16/float16) | Most modern training/inference uses half-precision by default; full precision (float32) is rarely needed for inference-only workloads |
| `kv_cache_dtype_bytes` | "Precision del KV cache (kv_cache_dtype_bytes)" | `'2'` (bfloat16/float16) | KV cache at half-precision provides the best VRAM/performance tradeoff; int8 or int4 are extreme quantization choices that degrade quality |

#### Precision options (shared across both selects)

Both dropdowns render the same four options, providing a graduated scale of precision to VRAM-memory savings:

| Option label | Stored value (`option.value`) | Bytes per unit |
|-------------|------------------------------|----------------|
| "float32 (4 bytes)" | `'4'` | 4 (full precision) |
| "bfloat16/float16 (2 bytes)" | `'2'` | 2 (half precision — default selection) |
| "int8 (1 byte)" | `'1'` | 1 (8-bit integer quantization) |
| "int4 (0.5 bytes)" | `'0.5'` | 0.5 (aggressive 4-bit quantization; 2 parameters per byte) |

The value for `values[id] ?? defaultValue` pattern means that if the parent does not provide a value for a key, the select displays the option with value `'2'` (bfloat16/float16). This ensures out-of-box correctness — even a zero-initialized form shows a sensible default.

#### Internal state

**None.** No hooks (`useState`, `useEffect`, etc.). All rendering is deterministic and synchronous given props. The component derives:

- **`precisionOptions`** — A static array of four option objects (defined once per render, no memoization).
- **`fields`** — A static array of two field configuration objects (defined once per render, no memoization).
- **`selectCls`** — A computed CSS class string for the shared select styling (reused across both dropdowns).
- **`value`** — Per-field current value: `values[id] ?? defaultValue` where `defaultValue` is always `'2'`.

#### Validation behavior

| Aspect | Implementation | Notes |
|--------|---------------|-------|
| Input element | `<select>` with discrete options | No free-text entry — user cannot enter an invalid value |
| Error messages | None | Every possible selection is a valid positive numeric string |
| Defaults on missing props | `'2'` (bfloat16/float16) | Chosen because half-precision is the modern default for both model weights and KV cache in most inference frameworks (vLLM, TensorRT-LLM, llama.cpp) |

Contrast with `ModelFormSection` (T021): that component uses `<input type="number">` fields which accept arbitrary text and therefore require inline validation. `PrecisionFormSection` avoids this complexity entirely by constraining user input to a fixed set of pre-approved options via `<select>`.

#### Structure / JSX tree

```
Fragment
└── section
    ├── h2: "🔢 Precisión y cuantización" (text-lg, font-bold, text-text-primary, mb-4)
    │
    └── div[] (one per field, mapped from fields array — key={id})
        ├── label [htmlFor={id}]: Field label in Spanish (uppercase, mono, muted)
        │
        └── select
              id={id}
              value={value}
              onChange={(e) → onChange(id, e.target.value)}
              className={selectCls}
              ├── option: float32 (4 bytes)       — value="4"
              ├── option: bfloat16/float16 (2 bytes) — value="2"
              ├── option: int8 (1 byte)          — value="1"
              └── option: int4 (0.5 bytes)       — value="0.5"
```

#### Styling approach

| Element | Tokens / Classes | Notes |
|---------|-----------------|-------|
| Section heading (`h2`) | `text-lg font-bold text-text-primary mb-4` | Preceded by a 🔢 emoji icon; separates the Precision section from other calculator sections (Model, Hardware, Results) in the same parent form |
| Labels | `block text-xs font-mono uppercase tracking-wide text-text-muted mb-1.5` | Identical to ModelFormSection label styling — ensures visual parity across all GPU Calculator sections |
| Selects | `selectCls` — compound class string (see table below) | Mirrors the input field styling from both ModelFormSection and Phase 5 modals |

**Shared select class string (`selectCls`):**

```
w-full
bg-bg-input
border border-border
rounded-sm
px-3.5 py-2.5
font-mono text-base
text-text-primary
outline-none
transition-colors
focus:border-accent
focus:ring-[0_0_0_3px] focus:ring-accent-dim
appearance-none
```

The `appearance-none` class strips the browser's native select arrow, providing a clean custom look. The spacing (`px-3.5 py-2.5`), border radius (`rounded-sm`), background (`bg-bg-input`), text styling (`font-mono text-base text-text-primary`), and focus ring (`focus:ring-[0_0_0_3px] focus:ring-accent-dim`) are all identical to the input style in T021 ModelFormSection. This guarantees that a row of sections side by side shares a single visual vocabulary.

#### Visual consistency with ModelFormSection (T021)

| Aspect | ModelFormSection | PrecisionFormSection | Match? |
|--------|------------------|---------------------|--------|
| Stateless, fully controlled | Yes | Yes | ✅ |
| Props: `{ values, onChange }` | `(fieldName, rawValue)` | `(fieldName, value)` — identical signature | ✅ |
| Default `values = {}` | Yes | Yes | ✅ |
| Section heading: emoji + `h2` text | 📐 "Modelo" | 🔢 "Precisión y cuantización" | ✅ (same pattern) |
| Label styling | `block text-xs font-mono uppercase tracking-wide text-text-muted mb-1.5` | Identical | ✅ |
| Input/select class tokens | `bg-bg-input`, `border-border`, etc. | Identical token set + `appearance-none` for `<select>` | ✅ |
| Field config via mapping array | Yes (`fields[]`) | Yes (`fields[]`) | ✅ |
| No hooks, no internal state | Yes | Yes | ✅ |

#### Accessibility features

- Each `<select>` has a corresponding `<label>` linked via `htmlFor={id}` / `id={id}`, ensuring screen readers announce the field purpose when the select receives focus.
- Option text includes both the technical name and byte count (e.g., "int8 (1 byte)"), providing meaningful context for users navigating by keyboard or assistive tools, even without sight of the dropdown's visual layout.
- Select IDs are stable strings (`dtype_bytes`, `kv_cache_dtype_bytes`) — safe targets for future `aria-describedby` linkage if a helper tooltip is added later.

#### Imports

| Import | Source | Type | Purpose |
|--------|--------|------|---------|
| `Fragment` | `'react'` | External (React) | Wraps the `<section>` to avoid adding an extra DOM node between this component and its parent container |

**Notable absence:** Unlike GPUBar which imports utility functions (`clamp`, `getGpuColorClass`), PrecisionFormSection has zero imports beyond React. It is a pure presentational shell — all data comes from props, and the only computation is a `??` default operator on field values.

#### Design decisions

- **`<select>` over `<input type="number">`:** The set of meaningful precision choices for LLM inference is small (float32 → int4). A dropdown eliminates invalid entries entirely, removing the need for error messaging that ModelFormSection requires. This simplifies the component to "render options, report selection."
- **No inline validation:** Because every option value is a valid positive numeric string (`'4'`, `'2'`, `'1'`, `'0.5'`), there is no possibility of user input producing an error state. The VRAM estimation formula in the parent will always receive usable values, even during intermediate keystrokes (which don't apply to selects — they change atomically on option click).
- **Spanish label text:** "Precision del modelo" and "Precision del KV cache" match the application's bilingual convention: English for internal variable names (`dtype_bytes`), Spanish for user-facing labels. This is consistent with prior component labeling throughout the dashboard.
- **`defaultValue = '2'` for both fields:** The bfloat16/float16 default reflects the current industry standard. Most LLM inference frameworks (vLLM, TensorRT-LLM) ship with half-precision as default because it halves VRAM consumption over float32 with negligible quality impact on modern GPU hardware (Ampere+ architectures include native TF32/bfloat16 tensor cores).
- **`0.5` bytes for int4:** The option value `'0.5'` accurately reflects that 4-bit quantization stores two parameters per byte. When this value is passed to the VRAM estimation formula (`num_parameters * dtype_bytes`), it correctly computes half-byte-per-parameter consumption without requiring special-case logic in the calculator.
- **Single `precisionOptions` array shared by both fields:** Both model precision and KV-cache precision use the identical option set. This reduces duplication and ensures consistency — if a new quantization level (e.g., NF4 at 0.5 bytes) were added, it would appear in both dropdowns automatically.
- **Emoji in section heading (`🔢`):** Continues the emoji-heading convention established by T021 ModelFormSection (`📐`). The calculator sections maintain a consistent visual identity that differentiates them from other UI areas of the application (dashboard cards use no emojis, modals use icons in buttons).

---

### T019 — `PCGrid.jsx`

> **File:** `frontend/src/components/PCGrid.jsx`
>
> Responsive grid layout with three conditional rendering states: loading, empty, populated.

#### What it does

Serves as the root container for PC cards. Renders a `<section>` with a responsive CSS Grid that adapts from 1 column (mobile) to 2 columns (>=768px) to 3 columns (>=1200px). Handles three mutually exclusive states:
1. **Loading:** Blinking "Loading servers..." message centered in the grid.
2. **Empty:** Static "No servers configured yet" suggestion with sub-prompt.
3. **Populated:** Maps over `pcs[]` to render one `<PCCard>` per server.

#### Props interface

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `pcs` | `Array<PCObject>` | Yes | Full array of servers from App state |
| `loading` | `boolean` | Yes | Whether the initial data fetch is still in-flight |
| `onEditPc` | `(pc) => void` | Yes | Passthrough callback to PCCard |
| `onAddService` | `({ pcId, vram, currentGpuUsed }) => void` | Yes | Passthrough callback to PCCard |
| `onDeletePc` | `({ pcId, nombre }) => void` | Yes | Passthrough callback to PCCard |
| `onEditService` | `(context) => void` | Yes | Passthrough callback to PCCard -> ServiceRow |
| `onDeleteService` | `(context) => void` | Yes | Passthrough callback to PCCard -> ServiceRow |

#### Internal state

**None.** No hooks. Pure rendering logic conditioned on props.

#### Structure / JSX tree

```
section (grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6)
│
├── [IF loading]
│   └── div (col-span-full, centered): "Loading servers..." + animate-pulse
│
├── [IF !loading && pcs.length === 0]
│   └── div (col-span-full, centered): empty state message + CTA text
│
└── [IF !loading && pcs.length > 0]
    └── PCCard[] (mapped over pcs, keyed by pc._id)
```

#### Styling approach

| Feature | Implementation | Detail |
|---------|---------------|--------|
| Grid layout | `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6` | Standard Tailwind responsive breakpoints; 24px gaps between cards |
| Loading indicator | `animate-pulse` on text | Subtle opacity blink — less aggressive than a spinner, matches the muted color palette |
| Empty state | Static text in `text-text-secondary` and `text-text-muted` (two-tone) | Primary message + guidance prompt; no image placeholder, keeping the component lightweight |

#### Accessibility features

- Uses `<section>` instead of a generic `<div>` for the grid — provides semantic grouping.
- Loading text uses `animate-pulse` rather than a visual spinner GIF — less visually jarring and does not trigger motion-reduction concerns as strongly as rapid rotation.

#### Imports

| Import | Source | Type | Purpose |
|--------|--------|------|---------|
| `PCCard` | `./PCCard` | Internal | Renders each server card within the grid |

#### Design decisions

- **Three-state conditional rendering (not two):** Rather than merging "loading" and "empty" states into a single placeholder, these are kept distinct. This allows fine-tuned UX for each scenario — loading shows an indicator, empty shows guidance text with a CTA.
- **Fragment `<></>` wrapper around PCCard mapping:** Required by React when the map output must not introduce an unnecessary DOM node inside the grid. Without it, an extra `<div>` would break CSS Grid layout (grid children must be direct descendants).

---

### T020 — `App.jsx`

> **File:** `frontend/src/App.jsx`
>
> Root application component. Owns all state, performs data fetching on mount, handles CRUD callbacks, and routes modal visibility via a single-object pattern.

#### What it does

The orchestrator of the entire frontend. Manages three pieces of React state (`pcs`, `loading`, `modalState`), fetches initial server data from the backend on component mount, defines all mutation callbacks (create/edit/delete PC and service handlers plus confirmation logic), and renders the component hierarchy with props wired up.

Acts as a **thin controller** — it does not render complex JSX itself. Its return value is a wrapper `<div>` containing exactly two main children (`<Header>` and `<PCGrid>`) plus five conditional modal placeholders (Phase 5 stubs).

#### Internal state

| Hook | Variable name | Initial value | Purpose |
|------|---------------|---------------|---------|
| `useState` | `pcs` | `[]` | Array of all servers. Updated on initial fetch and after every successful mutation (full refetch strategy) |
| `useState` | `loading` | `true` | Boolean flag indicating whether the mount-time data fetch is in-flight. Controls the loading state placeholder in PCGrid |
| `useState` | `modalState` | `{ type: null, payload: null }` | Single-object modal router. `type` determines which dialog is displayed (`'addPc'`, `'editPc'`, `'addService'`, `'editService'`, `'deleteConfirm'`). `payload` carries contextual data to the active modal |

**`useEffect` (mount only):** Fetches PCs via `fetchPcs()` API call. Sets `loading` to `false` in the `finally` block regardless of outcome. Runs once due to empty dependency array `[]`. Error handling logs to console with `[App]` prefixes for debugging.

#### Props interface

**None.** This is the root component — it receives no props. All data comes from internal state and external API calls.

#### Imports

| Import | Source | Type | Purpose |
|--------|--------|------|---------|
| `useState`, `useEffect` | `'react'` | External (React) | State management and side-effect coordination |
| `fetchPcs`, `createPc`, `updatePc`, `deletePc` | `'./services/pcApi.js'` | Internal | CRUD operations for server entities |
| `createService`, `updateService`, `deleteService` | `'./services/serviceApi.js'` | Internal | CRUD operations for service entities |
| `Header` | `'./components/Header.jsx'` | Internal | Page header / summary bar |
| `PCGrid` | `'./components/PCGrid.jsx'` | Internal | Responsive card grid container |
| *(Phase 5 stubs — commented out)* | AddPcModal, EditPcModal, AddServiceModal, EditServiceModal, DeleteConfirmModal | Internal (future) | Modal dialog components for data entry and confirmation |

#### Callback handlers

All seven handlers are defined in the component body (re-created on every render). This is safe because they do not hold mutable references — they only close over state setters or call imported API functions.

| Handler | Triggered by | Action |
|---------|-------------|--------|
| `closeModal` | Any modal's "Cancel/Close" button | Resets `modalState` to `{ type: null, payload: null }` |
| `handleAddPc` | AddPcModal's "Save" (Phase 5) | Calls `createPcHook.mutate(pcData)`, **only closes modal if no error** (modal stays open for retry on API failure) |
| `handleEditPc` | EditPcModal's "Save" (Phase 5) | Calls `updatePcHook.mutate({ id, data })` -> refetches full list -> sets new `pcs` state |
| `handleDeletePc` | Delete PC button on any card | **Opens** DeleteConfirmModal with `{ pcId, nombre, actionType: 'pc' }` payload (does NOT delete directly) |
| `handleAddService` | Add Service button on any card | **Opens** AddServiceModal with `{ pcId, vram, currentGpuUsed }` payload (does NOT create directly) |
| `handleEditService` | Edit icon on any service row | **Opens** EditServiceModal with full context including `pcId`, `index`, `service`, `vram`, `currentGpuUsed` |
| `handleDeleteService` | Delete icon on any service row | **Opens** DeleteConfirmModal with `{ pcId, index, actionType: 'service' }` payload |
| `handleConfirmDelete` | DeleteConfirmModal's "Confirm" button (Phase 5) | Reads `actionType` from `modalState.payload`, dispatches to either `deletePcHook.mutate(pcId)` or `deleteServiceHook.mutate({ pcId, index })` -> refetches full list |
| `handleSave` | Save button in Header | No-op — `Header` now handles JSON export internally. Preserved for backward compatibility (Header calls `onSave()` after export). |

**Pattern note:** Create and edit flows persist immediately on save (no confirmation modal). Delete flows always pass through a confirmation dialog (DeleteConfirmModal), preventing accidental deletions. Add and edit service/PC actions open data-entry modals rather than performing mutations directly.

**Error handling pattern (AddPcModal):** The `handleAddPc` handler now checks `result?.error` before closing the modal. If the API returns an error, the modal remains open so the user can retry. The `AddPcModal` receives `loading`, `error`, and `clearError` props from the `createPcHook` to display API error banners and disable the submit button during in-flight requests.

#### Modal routing pattern

The `modalState` object functions as a **single-point modal router**:

```javascript
const [modalState, setModalState] = useState({ type: null, payload: null });
```

- `type === null` -> no modal visible
- `type === 'addPc'` -> render `<AddPcModal>` with its callbacks
- `type === 'editPc'` -> render `<EditPcModal data={modalState.payload} .../>`
- ...and so on for all five modal types

Each conditional block is independent (`{modalState.type === '...' && (...)}`), but since only one type can be non-null at a time, exactly zero or one modal renders. This avoids the need for multiple boolean state variables (e.g., `isAddPcOpen`, `isDeleteConfirmOpen`, etc.) and keeps the state shape compact.

#### Structure / JSX tree

```
div (min-h-screen bg-bg-primary p-4 md:p-8) — root wrapper
│
├── Header pcs={pcs} onAddPc={() => ...} onSave={handleSave}
│
├── PCGrid pcs={pcs} loading={loading} [all 6 callbacks]
│
└── [conditional modals — 5 Phase-5 modals]
    ├── type === 'addPc'     → <AddPcModal onSave={handleAddPc} onClose={closeModal} loading={createPcHook.loading} error={createPcHook.error} clearError={createPcHook.clearError} />
    ├── type === 'editPc'    → <EditPcModal pc={modalState.payload} onSave={handleEditPc} onClose={closeModal} />
    ├── type === 'addService'→ <AddServiceModal pcId={...} pcVram={...} currentGpuUsed={...} onSave={handleSaveService} onClose={closeModal} />
    ├── type === 'editService'→ <EditServiceModal pcId={...} serviceIndex={...} service={...} pcVram={...} currentGpuUsed={...} onSave={handleEditServiceSubmit} onCancel={closeModal} />
    └── type === 'deleteConfirm' → <DeleteConfirmModal isOpen={true} message={deleteMessage} onConfirm={handleConfirmDelete} onCancel={closeModal} />
```

#### Styling approach

- Root wrapper: `min-h-screen bg-bg-primary text-text-primary font-sans p-4 md:p-8` — ensures full-viewport dark background, light text, and breathing room around content. Responsive padding increases on >=768px.
- Modal section: commented-out JSX is preserved as implementation scaffolding with clear inline documentation noting the Phase 5 hand-off.

#### Design decisions

- **Full refetch after every mutation, not optimistic updates:** Trade-off between responsiveness and consistency. A refetch guarantees the UI reflects whatever the server actually persisted (including validations, computed fields, or backend-side transformations). For a dashboard that is updated infrequently by a single user, latency is acceptable.
- **Modal state as single object:** Avoids state sprawl (`isAddPcOpen`, `isEditPcOpen`, etc.) and enables generic `closeModal()` that works for every modal type uniformly.
- **Inline arrow functions for `onAddPc` on Header:** `{() => setModalState({ type: 'addPc', payload: null })}` instead of a pre-defined handler function — keeps the code terse where the callback body is a single line. For more complex callbacks (delete, edit), named functions are used instead.
- **No Error Boundary or global error UI:** Errors during data fetching are logged to the browser console only. The UI shows no error state beyond `loading: false` with an empty `pcs[]` array, which naturally falls into PCGrid's "empty" placeholder. This is a known Phase 4 limitation — error UX would be added in a subsequent phase.

---

## GpuCalculator Module (Phase 5+)

### Overview

The **GPU Calculator** is a new feature module housed in `frontend/src/components/GpuCalculator/`. It provides an interactive estimator for GPU VRAM requirements when running transformer models on server hardware. This module follows the same presentational, unidirectional data-flow pattern as the Phase 4 dashboard components but constitutes a separate functional area of the application.

### Composition diagram (partial — T021 + T022)

```
GpuCalculatorPage.jsx (root — owns form state, runs estimation formula)
│
├── ModelFormSection.jsx (T021)
│     │
│     ├── section: "📐 Modelo" heading
│     └── 5x <input type="number"> fields: architecture parameters
│           each with inline positive-validation + hint text
│
└── PrecisionFormSection.jsx (T022)
      │
      ├── section: "🔢 Precisión y cuantización" heading
      └── 2x <select> dropdowns: dtype precision & KV cache precision
            each defaulting to bfloat16/float16 (2 bytes)
```

### Data flow

| Direction | What flows | How |
|-----------|-----------|-----|
| Top-down (GpuCalculatorPage → ModelFormSection) | `values` object containing all field values; accumulates across keystrokes | Props |
| Bottom-up (ModelFormSection → GpuCalculatorPage) | `(fieldName, rawValue)` on every keystroke via the `onChange` callback | Callback prop |
| Top-down (GpuCalculatorPage → PrecisionFormSection) | Same `values` object — parent accumulates all seven fields (5 from ModelFormSection + 2 from PrecisionFormSection) in one state object | Props |
| Bottom-up (PrecisionFormSection → GpuCalculatorPage) | `(fieldName, value)` on every select change via the identical `onChange` callback signature | Callback prop |

The parent page (`GpuCalculatorPage.jsx`, not yet created) is responsible for:
1. Maintaining a single `values` object in React state with all seven keys (`num_hidden_layers`, `num_key_value_heads`, `head_dim`, `hidden_size`, `num_parameters`, `dtype_bytes`, `kv_cache_dtype_bytes`)
2. Merging each field change via the `onChange` callback (identical handler for both sections — keyed by `fieldName`)
3. Running the VRAM estimation formula when all seven fields are populated and valid

### Relationship to Phase 4 components

| Aspect | Phase 4 (dashboard CRUD) | GpuCalculator | Relation |
|--------|------------------------|---------------|----------|
| Styling tokens | Custom Tailwind tokens (`bg-bg-input`, `border-border`, etc.) | **Identical tokens** | Visual consistency across features |
| Input validation | Modal dialogs with inline error messaging | **Same pattern** (error replaces hint on invalid input) | UX continuity |
| State management | All state in root App.jsx | **Same pattern** — all form state in GpuCalculatorPage, not in section components | Architecture consistency |
| Rendering | Stateless presentational components | **Identical approach** — both ModelFormSection and PrecisionFormSection are purely presentational | Reusable component contract |

---

## Architecture Summary

### Composition strategy

The component hierarchy follows a strict **unidirectional data flow** pattern:

```
State owner (App) -> Presentation layer (Header, PCGrid, PCCard, ServiceRow, GPUBar, GPUDetails)
         ^                                                    |
         └──────── Callbacks bubble up ───────────────────────┘
         v
      API Layer (pcApi.js, serviceApi.js)
         v
      Backend (Express + MongoDB — external to React tree)
```

No component performs data fetching. No component manages shared state other than App.jsx. This makes every component trivially testable in isolation by passing synthetic props.

### Why this structure?

| Decision | Rationale |
|----------|-----------|
| All state in App.jsx | The dashboard has a single source of truth (the `pcs[]` array). Lifting state to the root avoids prop-sync bugs between sibling components |
| Prop drilling over Context API | With only 3-4 levels of nesting, the added abstraction of React Context is unnecessary. Props are explicit and self-documenting at each level |
| Full refetch after mutations | Backend-driven consistency; eliminates optimistic-update rollback logic and edge cases with concurrent edits |
| Modal routing via single object | Reduces modal-related state from 5 boolean flags (+ activeModal payload) to a single `{ type, payload }` pair. Keeps the component's render tree clean |

### Phase 4 boundaries

Phase 4 establishes the **rendering layer** of the application:
- Done: Component hierarchy with React composition
- Done: Responsive Tailwind CSS styling (dark theme, custom colors)
- Done: GPU visualization components with animations and accessibility attributes
- Done: Callback wiring for all CRUD operations
- Done: Modal state routing (skeleton in place)

Phase 5 delivers the missing modal dialogs. Phase 4 has no modals — the five conditional render blocks in App.jsx all emit `null`. The callback handlers are complete but currently unreachable via UI.

### GPU Calculator module (beyond Phase 4)

- **`GpuCalculator/` folder:** A feature module for estimating VRAM requirements of transformer models on GPU hardware. Follows the same presentational, props-driven architecture as Phase 4.
- Currently contains two components: `ModelFormSection.jsx` (the "Model" form section — five number inputs) and `PrecisionFormSection.jsx` (the "Precision & Quantization" section — two dropdown selects for dtype and KV-cache precision). Additional sections (Hardware configuration, Results display) are planned.

### Custom Tailwind Configuration (relevant tokens)

| Token | Value | Usage |
|-------|-------|-------|
| `bg-primary` | `#0b0f14` | Page background |
| `bg-card` | `#182030` | Card containers |
| `bg-input` | `#1e2a3a` | Port badges, progress bar tracks |
| `text-primary` | `#e6edf3` | Primary text |
| `text-secondary` | `#7a8a9e` | Labels, metadata |
| `accent.DEFAULT` | `#00d4aa` | Primary CTA buttons |
| `danger.DEFAULT` | `#ff6b6b` | Destructive actions |
| `gpu.green` | `#3fb950` | VRAM <=35% |
| `gpu.yellow` | `#d29922` | VRAM 36-70% |
| `gpu.red` | `#f85149` | VRAM >70% |
| `border.DEFAULT` | `#233045` | Card borders, separators |

### Animation Reference

| Class | Keyframe | Duration | Easing | Purpose |
|-------|----------|----------|--------|---------|
| `animate-card-enter` | `cardSlideInUp` | 0.4s | ease-out | PCCard entrance: fade in + slide up from 24px |
| `animate-gpu-fill` | `gpuBarFill` | 0.6s | cubic-bezier(0.25, 0.8, 0.25, 1) | GPU bar width animation from 0% to target |
| `animate-gpu-warning` | `gpuWarningPulse` | 1.8s, infinite | ease-in-out | Pulsing red box-shadow glow when VRAM >80% |
| `animate-pulse` | Tailwind built-in | — | — | Loading indicator text blink |

---

## 🔄 Changes in this update

### T6 — AddPcModal error handling and loading state integration
- **Updated** `handleAddPc` handler: now checks `result?.error` before closing the modal. If the API returns an error, the modal remains open so the user can retry.
- **Updated** `AddPcModal` rendering: now passes `loading={createPcHook.loading}`, `error={createPcHook.error}`, and `clearError={createPcHook.clearError}` props.
- **Updated** JSX tree diagram: replaced Phase 5 placeholder `null` values with actual modal component props.
- **Updated** callback handlers table: added error handling pattern note for `handleAddPc`.
- **Updated** design decisions: noted that `handleAddPc` conditionally closes the modal on error for retry UX.

### T13 — Export JSON functionality in Header and updated data flow
- **Updated** `Header.jsx` (T014): replaced the no-op "Save" button with a working "Export JSON" button. Added `handleExport()` internal function that:
  1. Serializes `pcs` array via `JSON.stringify(pcs, null, 2)`.
  2. Creates a `Blob([json], { type: 'application/json' })`.
  3. Generates object URL via `URL.createObjectURL(blob)`.
  4. Creates a timestamped filename: `gpu-infra-{ISO timestamp with : and . replaced by -}.json`.
  5. Programmatically clicks a temporary `<a>` element to trigger the browser download.
  6. Cleans up: removes anchor from DOM, revokes object URL.
  7. Calls `onSave()` if it's a function (backward compatibility).
- **Updated** Header props: `pcs` now serves dual purpose — summary counts AND export payload.
- **Updated** Header JSX tree: "Save" button replaced by "Export JSON" button with download SVG icon.
- **Updated** Header styling: Export JSON button uses secondary bordered pattern (`border border-border text-text-secondary`) with hover text color transition.
- **Updated** Header accessibility: both SVG icons (plus, download arrow) have `aria-hidden="true"`.
- **Updated** Header design decisions: export logic co-located in Header (not in App.jsx); uses native browser APIs (zero server overhead).
- **Updated** `App.jsx` (T020): `handleSave` is now a documented no-op. Comment reads "No-op onSave passed to Header — the component handles export internally."
- **Updated** App.jsx composition diagram: `onSave` now documented as no-op callback; `handleExport()` added as internal Header function.

### T2 — GPU Calculator: ModelFormSection component (new)
- **Added** new component reference T021: `ModelFormSection.jsx` at `frontend/src/components/GpuCalculator/ModelFormSection.jsx`.
- **Purpose:** The first component of the GPU Calculator feature module. Controlled, stateless form section rendering five number inputs for transformer model architecture parameters (num_hidden_layers, num_key_value_heads, head_dim, hidden_size, num_parameters).
- **Architecture:** Stateless presentational component with two props (`values` object, `onChange` callback). Follows the same unidirectional data-flow pattern as Phase 4 dashboard components — all state lives in a parent page component (GpuCalculatorPage.jsx, not yet created).
- **Validation:** Inline per-field validation — positive value check with error messaging ("Must be a positive number.") when value ≤ 0, hint text showing example values for each field when valid.
- **Styling:** Reuses the same custom Tailwind tokens as Phase 5 modal inputs (`bg-bg-input`, `border-border`, `text-text-primary`, `danger`) for visual consistency across the application.
- **GpuCalculator module section:** Added comprehensive "GpuCalculator Module (Phase 5+)" section covering partial composition diagram, data flow table, and relationship-to-Phase4 comparison table.
- **Phase boundaries note:** Extended Phase 4 boundaries documentation to acknowledge the GPU Calculator module as a beyond-Phase-4 feature following identical architectural patterns.
