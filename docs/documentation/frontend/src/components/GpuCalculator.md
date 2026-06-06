# GpuCalculator

> Path: `frontend/src/components/GpuCalculator/`
> Last updated: 2026-06-06
> Type: Leaf folder

Form-section components for the GPU Calculator feature — a dedicated tool that estimates VRAM requirements for running transformer models on GPU hardware. Each component is controlled and stateless, receiving values via a `values` prop object and reporting changes upward through an `onChange(fieldName, value)` callback. They share identical Tailwind styling tokens with the Phase 5 modal dialogs to maintain cross-feature visual consistency.

---

## 📄 `HardwareFormSection.jsx`

Controlled, stateless form section for GPU hardware parameters. Renders two `<input type="number">` fields: total VRAM (in GB) and GPU memory utilization (as a decimal fraction displayed visually as a percentage). Section heading uses the emoji icon "🖥️ Hardware". The component applies inline per-field validation — each input shows a red error message when the entered value violates its constraints, and displays contextual hint text when valid.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| *(none)* | — | — |

This component has no imports; it uses only native browser APIs internally.

### Functions

#### `HardwareFormSection({ values = {}, onChange }) → JSX.Element` _(default export)_

Renders a `<section>` containing the Hardware header (`<h2>`) and two number inputs mapped from an internal `fields[]` configuration array. Fully controlled: all current values come from the `values` object prop; all changes propagate upward via `onChange(fieldName, rawValue)`.

- **`values: Object`** _(default: `{}`)_ — Object keyed by field ID holding current input values. Expected keys: `vram_total_gb`, `gpu_memory_utilization`. Defaults to `{}` so an unconfigured parent renders functional (empty or default-valued) inputs.
- **`onChange: (fieldName: string, rawValue: string) → void`** — Callback invoked on every keystroke in either field. Receives the field ID (string) and the raw input value (string). Parent is responsible for coercion, accumulated validation, and state storage.

**Internal field definitions:**

| Field ID | Label | Hint text | Placeholder | Default | min | step | max |
|----------|-------|-----------|-------------|---------|-----|------|-----|
| `vram_total_gb` | "Total VRAM (GB)" | "Total GPU video memory in gigabytes (e.g., 80 for an A100 80 GB)" | `80` | `80` | `"0"` | `"1"` | _none_ |
| `gpu_memory_utilization` | "GPU Memory Utilization (%)" | Dynamic: computed from current value as `Showing {N} % of VRAM` | `0.95` | `0.95` | `"0"` | `"0.01"` | `"1"` |

**Derived values per field (computed at render time):**

- **`value`**: `values[id] ?? defaultValue` — uses the value from props if provided; falls back to the field's default (80 for VRAM, 0.95 for utilization).
- **`displayHint`**: For `vram_total_gb`, uses the static hint string. For `gpu_memory_utilization`, dynamically computes a percentage display: `Showing ${(Number(value) * 100).toFixed(0)} % of VRAM` (only when value is non-empty and defined).
- **`isInvalid`**: Boolean validation flag — computed differently per field:
  - `gpu_memory_utilization`: invalid if `value !== '' && value !== undefined && (Number(value) <= 0 || Number(value) > 1)` — must be in the open interval (0, 1].
  - `vram_total_gb`: invalid if `value !== '' && value !== undefined && Number(value) <= 0` — must be positive.

**Validation behavior:**

| State | Border color | Error message | Hint text |
|-------|-------------|---------------|-----------|
| Empty (`''`) or uninitialized | Default (`border-border`) | Hidden | Shown (static for VRAM; N/A for utilization when empty) |
| Valid positive number / valid fraction | Default | Hidden | Shown in muted text |
| Invalid (≤ 0 or > 1) | `border-danger` (red) | Shown: "Must be between 0 and 1." (utilization) or "Must be a positive number." (VRAM) | Hidden |

The validation is **inline and immediate** — it triggers on every re-render when the parent passes updated values. This matches the UX pattern established by both the Phase 5 modal dialogs and `ModelFormSection.jsx`.

**Shared input class (`inputCls`):**

```
w-full bg-bg-input border border-border rounded-sm px-3.5 py-2.5
font-mono text-base text-text-primary outline-none
transition-colors focus:border-accent
focus:ring-[0_0_0_3px] focus:ring-accent-dim
placeholder:text-text-muted
```

Identical to `ModelFormSection.jsx` and Phase 5 modal inputs. When `isInvalid` is true, `border-danger` is appended.

### Accessibility features

- Each `<input>` has a corresponding `<label>` linked via `htmlFor={id}` / `id={id}`, ensuring screen readers announce the field purpose.
- `aria-invalid={isInvalid}` on each input dynamically communicates validation state to assistive technologies.
- Error messages have their own semantic `<p>` element with a stable ID (`${id}-error`) for potential future linkage via `aria-describedby`.
- Input types are `number` with `min="0"` — provides built-in accessibility semantics about expected input range.

### Design decisions

- **Stateless component (no local state):** All data flows through props. The parent GPU Calculator page accumulates values in a single object and re-renders this section on every keystroke. Given any `values` object, output is fully deterministic.
- **No external form library:** Validation logic lives inside the render function as simple boolean checks. For two fields with straightforward rules, a full form library would add unnecessary overhead.
- **String values propagated upward:** `onChange` fires with raw string values (`e.target.value`). The parent decides when and how to coerce — typically via `Number(value)` before passing it to the VRAM estimation formula. This avoids losing empty-input state (coercing `''` → `0` would be incorrect; for VRAM, `80` is a meaningful default distinct from an empty field).
- **Dynamic hint for utilization:** Unlike ModelFormSection's static hints, GPU memory utilization computes its hint live to show the user what percentage their decimal input corresponds to. For example, entering `0.95` shows "Showing 95 % of VRAM". This bridges the gap between the developer-facing decimal notation and the user-facing percentage concept.
- **Emoji in section heading (`🖥️`):** Continues the emoji-heading convention established by ModelFormSection (`📐`) and PrecisionFormSection (`🔢`). The calculator sections maintain a consistent visual identity.

---

## 📄 `WorkloadFormSection.jsx`

Controlled, stateless form section for workload and inferencing parameters. Renders five `<input type="number">` fields covering context length, concurrency limits, prompt/output token lengths, and prefix cache hit ratio. Section heading uses the emoji icon "🎯 Carga de trabajo" (Spanish for Workload). The component applies inline per-field validation — each input shows a red error message when the entered value violates its constraints, and displays contextual hint text when valid.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| *(none)* | — | — |

This component has no imports; it uses only native browser APIs internally.

### Functions

#### `WorkloadFormSection({ values = {}, onChange }) → JSX.Element` _(default export)_

Renders a `<section>` containing the Workload header (`<h2>`) and five number inputs mapped from an internal `fields[]` configuration array. Fully controlled: all current values come from the `values` object prop; all changes propagate upward via `onChange(fieldName, rawValue)`.

- **`values: Object`** _(default: `{}`)_ — Object keyed by field ID holding current input values. Expected keys: `max_model_len`, `max_num_seqs`, `avg_prompt_len`, `avg_output_len`, `prefix_cache_hit_ratio`. Defaults to `{}` so an unconfigured parent renders functional (empty or default-valued) inputs.
- **`onChange: (fieldName: string, rawValue: string) → void`** — Callback invoked on every keystroke in any field. Receives the field ID (string) and the raw input value (string). Parent is responsible for coercion, accumulated validation, and state storage.

**Internal field definitions:**

| Field ID | Label | Hint text | Placeholder | Default | min | step | max |
|----------|-------|-----------|-------------|---------|-----|------|-----|
| `max_model_len` | "Max Model Length" | "Maximum context/sequence length (e.g., 4096)" | `4096` | `4096` | `"0"` | `"any"` | _none_ |
| `max_num_seqs` | "Max Num Sequences" | "Maximum concurrent requests / batch size (e.g., 256)" | `256` | `256` | `"0"` | `"any"` | _none_ |
| `avg_prompt_len` | "Avg Prompt Length" | "Average input prompt token length (e.g., 256)" | `256` | `256` | `"0"` | `"any"` | _none_ |
| `avg_output_len` | "Avg Output Length" | "Average generated output token length (e.g., 1024)" | `1024` | `1024` | `"0"` | `"any"` | _none_ |
| `prefix_cache_hit_ratio` | "Prefix Cache Hit Ratio" | "Fraction of KV cache covered by shared prefix (0 = none, 1 = all)" | `0.5` | `0.5` | `"0"` | `"0.01"` | `"1"` |

**Derived values per field (computed at render time):**

- **`value`**: `values[id] ?? defaultValue` — uses the value from props if provided; falls back to the field's default specified in the configuration array.
- **`isInvalid`**: Boolean validation flag — computed differently per field:
  - `prefix_cache_hit_ratio`: invalid if `value !== '' && value !== undefined && (Number(value) < 0 || Number(value) > 1)` — must be in the closed interval [0, 1].
  - All other four fields: invalid if `value !== '' && value !== undefined && Number(value) <= 0` — must be strictly positive.

**Validation behavior:**

| State | Border color | Error message | Hint text |
|-------|-------------|---------------|-----------|
| Empty (`''`) or uninitialized | Default (`border-border`) | Hidden | Shown (static hint text) |
| Valid positive number / valid ratio | Default | Hidden | Shown in muted text |
| Invalid (≤ 0 for lengths, outside [0,1] for ratio) | `border-danger` (red) | Shown: "Must be between 0 and 1." (ratio) or "Must be a positive number." (lengths) | Hidden |

The validation is **inline and immediate** — it triggers on every re-render when the parent passes updated values. This matches the UX pattern established by `HardwareFormSection.jsx`, `ModelFormSection.jsx`, and the Phase 5 modal dialogs.

**Shared input class (`inputCls`):**

```
w-full bg-bg-input border border-border rounded-sm px-3.5 py-2.5 font-mono text-base text-text-primary outline-none transition-colors focus:border-accent focus:ring-[0_0_0_3px] focus:ring-accent-dim placeholder:text-text-muted
```

Identical to `HardwareFormSection.jsx`, `ModelFormSection.jsx`, and Phase 5 modal inputs. When `isInvalid` is true, `border-danger` is appended.

### Accessibility features

- Each `<input>` has a corresponding `<label>` linked via `htmlFor={id}` / `id={id}`, ensuring screen readers announce the field purpose.
- `aria-invalid={isInvalid}` on each input dynamically communicates validation state to assistive technologies.
- Error messages have their own semantic `<p>` element with a stable ID (`${id}-error`) for potential future linkage via `aria-describedby`.
- Input types are `number` with explicit `min`, `step`, and (where applicable) `max` attributes — provides built-in accessibility semantics about expected input range and granularity.

### Design decisions

- **Stateless component (no local state):** All data flows through props. The parent GPU Calculator page accumulates values in a single object and re-renders this section on every keystroke. Given any `values` object, output is fully deterministic.
- **No external form library:** Validation logic lives inside the render function as simple boolean checks within the `.map()` callback. For five fields with straightforward range rules, a full form library would add unnecessary overhead.
- **String values propagated upward:** `onChange` fires with raw string values (`e.target.value`). The parent decides when and how to coerce — typically via `Number(value)` before passing it to the VRAM estimation formula. This avoids losing empty-input state (coercing `''` → `0` would be indistinguishable from an intentional zero entry for lengths, which is itself invalid).
- **Bimodal validation:** The component distinguishes between two validation regimes — positive integer checks for the four length/concurrency fields versus a closed [0, 1] interval check for the cache hit ratio. This is implemented via an `if (id === 'prefix_cache_hit_ratio')` branch inside the render loop rather than encoding rules into the field metadata object.
- **Bilingual heading (`🎯 Carga de trabajo`):** The section title appears in Spanish, continuing the project's localized UI convention observed in other GPU Calculator components. The emoji `🎯` ("target/bullseye") visually signals that this section configures operational/workload parameters.
- **step="any" for integer-like fields:** Unlike `HardwareFormSection` which uses `step="1"` and `step="0.01"`, the four length fields use `step="any"` to permit arbitrary positive numbers without UI-level rounding constraints (e.g., non-standard context lengths). The ratio field uses `step="0.01"` for fine-grained decimal input consistent with utilization-like controls.

---

## 📄 `ResultsDisplay.jsx`

Read-only display component that renders VRAM estimation results as labeled progress bars with numeric readouts and a color-coded summary card. Stateless: receives a pre-computed `results` object via props and derives all rendering from it at render time (no `useState`, no `useEffect`). Matches the existing `GPUBar` / `GPUDetails` visual style using the same Tailwind patterns (bg-bg-input track, rounded-full overflow-hidden, animated fill via `--gpu-target-width` CSS custom property).

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `../../utils/gpuHelpers.js` | `clamp`, `getGpuColorClass` | Internal |

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `METRIC_ROWS` | Array of 7 metric objects | Configuration array defining each metric row to render: label, key (maps to results object), unit string, and optional `showBar` flag. Rows with `showBar: false` render only the label/value pair without a progress bar. |
| `WARNING_THRESHOLD` | `80` | Percentage threshold for warning state. When `usagePercent > WARNING_THRESHOLD`, the summary dot and VRAM usage bar receive the `animate-gpu-warning` CSS animation class. Threshold matching `getGpuColorClass` thresholds (yellow starts at 36%, red at >70%). |

**METRIC_ROWS entries:**

| Index | Label | Key | Unit | Shows Bar? |
|-------|-------|-----|------|------------|
| 0 | "Model Weights" | `modelSizeGB` | GB | Yes (default) |
| 1 | "KV Cache / Sequence" | `kvCachePerSeqGB` | GB | Yes (default) |
| 2 | "Total KV Cache" | `totalKvCacheGB` | GB | Yes (default) |
| 3 | "Available VRAM" | `availableVramGB` | GB | **No** — informational denominator value |
| 4 | "Used VRAM (effective)" | `usedVramGB` | GB | Yes (default) |
| 5 | "Remaining VRAM" | `remainingVramGB` | GB | Yes (default) |
| 6 | "Prefix Cache Savings" | `prefixCacheSavingsGB` | GB | **No** — informational only |

### Functions

#### `ResultsDisplay({ results }) → JSX.Element` _(default export)_

Pure display component. Accepts a single `results` prop (object). All rendering is derived at render time from this object plus the static `METRIC_ROWS` configuration.

- **`results: Object`** — Pre-computed VRAM estimation result object. Expected keys:
  - `modelSizeGB: number` — Raw model weight size in GB
  - `kvCachePerSeqGB: number` — Per-sequence Key/Value cache footprint in GB
  - `totalKvCacheGB: number` — Aggregate KV cache across all sequences, in GB
  - `availableVramGB: number` — Usable VRAM after utilization ceiling is applied, in GB
  - `usedVramGB: number` — Effective VRAM consumption (model + reduced KV cache with prefix caching), in GB
  - `remainingVramGB: number` — Free VRAM remaining (`available - used`), in GB
  - `vramUsagePercent: number` — Utilisation percentage (`(used / available) × 100`)
  - `prefixCacheSavingsGB: number` — Memory saved by prefix caching, in GB

**Rendering behaviour:**

1. **Empty state guard:** The component checks whether `usedVramGB > 0`, `availableVramGB > 0`, and `vramUsagePercent > 0`. If any of these are falsy (including when `results` is `null`/`undefined`), it renders an empty-state placeholder — a centered card with "No results yet" heading and hint text. Container uses `min-h-[280px]` to prevent layout shift when transitioning from empty → populated state.

2. **Summary card (top section):** Renders VRAM usage overview:
   - **Heading:** `📊 Results` (`<h2>` with `text-lg font-bold text-text-primary`)
   - **Accent dot:** 3.5×3.5 px rounded circle whose background color follows `getGpuColorClass(usagePercent)`. Receives `animate-gpu-warning` CSS class when `isWarning` (usage > 80%).
   - **Numeric readout:** Large monospace font showing `usedVramGB.toFixed(2)` with a trailing `/ availableVramGB.toFixed(2) GB`. The percentage is shown separately, colored via Tailwind text classes derived from the same color logic (`text-gpu-green` / `text-gpu-yellow` / `text-gpu-red`).
   - **VRAM usage bar:** Reuses the GPUBar visual pattern: a `bg-bg-input` track with `rounded-full overflow-hidden`, and an animated fill div whose width is controlled by the `--gpu-target-width` CSS custom property set to `${usagePercent}%`. The fill receives `aria-valuenow`, `aria-valuemin="0"`, `aria-valuemax="100"` for accessibility. Warning animation applied if `isWarning` is true.

3. **Metric rows (bottom section):** Iterates `METRIC_ROWS` array via `.map()`:
   - Each row renders a label (uppercase, mono font, muted text) and a value (`value.toFixed(2)` in bold mono + unit).
   - For rows where `showBar !== false`, computes `barPercent = clamp((value / availableVramGB) * 100, 0, 100)` and renders a proportional progress bar using the same GPUBar pattern (bg-bg-input track, color-coded animated fill via `getGpuColorClass(barPercent)`).
   - Rows without a bar (`showBar: false`) render only the label/value pair.

### Color coding logic

Powered by `getGpuColorClass(percent)` from `gpuHelpers.js`:

| Range | Class | Colour (hex) | Meaning |
|-------|-------|-------------|---------|
| ≤ 35% | `bg-gpu-green` | #3fb950 | Healthy — low VRAM utilisation |
| 36–70% | `bg-gpu-yellow` | #d29922 | Caution — moderate-to-high utilisation |
| > 70% | `bg-gpu-red` | #f85149 | Critical — near or exceeding capacity |

The same thresholds apply to the summary dot, the main VRAM usage bar, and every individual metric bar. The text colour of the percentage readout is also mapped (e.g., `text-gpu-green` / `text-gpu-yellow` / `text-gpu-red`).

### Accessibility features

- **Progress bars:** Each bar `<div>` has `role="progressbar"` with `aria-valuenow`, `aria-valuemin="0"`, and `aria-valuemax="100"` attributes for screen reader support.
- **Warning dot:** The color-coded accent dot uses `aria-hidden="true"` since it is purely decorative (information conveyed by the numeric readout).
- **Empty state container:** Uses identical outer dimensions (`min-h-[280px]`) to prevent layout shift when transitioning between empty and populated states, avoiding reflow-based disorientation for users.

### Example usage

```jsx
import ResultsDisplay from './components/GpuCalculator/ResultsDisplay'

// Inside a parent component (e.g., GPU Calculator page):
const results = {
  modelSizeGB: 14.56,
  kvCachePerSeqGB: 0.25,
  totalKvCacheGB: 64.00,
  availableVramGB: 76.00,
  usedVramGB: 43.82,
  remainingVramGB: 32.18,
  vramUsagePercent: 57.66,
  prefixCacheSavingsGB: 32.00,
}

<ResultsDisplay results={results} />
```

**When `results` is `{}`, `null`, or has zero/negative key values:** returns the empty-state placeholder.

---

## 📄 `GPUCalculatorPage.jsx`

Orchestrator component for the entire GPU VRAM Calculator feature. This is the top-level page that holds the unified form state for all 14 input fields across the four sibling form sections, derives calculation results synchronously during each render (no `useEffect`), and presents the responsive two-column layout with form sections on the left and a sticky ResultsDisplay panel on the right. Implements the "derived state during render" pattern recommended by Vercel React Best Practices — all computations happen in the component body so that React's batching guarantees results are always in sync with inputs without an extra effect-driven re-render cycle.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `useState` | External |
| `./ModelFormSection` | `ModelFormSection` (default) | Internal |
| `./PrecisionFormSection` | `PrecisionFormSection` (default) | Internal |
| `./HardwareFormSection` | `HardwareFormSection` (default) | Internal |
| `./WorkloadFormSection` | `WorkloadFormSection` (default) | Internal |
| `./ResultsDisplay` | `ResultsDisplay` (default) | Internal |
| `../../utils/calculatorEngine.js` | `calculateModelSizeGB`, `calculateKvCachePerSeqGB`, `calculateTotalKvCacheGB`, `getAvailableVram`, `getUsedVramWithPrefixCache`, `getRemainingVram`, `getVramUsagePercent` | Internal |

### Constants

#### `DEFAULT_STATE: Object`

A module-level constant object holding the initial/default values for all 14 form fields. Grouped into four sections that mirror the four child form components.

| Field (section) | Key | Default value | Type when stored | Notes |
|-----------------|-----|---------------|------------------|-------|
| **Model** | `num_hidden_layers` | `'32'` | string | Transformer depth |
| **Model** | `num_key_value_heads` | `'8'` | string | Multi-query / GQA configuration |
| **Model** | `head_dim` | `'128'` | string | Per-attention-head dimension |
| **Model** | `hidden_size` | `'4096'` | string | Model width |
| **Model** | `num_parameters` | `'7000000000'` | string | 7B parameter model (e.g., Llama-3.1-8B class) |
| **Precision** | `dtype_bytes` | `'2'` | string | FP16/BF16 by default |
| **Precision** | `kv_cache_dtype_bytes` | `'2'` | string | FP16/BF16 KV cache by default |
| **Hardware** | `vram_total_gb` | `'80'` | string | A100-80GB class GPU |
| **Hardware** | `gpu_memory_utilization` | `'0.95'` | string | 95 % of VRAM usable |
| **Workload** | `max_model_len` | `'4096'` | string | Context window (tokens) |
| **Workload** | `max_num_seqs` | `'256'` | string | Max concurrent sequences |
| **Workload** | `avg_prompt_len` | `'256'` | string | Mean prompt length |
| **Workload** | `avg_output_len` | `'1024'` | string | Mean output length |
| **Workload** | `prefix_cache_hit_ratio` | `'0.5'` | string | 50 % prefix cache coverage |

All values are stored as strings to align with React's `<input>` value semantics and avoid premature numeric coercion of empty fields.

### Component function

#### `GPUCalculatorPage() → JSX.Element` _(default export)_

The main page-level component with no props (self-contained). Manages a single `useState` call for the unified form state and derives all calculator outputs during render.

**State:**

- **`[formState, setFormState] = useState(DEFAULT_STATE)`** — The sole piece of mutable local state. Holds an object keyed by the 14 field IDs. Updating any key triggers a re-render in which all derived results are recalculated synchronously.

**Internal handlers:**

| Handler | Signature | Purpose |
|---------|-----------|---------|
| `handleChange` | `(fieldName: string, value: string) → void` | Unified onChange forwarded to all four form sections. Uses functional setState form: `prev => ({ ...prev, [fieldName]: value })`. Spreads the previous state and overwrites only the changed key, preserving the other 13 fields. |
| `handleReset` | `() → void` | Restores every field to its default value from `DEFAULT_STATE`. Uses functional setState form: `() => ({ ...DEFAULT_STATE })` to avoid stale closure issues — the spread of `DEFAULT_STATE` happens inside the updater function, so it always reads the current constant. |

**Derived-state computation chain (executed during render):**

These are not wrapped in `useMemo`; they run inline each render, matching React's recommendation that "derived state is free" because React re-renders synchronously for parent updates. The full pipeline:

```
1. modelSizeGB        = calculateModelSizeGB(num_parameters, dtype_bytes)
2. kvCachePerSeqGB    = calculateKvCachePerSeqGB(num_hidden_layers, num_key_value_heads, head_dim, max_model_len, kv_cache_dtype_bytes)
3. totalKvCacheGB     = calculateTotalKvCacheGB(kvCachePerSeqGB, max_num_seqs)
4. availableVramGB    = getAvailableVram(vram_total_gb, gpu_memory_utilization)
5. usedVramGB         = getUsedVramWithPrefixCache(modelSizeGB, totalKvCacheGB, prefix_cache_hit_ratio)
6. remainingVramGB    = getRemainingVram(availableVramGB, usedVramGB)
7. vramUsagePercent   = getVramUsagePercent(usedVramGB, availableVramGB)
8. prefixCacheSavingsGB = Math.round((totalKvCacheGB - effectiveKv) * 100) / 100
   ↳ where effectiveKv = totalKvCacheGB * (1 - Number(prefix_cache_hit_ratio) || 0)
```

Steps 1–7 call the seven pure functions from `calculatorEngine.js`. Step 8 is a lightweight inline derivation: it computes how much KV cache memory was saved by prefix caching (the difference between total untrimmed cache and effective actual usage). The result is rounded to two decimal places.

These eight values are assembled into a `results` object with the exact keys expected by `ResultsDisplay.jsx`:

```js
const results = { modelSizeGB, kvCachePerSeqGB, totalKvCacheGB, availableVramGB, usedVramGB, remainingVramGB, vramUsagePercent, prefixCacheSavingsGB };
```

**Props passed to each child component:**

| Child | `values` prop | `onChange` / other prop | Notes |
|-------|---------------|------------------------|-------|
| `<ModelFormSection>` | `formState` (entire 14-key object; child reads only its 5 keys) | `handleChange` | Stateless — renders inputs from whatever slice of `values` it needs. |
| `<PrecisionFormSection>` | `formState` | `handleChange` | Same pattern. |
| `<HardwareFormSection>` | `formState` | `handleChange` | Same pattern. |
| `<WorkloadFormSection>` | `formState` | `handleChange` | Same pattern. |
| `<ResultsDisplay>` | _none_ | `results={results}` (8-key derived object) | Read-only; no onChange needed. Receives the computed snapshot, never the raw form state. |

**Layout structure:**

The component renders a full-page response inside a `<div className="min-h-screen bg-bg-primary text-text-primary font-sans p-4 md:p-8">`:

1. **Title + Reset bar** (`flex flex-col sm:flex-row`):
   - Left: `<h1>` with "🧮 GPU VRAM Calculator" heading (`text-2xl font-bold`).
   - Right: Reset button ("↺ Reset defaults") styled as a bordered, elevated-background button. On mobile it aligns to the start of its column; on `sm:` breakpoint it flows inline.

2. **Main grid** (`grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6`):
   - **Left column** — inner grid (`grid-cols-1 md:grid-cols-2 gap-6`) containing four `<div>` cards (each with `rounded-lg border border-border bg-bg-elevated p-6`). Each card wraps one form section component. Layout: single column on mobile → two columns starting at `md:` breakpoint.
   - **Right column** — `<aside>` element with sticky positioning (`lg:sticky lg:top-8 h-fit`). Contains `<ResultsDisplay results={results} />`. The sticky class and offset activate only at `lg:` breakpoint so the results panel follows the user while scrolling through form sections on desktop. On mobile, it flows below the four form sections naturally.

**Responsive breakpoints summary:**

| Breakpoint | Form grid | Title bar | Results aside |
|------------|-----------|-----------|----------------|
| `< sm` (mobile) | 1 column | stacked (title above button) | flows in document order (below forms) |
| `sm:` → `< lg` (tablet) | 1 column | inline (title left, button right) | flows in document order |
| `md:` → `< lg` (large tablet) | **2 columns** | inline | flows in document order |
| `lg:` (desktop, ≥ 1024 px) | **2 columns** | inline | **sticky aside** — 380px fixed width |

### Design decisions

- **Single source of truth (one useState):** Rather than having each form section manage its own local state and synchronizing via refs or context, all 14 fields live in one object. This makes the "Reset to defaults" button trivially simple and guarantees that results are always computed from a consistent snapshot — no risk of one form section lagging behind another during rapid edits.
- **Derived state instead of useEffect:** The React runtime itself performs synchronous re-renders for parent state changes. Computing `results` directly in the component body means there is zero latency between an input change and the results displaying updated values. No extra render, no stale closure, no race condition with async effects.
- **Functional setState for handlers:** Both `handleChange` and `handleReset` use the callback form of setState (`prev => ...` or `() => ...`) rather than passing an object directly. This is a defensive pattern against React batching: even if multiple keystrokes are batched, each updater receives the most recent state available at execution time.
- **`DEFAULT_STATE` as module-level constant:** Placing defaults outside the component ensures a stable reference identity across re-renders. The reset handler spreads this object rather than deep-cloning it inline, keeping the code DRY while maintaining immutability (the spread creates a new top-level object each time).
- **No props to `GPUCalculatorPage`:** As a page-level orchestrator, no external configuration is needed. All defaults are internal knowledge of the calculator feature. Future extension paths might include prop-based model presets (Llama, Mistral, etc.), but the current design keeps it self-contained.

---

## 🔄 Changes in this update

### 2026-06-06 — GPUCalculatorPage addition (Task [7])
- **Documented** `GPUCalculatorPage.jsx` — orchestrator page component that manages unified `formState` (14 fields) via a single `useState`. Derives all calculator results synchronously during render (no `useEffect`) by chaining the 7 pure functions from `calculatorEngine.js`, then constructing an 8-key `results` object (including derived `prefixCacheSavingsGB`). Responsive layout: single-column on mobile, `md:` 2-column form grid, `lg:` two-column split (form sections left, sticky results panel right). Wires all four sibling form sections via `{ values: formState, onChange: handleChange }`. Includes a Reset button that uses functional setState to restore all defaults. Follows Vercel React Best Practices: computed derived state during render rather than in effects.

### 2026-06-06 — ResultsDisplay addition (Task [6])
- **Documented** `ResultsDisplay.jsx` — pure display component with color-coded progress bars, summary card with accent dot, metric rows driven by static `METRIC_ROWS` configuration array. Empty-state guard prevents layout shift. Imports `clamp` and `getGpuColorClass` from internal `gpuHelpers.js`.

### 2026-06-06 — WorkloadFormSection addition
- **Documented** `WorkloadFormSection.jsx` — controlled form section with five number inputs (max model length, max sequences, avg prompt length, avg output length, prefix cache hit ratio), bimodal inline validation, fully stateless props-based data flow.

### 2026-06-06 — Initial creation
- **Created** `docs/documentation/frontend/src/components/GpuCalculator.md` — leaf folder documentation for the new `frontend/src/components/GpuCalculator/` directory.
- **Documented** `HardwareFormSection.jsx` — controlled form section with two number inputs (total VRAM + GPU memory utilization), inline validation, dynamic percentage hint, fully stateless props-based data flow.
