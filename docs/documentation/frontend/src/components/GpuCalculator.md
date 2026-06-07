# GpuCalculator

> Path: `frontend/src/components/GpuCalculator`
> Last updated: 2026-06-07
> Type: Leaf folder

This folder implements a **GPU VRAM Calculator** — an interactive React page that lets users estimate how much GPU video memory (VRAM) is required to run a large language model under various configurations. It covers model architecture parameters, attention variants, precision/quantization, hardware specs, workload settings, and live visualised results with colour-coded usage bars and warnings.

---

## 📄 GPUCalculatorPage.jsx

Orchestrator React component that owns all form state via `useState`, delegates rendering to four child form sections, feeds computed results to the display panel, and provides a reset-to-defaults button. Acts as the single entry point for GPU Calculator UI.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `useState` | External |
| `./ModelFormSection` | `default` (component) | Internal |
| `./PrecisionFormSection` | `default` (component) | Internal |
| `./HardwareFormSection` | `default` (component) | Internal |
| `./WorkloadFormSection` | `default` (component) | Internal |
| `./ResultsDisplay` | `default` (component) | Internal |
| `../../utils/calculatorEngine.js` | `calculateModelSizeGB`, `calculateKvCachePerSeqGB`, `calculateTotalKvCacheGB`, `getAvailableVram`, `getUsedVramWithPrefixCache`, `calculatePrefixCacheSavingsGB`, `getRemainingVram`, `getVramUsagePercent` | Internal |

### Module-level constants

- **`DEFAULT_STATE`** *(Object)* — Plain-object containing all default string values for every form field across Model, Precision, Hardware, and Workload sections. Serves as the initial React state and the reset target.

### Component

#### `GPUCalculatorPage` (default export — function component)

Top-level page that manages a single `formState` object and computes derived VRAM metrics on every render.

**Props:** none

**Internal helpers:**

- **`handleChange(fieldName: string, value: string) → void`**
  Updates one key of `formState` via the controlled-component callback pattern. Re-spreads previous state and overwrites `[fieldName]`.
  - `fieldName`: the field identifier (e.g., `'num_hidden_layers'`, `'vram_total_gb'`).
  - `value`: the raw string value from the input element's `onChange` event target.

- **`handleReset() → void`**
  Resets `formState` to a shallow clone of `DEFAULT_STATE`.

**Derived computations (re-evaluated each render):**

| Variable | Source function(s) | Description |
|----------|--------------------|-------------|
| `modelSizeGB` | `calculateModelSizeGB(num_parameters, dtype_bytes)` | Weight memory footprint in GB. |
| `kvCachePerSeqGB` | `calculateKvCachePerSeqGB(...)` | KV cache size per sequence, accounting for attention type and all related dims. |
| `totalKvCacheGB` | `calculateTotalKvCacheGB(kvCachePerSeqGB, max_num_seqs)` | Aggregate KV cache across concurrent sequences. |
| `availableVramGB` | `getAvailableVram(vram_total_gb, gpu_memory_utilization)` | Usable VRAM after accounting for the utilization fraction. |
| `usedVramGB` | `getUsedVramWithPrefixCache(...)` | Effective VRAM consumption including model weights, KV cache reduced by prefix-cache hit ratio, and activation overhead. |
| `prefixCacheSavingsGB` | `calculatePrefixCacheSavingsGB(kvCachePerSeqGB, max_num_seqs, prefix_cache_hit_ratio)` | How many GB the shared-prefix cache saves vs naively materialising every sequence from scratch. |
| `remainingVramGB` | `getRemainingVram(availableVramGB, usedVramGB)` | Free VRAM = available − used. |
| `vramUsagePercent` | `getVramUsagePercent(usedVramGB, availableVramGB)` | Percentage fill level of the GPU memory. |

**Rendered children:**

| Child component | Passed props | Location in layout |
|-----------------|-------------|--------------------|
| `<ModelFormSection>` | `{ values: formState, onChange: handleChange }` | Left grid (2×2) — top-left card |
| `<PrecisionFormSection>` | `{ values: formState, onChange: handleChange }` | Left grid — top-right card |
| `<HardwareFormSection>` | `{ values: formState, onChange: handleChange }` | Left grid — bottom-left card |
| `<WorkloadFormSection>` | `{ values: formState, onChange: handleChange }` | Left grid — bottom-right card |
| `<ResultsDisplay>` | `{ results: { modelSizeGB, kvCachePerSeqGB, totalKvCacheGB, availableVramGB, usedVramGB, remainingVramGB, vramUsagePercent, prefixCacheSavingsGB, activationOverheadGB } }` | Sticky right sidebar (lg breakpoint) |

---

## 📄 ModelFormSection.jsx

Controlled, stateless form section for the model's architectural parameters. Dynamically shows/hides fields based on the selected attention architecture variant and reports missing required-field validation errors via `calculatorEngine.validateRequiredFields`.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `../../utils/calculatorEngine.js` | `validateRequiredFields`, `REQUIRED_FIELDS_BY_TYPE` | Internal |

### Component

#### `ModelFormSection` (default export — function component)

Renders a heading "📐 Modelo", an attention-architecture `<select>`, conditional number inputs, and a validation banner when required fields are absent.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `values` | `Object` | `{}` | Current field values (same shape as `DEFAULT_STATE`). |
| `onChange` | `(fieldName: string, value: string) => void` | — | Callback to propagate changes to the parent. |

**Internal helper (rendered as JSX inside the component):**

- **`renderInput({ id, label, hint, placeholder, step, min }) → JSX.Element`**
  Renders a single number-input row with label, `*` required marker, value binding, validation highlighting (`border-danger`), and error/hint text. Validates non-positive values as errors; marks a field invalid if it is both required (per current attention type) and empty.

**Conditionally rendered fields depending on `attention_type`:**

| Attention type | Fields shown beyond "always visible" |
|----------------|-------------------------------------|
| **MHA / GQA / MQA / SWA / SWA_GLOBAL** | `num_key_value_heads`, `head_dim` (classic KV path) |
| **MLA** | `kv_lora_rank` |
| **MLA_ROPE** | `kv_lora_rank`, `qk_rope_head_dim` |
| **SWA / SWA_GLOBAL** | `sliding_window` |
| **SWA_GLOBAL only** | `num_sliding_layers` (additional) |

"Always visible" fields: `num_hidden_layers`, `hidden_size`, `num_parameters`.

---

## 📄 PrecisionFormSection.jsx

Controlled, stateless form section with two `<select>` dropdowns for model weight precision and KV-cache precision. No local state; communicates exclusively via the `onChange` callback.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `Fragment` | External |

### Component

#### `PrecisionFormSection` (default export — function component)

Renders a heading "🔢 Precisión y cuantización" and two selects.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `values` | `Object` | `{}` | Contains `dtype_bytes` and `kv_cache_dtype_bytes`. |
| `onChange` | `(fieldName: string, value: string) => void` | — | Callback propagated to the parent. |

**Options for each precision `<select>`:**

| Label | Value (bytes) |
|-------|---------------|
| float32 | `4` |
| bfloat16 / float16 | `2` |
| int8 | `1` |
| int4 | `0.5` |

---

## 📄 HardwareFormSection.jsx

Controlled, stateless form section for GPU hardware parameters: total VRAM, memory utilization fraction, and activation overhead buffer. Includes inline validation with human-readable error messages in English.

### Imports and dependencies

None beyond React (implicit).

### Component

#### `HardwareFormSection` (default export — function component)

Renders a heading "🖥️ Hardware" and three number-input rows driven by a local `fields` configuration array.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `values` | `Object` | `{}` | Contains `vram_total_gb`, `gpu_memory_utilization`, `activation_overhead_gb`. |
| `onChange` | `(fieldName: string, value: string) => void` | — | Callback to propagate changes. |

**Fields defined in the local `fields` array:**

| Field id | Label | Hint / constraint | Validation rule | Error message |
|----------|-------|--------------------|-----------------|---------------|
| `vram_total_gb` | Total VRAM (GB) | "Memoria total de la GPU en gigabytes (e.g. 80 para una A100 80 GB)" | Must be > 0 | "Must be a positive number." |
| `gpu_memory_utilization` | GPU Memory Utilization | Dynamically shows "Usando el X% de la VRAM" when value is provided | Must be in (0, 1] | "Must be between 0 and 1." |
| `activation_overhead_gb` | Activation Overhead (GB) | "Buffer para activaciones, CUDA Graphs y runtime de PyTorch. Recomendado: 1.5–3 GB con speculative decoding" | Must be ≥ 0 | "Must be 0 or greater." |

---

## 📄 WorkloadFormSection.jsx

Controlled, stateless form section for workload / inference parameters: context length, concurrency, prompt/output lengths, and prefix-cache hit ratio. Includes inline validation (positive numbers; ratio bounded to [0, 1]).

### Imports and dependencies

None beyond React (implicit).

### Component

#### `WorkloadFormSection` (default export — function component)

Renders a heading "🎯 Carga de trabajo" and five number-input rows driven by a local `fields` configuration array.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `values` | `Object` | `{}` | Contains `max_model_len`, `max_num_seqs`, `avg_prompt_len`, `avg_output_len`, `prefix_cache_hit_ratio`. |
| `onChange` | `(fieldName: string, value: string) => void` | — | Callback propagated to the parent. |

**Fields defined in the local `fields` array:**

| Field id | Label | Default | Validation |
|----------|-------|---------|------------|
| `max_model_len` | Max Model Length | 4096 | Must be > 0 |
| `max_num_seqs` | Max Num Sequences | 256 | Must be > 0 |
| `avg_prompt_len` | Avg Prompt Length | 256 | Must be > 0 |
| `avg_output_len` | Avg Output Length | 1024 | Must be > 0 |
| `prefix_cache_hit_ratio` | Prefix Cache Hit Ratio | 0.5 | Must be in [0, 1] |

---

## 📄 ResultsDisplay.jsx

Presentation component that renders a summary card with progress bar and colour-coded VRAM usage indicator, plus per-metric rows each with optional mini progress bars. Imports helper utilities for colour classes and value clamping. Handles empty-data and partial-data guard states gracefully.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `../../utils/gpuHelpers.js` | `clamp`, `getGpuColorClass` | Internal |

### Module-level constants

- **`METRIC_ROWS`** *(Array\<Object\>)* — Configuration table for each metric row: label, data key, unit, whether to show a progress bar (`showBar` flag), and whether to invert the colour logic (`invertColor`). Seven rows: Model Weights, KV Cache / Sequence, Total KV Cache, Available VRAM, Used VRAM (effective), Remaining VRAM, Prefix Cache Savings.

- **`WARNING_THRESHOLD`** *(number = 80)* — Percentage above which the VRAM usage indicator is flagged as a warning and receives an animation class (`animate-gpu-warning`).

### Functions

- **`fmt(value: number | null | undefined) → string`**
  Formats a numeric value to two decimal places; returns `'—'` for null/undefined inputs.
  - `value`: the metric value (may be null when data is incomplete).
  - **Returns:** formatted string like `"12.34"` or `"—"`.

### Component

#### `ResultsDisplay` (default export — function component)

Displays the GPU VRAM calculation results with visual bars, colour coding (green / yellow / red), and warning states.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `results` | `Object` | — | Computed metrics: `{ modelSizeGB, kvCachePerSeqGB, totalKvCacheGB, availableVramGB, usedVramGB, remainingVramGB, vramUsagePercent, prefixCacheSavingsGB }`. Keys may be `null` when the engine could not compute them. |
| `missingFields` | `Array<string>` | `[]` | Reserved for listing which input fields caused incomplete results (defined in the signature; currently unused in JSX logic). |

**Guard states:**

1. **Empty state** — rendered when `availableVramGB` or `modelSizeGB` is null/non-positive. Shows a placeholder card with "Sin resultados" / "Rellena los campos del formulario para ver la estimación de VRAM."
2. **KV incomplete warning** — shown as a yellow banner when `kvCachePerSeqGB === null`. Warns the user that KV cache was not calculated and remaining values are partial.

**Summary card logic:**
- Computes `usagePercent` by clamping `vramUsagePercent` to [0, 100].
- Derives `colorClass` via `getGpuColorClass(usagePercent)` → CSS class: green (< threshold), yellow (warning zone), red (near-saturated).
- If `usagePercent > WARNING_THRESHOLD`, applies the `animate-gpu-warning` animation.
- Renders an ARIA-accessible progress bar (`role="progressbar"`).

---

## Architecture overview and data flow

```
GPUCalculatorPage.jsx (owns state)
  ├── handleChange ←── ModelFormSection.jsx
  ├── handleChange ←── PrecisionFormSection.jsx
  ├── handleChange ←── HardwareFormSection.jsx
  ├── handleChange ←── WorkloadFormSection.jsx
  │
  ├── [8 calculator functions] ── utils/calculatorEngine.js
  │
  └── results: { … } ─→ ResultsDisplay.jsx
                             └── clamp, getGpuColorClass ── utils/gpuHelpers.js
```

1. The user edits any input in one of the four form sections → `onChange(fieldName, value)` is invoked on the shared callback from `GPUCalculatorPage`.
2. `handleChange` updates the single `formState` object via React state.
3. On every render, eight functions from `utils/calculatorEngine.js` are called synchronously to produce derived metrics.
4. The resulting `results` object is passed down to `ResultsDisplay`, which formats it, clamps percentages, determines colour classes via `gpuHelpers.js`, and renders bars/warnings.

### Key design patterns

- **Lifted state:** All form data lives in the page component; sub-sections are purely controlled presenters.
- **Declarative field arrays:** `HardwareFormSection` and `WorkloadFormSection` each define their inputs as configuration arrays, enabling uniform rendering.
- **Conditional model form fields:** `ModelFormSection` dynamically shows/hides architectural fields based on the selected attention type.
- **External engine coupling:** All numerical calculations are outsourced to `../../utils/calculatorEngine.js`, keeping components side-effect-free with respect to arithmetic logic.
