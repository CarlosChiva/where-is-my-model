# `utils`

> Path: `frontend/src/utils/`
> Last updated: 2026-06-07
> Type: Leaf folder

General-purpose utility module for the GPU Infrastructure Dashboard frontend. Provides three files covering client-side numerical calculation of VRAM budgets for LLM model fitting (calculatorEngine), GPU visualization colour mapping and value clamping with per-GPU usage computation, and client-side form validation for PC and Service entities. These utilities are designed to be imported on-demand by React components and editor modules.

---

## 📄 `calculatorEngine.js`

Pure calculation engine for estimating VRAM requirements when loading a large-language model (LLM) onto one or more GPUs. Supports seven distinct attention architectures: **MHA**, **GQA**, **MQA**, **MLA** (Gemma 4, DeepSeek-V2), **MLA_ROPE** (DeepSeek-V3 / R1), **SWA** (Mistral 7B v0.1), and **SWA_GLOBAL** (Gemma 2, Phi-3). Every public function validates its arguments and returns `null` on incomplete or invalid input instead of a silently wrong value. All size results are rounded to two decimal places via the private `_round()` helper. Zero external imports; the module has one internal dependency — it defines two exported validation helpers (`validateInput`, `validatePositive`) that all other functions use internally.

### Imports and dependencies

None — entirely self-contained. No external or internal imports.

### Constants

| Constant | Type | Purpose |
|----------|------|---------|
| `REQUIRED_FIELDS_BY_TYPE` | `Object<string, string[]> ` | Maps each attention type key (`MHA`, `GQA`, `MQA`, `MLA`, `MLA_ROPE`, `SWA`, `SWA_GLOBAL`) to the list of field names that must be present and strictly positive before KV cache calculation can proceed. E.g., `MLA` requires `['kv_lora_rank']`; `SWA_GLOBAL` requires `['num_key_value_heads', 'head_dim', 'sliding_window', 'num_sliding_layers']`. |

### Helper (not exported)

- **`_round(n: number) → number`**
  Rounds a numeric value to two decimal places using `Math.round(n * 100) / 100`. Internal helper used by every public function.

### Functions

- **`validateInput(value: any, fallback?: number = null) → number | null`**
  Guards against `null`, `undefined`, empty string, `NaN`, and negative values. Coerces the input via `parseFloat()`, rounds to 2 decimal places, and returns the optional `fallback` whenever the guard fires. If `fallback` is omitted, returns `null`. This distinguishes "not provided" from "zero" for callers.
  - `value`: Any value — number, numeric string, etc.
  - `fallback`: Default returned when validation fails (default: `null`). When provided and a negative number is detected specifically (type `number`), a `console.warn` is emitted.
  - **Returns:** A validated, non-negative, rounded number or `fallback`, or `null` if neither value nor fallback are valid.

- **`validatePositive(value: any, fallback?: number = null) → number | null`**
  Like `validateInput` but also rejects zero. Used for fields that must be strictly positive (heads, dims, ranks…). Internally calls `validateInput()` first, then checks the result is non-zero.
  - `value`: Any value — number, numeric string, etc.
  - `fallback`: Default returned when validation fails (default: `null`).
  - **Returns:** A validated, strictly positive, rounded number or `fallback`, or `null`.

- **`validateRequiredFields(attention_type: string, fields: object) → { valid: boolean, missing: string[] }`**
  Checks that all fields required for a given attention type (looked up via `REQUIRED_FIELDS_BY_TYPE`) are present in the `fields` object and strictly positive. Each candidate field is parsed with `parseFloat()`; absent, empty, `NaN`, or ≤ 0 values contribute to the `missing` array.
  - `attention_type`: One of `MHA`, `GQA`, `MQA`, `MLA`, `MLA_ROPE`, `SWA`, `SWA_GLOBAL`.
  - `fields`: Object keyed by field name (e.g., `{ kv_lora_rank: 512, sliding_window: 4096 }`).
  - **Returns:** `{ valid: boolean, missing: string[] }`. `valid` is `true` iff `missing` has zero entries.

- **`calculateModelSizeGB(num_parameters: number|string, dtype_bytes: number|string) → number | null`**
  Estimates raw model-weight memory in gigabytes by multiplying parameter count by bytes-per-parameter and dividing by 1024³ (GiB for accuracy against real VRAM figures). Caller must provide absolute parameter count. The UI form collects billions and converts via multiplication by 1e9 before calling. Returns `null` if either input is invalid or non-positive.
  - `num_parameters`: Total trainable parameters in absolute units (caller responsibility to convert from billions if needed; e.g., a user entering "7" in the UI becomes `7_000_000_000`).
  - `dtype_bytes`: Bytes per parameter — FP32→4, BF16/FP16→2, INT8→1, INT4→0.5.
  - **Returns:** Model weight size in GB rounded to 2 dp, or `null` if inputs are invalid.

- **`calculateKvCachePerSeqGB(num_hidden_layers, num_key_value_heads, head_dim, max_model_len, kv_cache_dtype_bytes, attention_type = 'GQA', kv_lora_rank = '', qk_rope_head_dim = '', sliding_window = '', num_sliding_layers = '') → number | null`**
  Architecture-aware per-sequence KV cache computation. Dispatches to different formulas depending on `attention_type`. Returns `null` when any required field for the selected architecture is missing or zero (checked via `validatePositive`).

  **Dispatch logic:**
  - **MLA:** `(layers × kv_lora_rank × seqLen × dtypeB) / 1024³`
  - **MLA_ROPE:** `(layers × (kv_lora_rank + qk_rope_head_dim) × seqLen × dtypeB) / 1024³`
  - **SWA:** `2 × layers × heads × dim × min(seqLen, sliding_window) × dtypeB / 1024³`
  - **SWA_GLOBAL:** Splits layers into `swaLayers = min(num_sliding_layers, layers)` and `globalLayers = layers - swaLayers`. Computes two separate byte totals (window-clipped for SWA layers, full-sequence for global layers) and sums them.
  - **MHA / GQA / MQA (default):** `2 × layers × heads × dim × seqLen × dtypeB / 1024³`

  - `num_hidden_layers`: Transformer depth.
  - `num_key_value_heads`: Key/value head count (MHA/GQA/MQA/SWA only).
  - `head_dim`: Dimension per head (MHA/GQA/MQA/SWA only).
  - `max_model_len`: Maximum context / sequence length.
  - `kv_cache_dtype_bytes`: Bytes per KV cache element.
  - `attention_type`: Architecture selector string (default: `'GQA'`).
  - `kv_lora_rank`: Low-rank dimension (MLA / MLA_ROPE only).
  - `qk_rope_head_dim`: RoPE head dimension (MLA_ROPE only).
  - `sliding_window`: Window size for SWA computation.
  - `num_sliding_layers`: Number of layers using sliding window in SWA_GLOBAL mode.
  - **Returns:** Per-sequence KV cache in GB rounded to 2 dp, or `null` if required inputs are incomplete.

- **`calculateTotalKvCacheGB(kv_cache_per_seq_gb: number|null, max_num_seqs: number|string) → number | null`**
  Multiplies per-sequence KV by the maximum concurrent request count. Returns `null` immediately if `kv_cache_per_seq_gb` is `null` (incomplete upstream inputs).
  - `kv_cache_per_seq_gb`: Per-sequence KV cache size from `calculateKvCachePerSeqGB`.
  - `max_num_seqs`: Maximum concurrent sequence / request count.
  - **Returns:** Total aggregate KV cache in GB, or `null`.

- **`getAvailableVram(vram_total_gb: number|string, gpu_memory_utilization: number|string) → number | null`**
  Computes the usable VRAM on a GPU by multiplying physical VRAM by a utilization ceiling fraction. Default ceiling is `0.90` (10 % headroom reserved). Returns `null` on invalid inputs.
  - `vram_total_gb`: Physical VRAM (e.g., `80` for an A100).
  - `gpu_memory_utilization`: Fraction of VRAM available, range `[0, 1]`. Defaults to `0.90` if missing.
  - **Returns:** Available VRAM in GB rounded to 2 dp, or `null`.

- **`getUsedVramWithPrefixCache(model_size_gb, kv_cache_per_seq_gb, max_num_seqs, prefix_cache_hit_ratio, activation_overhead_gb = 1.5) → number | null`**
  Computes effective VRAM consumption using a prefix-caching model: shared KV cache is stored once (`kv_per_seq × hit_ratio`), while the unique portion is replicated per sequence (`kv_per_seq × (1 - hit_ratio) × N`). Activation overhead defaults to 1.5 GB. Returns `null` if `model_size_gb` or `kv_cache_per_seq_gb` are `null`.
  - `model_size_gb`: Raw model weight size from `calculateModelSizeGB`.
  - `kv_cache_per_seq_gb`: Per-sequence KV cache size (NOT the total aggregate).
  - `max_num_seqs`: Maximum concurrent sequences.
  - `prefix_cache_hit_ratio`: Fraction of KV cache covered by shared prefix (`0` = no benefit, `1` = fully deduplicated). Clamped to `[0, 1]`.
  - `activation_overhead_gb`: Fixed overhead for activation memory (default: `1.5`).
  - **Returns:** Used VRAM in GB (`modelSize + effectiveKv + overhead`), or `null`.

- **`calculatePrefixCacheSavingsGB(kv_cache_per_seq_gb, max_num_seqs, prefix_cache_hit_ratio) → number | null`**
  Computes the VRAM saved by enabling prefix caching compared to no caching at all. Formula: `savings = kv_per_seq × hit_ratio × max(0, num_seqs - 1)`. Returns `null` if upstream inputs are incomplete.
  - `kv_cache_per_seq_gb`: Per-sequence KV cache size.
  - `max_num_seqs`: Concurrent sequence count.
  - `prefix_cache_hit_ratio`: Shared prefix coverage ratio. Clamped to `[0, 1]`.
  - **Returns:** VRAM savings in GB rounded to 2 dp, or `null`.

- **`getRemainingVram(available_vram_gb, used_vram_gb) → number | null`**
  Returns free VRAM after allocation. The result is floored at zero via `Math.max(0, …)` so over-committed configurations do not go negative. Returns `null` if either input is `null`.
  - `available_vram_gb`: Available VRAM from `getAvailableVram`.
  - `used_vram_gb`: Used VRAM from `getUsedVramWithPrefixCache`.
  - **Returns:** Remaining VRAM in GB clamped to ≥ 0, or `null`.

- **`getVramUsagePercent(used_vram_gb, available_vram_gb) → number | null`**
  Computes VRAM utilisation as a percentage for UI colour-coding. Includes division-by-zero protection: returns `null` when `available ≤ 0`. Returns `null` if either input is `null`.
  - `used_vram_gb`: Used VRAM in GB.
  - `available_vram_gb`: Available VRAM in GB.
  - **Returns:** Utilisation percentage (0–100+), rounded to 2 dp. Returns `null` on invalid or zero inputs.

---

## 📄 `gpuHelpers.js`

GPU-dashboard-specific helper functions covering Tailwind colour mapping, numeric clamping, per-GPU VRAM consumption aggregation, and remaining-VRAM queries. All four functions are named exports usable independently. Entirely self-contained — no external or internal imports. Every function is a pure function with JSDoc annotations. Handles legacy data that lacks `assignedGpu` by treating such services as assigned to GPU 0.

### Imports and dependencies

None — entirely self-contained. No external or internal imports.

### Functions

- **`getGpuColorClass(percent: number) → string`**
  Maps a GPU utilisation percentage to a Tailwind-compatible background-colour utility class name.
  - `percent`: A numeric percentage (0–100+). Thresholds: ≤ 35 returns `'bg-gpu-green'` (#3fb950), 36–70 returns `'bg-gpu-yellow'` (#d29922), > 70 returns `'bg-gpu-red'` (#f85149).
  - **Returns:** The corresponding CSS class name string.

- **`clamp(value: any, min: number = 0, max: number = 100) → number`**
  Restricts a numeric value to an inclusive `[min, max]` range. Converts the input via `Number()` first; if the result is `NaN`, returns `min` as a fallback.
  - `value`: The value to clamp (any type, coerced to `number`).
  - `min`: Lower bound of the allowed range (default: `0`).
  - `max`: Upper bound of the allowed range (default: `100`).
  - **Returns:** A number between `min` and `max`, inclusive.

- **`computeGpuUsage(gpus: Array<{ name: string, vram: number }>, services?: ?Array<Object>) → Array<{ gpuIndex: number, name: string, totalVram: number, usedVram: number }>`**
  Computes per-GPU VRAM consumption by aggregating service GPU usage against a PC's gpus array. Iterates the `gpus` array with `.map()`, filters `services` for each GPU index via `(svc.assignedGpu ?? 0) === idx` (falling back to index 0 for legacy data lacking `assignedGpu`), then reduces the filtered services' `.gpu` field into a sum. Safely handles a missing or non-array `services` argument by defaulting to `[]`.
  - `gpus`: Array of `{ name: string, vram: number }` objects describing each GPU attached to a PC.
  - `services`: Optional array of service objects with `.gpu` (VRAM consumed in GB) and optionally `.assignedGpu` (zero-based GPU index). If omitted or not an array, defaults to `[]`.
  - **Returns:** Array of `{ gpuIndex, name, totalVram, usedVram }` — one entry per GPU in the input `gpus` array, preserving original order.

- **`getRemainingVram(gpus: Array<Object>, services?: ?Array<Object>, gpuIndex: number) → number`**
  Returns free (unused) VRAM in GB on a specific GPU index. Computes total VRAM from `gpus[gpuIndex].vram`, subtracts the sum of `.gpu` for services assigned to that index using `(svc.assignedGpu ?? 0) === gpuIndex` as the filter predicate, and floors the result at 0 via `Math.max(0, …)`. Guards against out-of-bounds `gpuIndex`, null/undefined `gpus`, and missing `services` — returning `0` in all error cases.
  - `gpus`: Array of `{ name: string, vram: number }` objects.
  - `services`: Optional array of service objects with `.gpu` (VRAM consumed) and `.assignedGpu`. If omitted or not an array, defaults to `[]`.
  - `gpuIndex`: Zero-based index into the `gpus` array. Must be `>= 0` and `< gpus.length`; otherwise returns `0`.
  - **Returns:** Remaining VRAM in GB, clamped to a minimum of 0. Returns 0 for invalid inputs.

---

## 📄 `validators.js`

Client-side form validation for the two primary data entities managed by the dashboard: **PCs** (servers/GPU nodes) and **Services** (model inference workloads). Each function accepts a data object, checks field-level constraints, and returns an object containing a boolean `valid` flag and a keyed `errors` map with human-readable messages. Both functions are named exports. Imports `getRemainingVram` from `gpuHelpers.js` for per-GPU VRAM capacity checks during service validation.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `./gpuHelpers.js` | `getRemainingVram` | Internal |

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `IPV4_PATTERN` | `/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/` | Regex used to pre-validate the structure of an IPv4 address (four numeric groups separated by dots) before octet-range checking |

### Functions

- **`validatePcForm(data: ?Object) → { valid: boolean, errors: object, warnings: string[] }`**
  Validates a PC (server/GPU node) data object. Requires three fields: `nombre` (string), `ip` (IPv4 address string), and `gpus` (array of GPU definitions). The `gpus` field replaces the legacy scalar `vram` field — each GPU must have a `name` and `vram`. Missing GPU names are auto-populated with labels like `"GPU 1"`, emitting a warning. If the input is `null`/`undefined`, destructuring yields empty values and triggers errors (guarded by `data || {}`).
  - **`nombre`:** Must be a non-empty, trimmed string. Error key: `nombre`. Message: _"Server name is required."_
  - **`ip`:** Must be a non-empty string matching the IPv4 pattern AND each octet must fall in `[0, 255]`. Three possible errors on key `ip`: _"IP address is required."_, _"Must be a valid IPv4 address (e.g., 192.168.1.100)."_, or _"Each octet must be between 0 and 255."_
  - **`gpus`:** Must be a non-empty array. Each element requires:
    - `name` — a non-empty string (auto-populated to `"GPU {N}"` if missing, with a warning pushed). Error key: none for missing name (handled via auto-population).
    - `vram` — a positive number ≥ 1 GB. Error key: `gpus[{idx}]`. Message: _"GPU {N} VRAM must be a positive number (≥ 1 GB)."_
  - **Returns:** `{ valid: boolean, errors: object, warnings: string[] }`. `valid` is `true` iff `errors` has zero keys. `warnings` collects auto-naming notifications.

- **`validateServiceForm(data: Object, services?: ?Array, gpus?: ?Array) → { valid: boolean, errors: object }`**
  Validates a Service data object for the fields `nombre`, `puerto`, `gpu`, and `assignedGpu`. In addition to base field-level validation, performs per-GPU capacity checks when `services` and `gpus` are provided: (1) verifies the selected GPU index is within bounds of the `gpus` array, and (2) uses `getRemainingVram(gpus, services, assignedIdx)` to check that the requested VRAM fits on the *selected* GPU. The second and third arguments are optional for backward compatibility; when omitted or not arrays, capacity checks are silently skipped.
  - **`data`:** Object with properties:
    - **`nombre`**: Must be a non-empty, trimmed string. Error key: `nombre`. Message: _"Service name is required."_
    - **`puerto`**: Must be an integer between 1 and 65535. Error key: `puerto`. Message: _"Port must be a number between 1 and 65535."_
    - **`gpu`**: Must be a non-negative number (≥ 0). Error key: `gpu`. Message: _"GPU usage must be a number ≥ 0."_. Additionally, if the per-GPU capacity check is active and requested VRAM exceeds remaining capacity, error: _"Not enough free VRAM on {gpuName}. Only {remaining} GB remaining."_
    - **`assignedGpu`**: Must be present, coercible to a non-negative integer, and within bounds `[0, gpus.length)`. Error key: `assignedGpu`. Three possible errors: _"Please select a GPU for this service."_, _"GPU index must be a non-negative integer.",_ or _"Selected GPU index {N} is out of range."_
  - **`services`:** Optional. Existing services array on the target PC (excluding the entry under edit for capacity computation). Passed to `getRemainingVram`. For ADD: all current services. For EDIT: services minus the entry being edited.
  - **`gpus`:** Optional. The PC's `gpus[]` array (`[{ name, vram }]`). Used for bounds checking on `assignedGpu` and as input to `getRemainingVram`.
  - **Returns:** `{ valid: boolean, errors: { nombre?: string, puerto?: string, gpu?: string, assignedGpu?: string } }`. `valid` is `true` iff `errors` has zero keys.

---

## 🔄 Changes in this update

### Major rewrite — reflect current source code state (2026-06-07)

**Removed:**
- **`slugify.js`** — This file no longer exists in the source folder (`frontend/src/utils/`). Its documentation section has been removed. Module-level description updated from "four files" to "three files".

**calculatorEngine.js — complete overhaul:**
- **Added** `REQUIRED_FIELDS_BY_TYPE` constant: maps 7 attention architectures to required field name arrays.
- **Added** `validatePositive()` export: strict positive-number validator built on top of `validateInput`.
- **Added** `validateRequiredFields(attention_type, fields)` export: validates that all required fields for a given attention architecture are present and > 0; returns `{ valid, missing }`.
- **Rewrote** `calculateKvCachePerSeqGB`: old signature had 5 parameters (classic GQA formula only). New signature has 10 parameters with defaults, supporting MLA, MLA_ROPE, SWA, and SWA_GLOBAL dispatch. Default `attention_type` is `'GQA'`.
- **Updated** `validateInput` default parameter: was `fallback = 0`, now `fallback = null`. Returns `null` on missing inputs so callers can distinguish "not provided" from "zero". Added `console.warn` for detected negative numbers of type `number`.
- **Rewrote** `getUsedVramWithPrefixCache`: old signature had 3 params `(model_size_gb, total_kv_cache_gb, prefix_cache_hit_ratio)`. New signature has 5 params `(model_size_gb, kv_cache_per_seq_gb, max_num_seqs, prefix_cache_hit_ratio, activation_overhead_gb = 1.5)`. Now computes effective KV using a shared/unique split model internally rather than receiving an aggregate total. Returns `null` (not a fallback number) on incomplete inputs.
- **Added** `calculatePrefixCacheSavingsGB(kv_cache_per_seq_gb, max_num_seqs, prefix_cache_hit_ratio)`: new export that computes VRAM saved by enabling prefix caching.
- **Updated** all return types: functions now return `number | null` instead of always returning a number. The documentation for prior versions documented fallback-return behaviour; the current code returns `null` on invalid or incomplete inputs.

**validators.js — validatePcForm updated:**
- **`validatePcForm`**: The old docs described a scalar `vram` field. Current code validates a `gpus[]` array where each GPU has `{ name, vram }`. Missing GPU names are auto-populated (e.g., `"GPU 1"`) and a warning is pushed to the `warnings[]` output. Return type now includes `warnings: string[]`.
- **Module-level description** updated accordingly.

---

## 🔄 Previous changes (T12)

### T12 — validateServiceForm gains 3 arguments and per-GPU capacity validation
- `validateServiceForm` signature changed from `validateServiceForm(data)` to `validateServiceForm(data, services, gpus)`.
- **New parameter `services`**: existing services array on the target PC. Passed to `getRemainingVram` to compute already-consumed VRAM per GPU.
- **New parameter `gpus`**: the PC's `gpus[]` array (`[{ name, vram }]`). Used for assignedGpu bounds checking and as input to `getRemainingVram`.
- **New field validation: `assignedGpu`** — validates presence, non-negative integer coercion, and within-bounds check against `gpus.length`. Three possible errors.

### T1 — calculatorEngine.js added (GPU Calculator)
- Original addition of the calculation engine for VRAM estimation. Subsequently rewritten multiple times to support multi-architecture attention types and improved null-safety.

### Verification against current source (2026-06-07)
- **calculatorEngine.js** — Verified and re-documented. No functional changes detected since last documentation cycle. All exports (`REQUIRED_FIELDS_BY_TYPE`, `validateInput`, `validatePositive`, `validateRequiredFields`, `calculateModelSizeGB`, `calculateKvCachePerSeqGB` with 10-parameter signature, `calculateTotalKvCacheGB`, `getAvailableVram`, `getUsedVramWithPrefixCache`, `calculatePrefixCacheSavingsGB`, `getRemainingVram`, `getVramUsagePercent`), the private `_round()` helper, and all seven attention-architecture dispatch paths (MHA, GQA, MQA, MLA, MLA_ROPE, SWA, SWA_GLOBAL) remain consistent with source code. The null-safety contract (returning `null` rather than a silently wrong value on incomplete inputs) is confirmed intact.
