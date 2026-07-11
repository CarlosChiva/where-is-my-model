# `utils`

> Path: `frontend/src/utils/`
> Last updated: 2026-06-09
> Type: Composite folder

General-purpose utility module for the GPU Infrastructure Dashboard frontend. Contains a calculation engine for estimating VRAM requirements when loading LLM models onto GPUs (now orchestrated via a Strategy pattern across 13 attention architectures), shared validation/rounding helpers extracted into their own module to eliminate circular dependencies, GPU visualization colour mapping and per-GPU usage computation, and client-side form validation for PC and Service entities.

---

## 📁 Subfolders

| Folder | Documentation | Description |
|--------|--------------|-------------|
| `attentionStrategies/` | [see docs](./utils/attentionStrategies.md) | Strategy-pattern implementations for per-sequence KV cache computation across 13 distinct attention architectures, plus a registry (`index.js`) for lookup and type enumeration. |

---

## 📄 Direct files

### `calcHelpers.js`

> Shared calculation helpers extracted from the calculator engine for use by both the orchestrator (`calculatorEngine.js`) and all attention strategy modules. Eliminates circular dependencies by providing `_round`, `validateInput`, and `validatePositive` as a single self-contained import target. Contains no external or internal dependencies.

### Imports and dependencies

None — entirely self-contained. No external or internal imports.

### Functions

- **`_round(n: any) → number`**
  Rounds a numeric value to two decimal places using `Math.round(n * 100) / 100`. Internal helper used by every strategy and by the orchestrator public functions.
  - `n`: Any numeric value (or value coercible to number).
  - **Returns:** The value rounded to 2 decimal places.

- **`validateInput(value: any, fallback?: number = null) → number | null`**
  Guards against `null`, `undefined`, empty string, `NaN`, and negative values. Coerces the input via `parseFloat()`, rounds to 2 decimal places, and returns the optional `fallback` whenever the guard fires. If `fallback` is omitted, returns `null`. Emits a `console.warn` when a detected negative value is of type `number`.
  - `value`: Any value — number, numeric string, etc.
  - `fallback`: Default returned when validation fails (default: `null`). Uses fallback ?? null chain to handle edge cases where fallback itself is falsy.
  - **Returns:** A validated, non-negative, rounded number or `fallback`, or `null` if neither value nor fallback are valid.

- **`validatePositive(value: any, fallback?: number = null) → number | null`**
  Like `validateInput` but also rejects zero. Used for fields that must be strictly positive (heads, dims, ranks, layers…). Internally calls `validateInput()` first, then checks the result is non-zero (`n === null || n === 0`).
  - `value`: Any value — number, numeric string, etc.
  - `fallback`: Default returned when validation fails (default: `null`).
  - **Returns:** A validated, strictly positive, rounded number or `fallback`, or `null`.

---

### `calculatorEngine.js`

> Pure calculation engine orchestrator for the GPU Model Fitting Calculator. Refactored to Strategy pattern: no longer contains inline dispatch logic for attention architectures. Instead imports helpers from `calcHelpers.js` and uses the strategy registry (`attentionStrategies/index.js`) to dispatch per-sequence KV cache calculations based on the selected attention architecture. Maintains full backward compatibility — all original public exports retain their signatures (with an expanded parameter list in `calculateKvCachePerSeqGB` to accommodate new architectures). Supports 13 distinct attention types: **MHA**, **GQA**, **MQA**, **MLA**, **MLA_ROPE**, **SWA**, **SWA_GLOBAL**, **SWA_DUAL**, **LINEAR_ATTENTION**, **MAMBA**, **RWKV**, **HYBRID_MAMBA**, **HYBRID_DELTANET**. Re-exports `validateInput` and `validatePositive` from helpers for any external consumers that depend on the original import path.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `./calcHelpers.js` | `_round`, `validateInput` (aliased to `_validateInput`), `validatePositive` (aliased to `_validatePositive`) | Internal |
| `./attentionStrategies/index.js` | `getStrategy` | Internal |

### Re-exports

| Re-exported from | Original name | Exported as | Purpose |
|-----------------|---------------|-------------|---------|
| `calcHelpers.js` | `_round` | `_round` | Backward-compatible rounding helper. |
| `calcHelpers.js` | `validateInput` | `validateInput` | External consumers that previously imported from this module continue to work. |
| `calcHelpers.js` | `validatePositive` | `validatePositive` | Same as above — preserves original import path. |

### Constants

| Constant | Type | Purpose |
|----------|------|---------|
| `REQUIRED_FIELDS_BY_TYPE` | `Object<string, string[]>` | Maps each of 13 attention type keys to the list of field names that must be present and strictly positive before KV cache calculation can proceed. E.g., `MLA` requires `['kv_lora_rank']`; `SWA_GLOBAL` requires `['num_key_value_heads', 'head_dim', 'sliding_window', 'num_sliding_layers']`; `SWA_DUAL` requires 5 fields including architecture-specific global/head geometry and an Nth-layer pattern; new entries for `LINEAR_ATTENTION`, `MAMBA`, `RWKV`, `HYBRID_MAMBA`, `HYBRID_DELTANET`. |

### Functions

- **`validateRequiredFields(attention_type: string, fields: object) → { valid: boolean, missing: string[] }`**
  Checks that all fields required for a given attention type (looked up via `REQUIRED_FIELDS_BY_TYPE`) are present in the `fields` object and strictly positive. Each candidate field is parsed with `parseFloat()`; absent, empty, `NaN`, or ≤ 0 values contribute to the `missing` array. Uses `?? []` as fallback if the attention type has no entry.
  - `attention_type`: One of 13 supported architecture identifiers (`MHA`, `GQA`, `MQA`, `MLA`, `MLA_ROPE`, `SWA`, `SWA_GLOBAL`, `SWA_DUAL`, `LINEAR_ATTENTION`, `MAMBA`, `RWKV`, `HYBRID_MAMBA`, `HYBRID_DELTANET`).
  - `fields`: Object keyed by field name (e.g., `{ kv_lora_rank: 512, sliding_window: 4096 }`).
  - **Returns:** `{ valid: boolean, missing: string[] }`. `valid` is `true` iff `missing` has zero entries.

- **`calculateModelSizeGB(num_parameters: number|string, dtype_bytes: number|string) → number | null`**
  Estimates raw model-weight memory in gigabytes by multiplying parameter count by bytes-per-parameter and dividing by 1024³ (GiB for accuracy against real VRAM figures). Caller must provide absolute parameter count. Returns `null` if either input is invalid or non-positive. Internally uses `_validatePositive()` from helpers and `_round()` for output formatting.
  - `num_parameters`: Total trainable parameters in absolute units (caller responsibility to convert from billions if needed; e.g., a user entering "7" in the UI becomes `7_000_000_000`).
  - `dtype_bytes`: Bytes per parameter — FP32→4, BF16/FP16→2, INT8→1, INT4→0.5.
  - **Returns:** Model weight size in GB rounded to 2 dp, or `null` if inputs are invalid.

- **`calculateKvCachePerSeqGB(num_hidden_layers, num_key_value_heads, head_dim, max_model_len, kv_cache_dtype_bytes, attention_type = 'GQA', kv_lora_rank = '', qk_rope_head_dim = '', sliding_window = '', num_sliding_layers = '', sliding_window_pattern = '', num_global_key_value_heads = '', global_head_dim = '', attention_k_eq_v = false, num_attention_layers = '', deltanet_num_heads = '', deltanet_head_dim = '', linear_num_heads = '', linear_head_dim = '', state_size = '', hybrid_state_size = '', hidden_size = '') → number | null`**
  Orchestrator entry point for architecture-aware per-sequence KV cache computation. Validates the three mandatory common parameters (`num_hidden_layers`, `max_model_len`, `kv_cache_dtype_bytes`). Looks up the appropriate strategy via `getStrategy(attention_type)` — returns `null` immediately if no matching strategy exists. Passes all remaining parameters as a single object to the matched strategy's `calculateKvCachePerSeqGB()` method. Signature expanded to 22 parameters (was 10) to accommodate SWA_DUAL, LINEAR_ATTENTION, MAMBA, RWKV, HYBRID_MAMBA, and HYBRID_DELTANET architectures.

  **Parameters:**
  - `num_hidden_layers`: Transformer depth.
  - `num_key_value_heads`: Key/value head count (MHA/GQA/MQA/SWA/SWA_GLOBAL/SWA_DUAL/HYBRID).
  - `head_dim`: Dimension per head (MHA/GQA/MQA/SWA/SWA_GLOBAL/SWA_DUAL/HYBRID).
  - `max_model_len`: Maximum context / sequence length.
  - `kv_cache_dtype_bytes`: Bytes per KV cache element.
  - `attention_type`: Architecture selector string (default: `'GQA'`). One of 13 supported types.
  - `kv_lora_rank`: Low-rank dimension (MLA / MLA_ROPE only).
  - `qk_rope_head_dim`: RoPE head dimension (MLA_ROPE only).
  - `sliding_window`: Window size for SWA computation.
  - `num_sliding_layers`: Number of layers using sliding window in SWA_GLOBAL mode.
  - `sliding_window_pattern`: Nth-layer period for SWA_DUAL (e.g., 6 → every 6th layer is global).
  - `num_global_key_value_heads`: KV heads on global layers (SWA_DUAL only).
  - `global_head_dim`: Head dimension on global layers (SWA_DUAL only).
  - `attention_k_eq_v`: Boolean — if true, SWA_DUAL global layers use ×1 not ×2 multiplier.
  - `num_attention_layers`: Full-attention layer count (HYBRID_DELTANET / HYBRID_MAMBA).
  - `deltanet_num_heads`: Number of heads in DeltaNet recurrent component (HYBRID_DELTANET).
  - `deltanet_head_dim`: Dimensionality per DeltaNet head (HYBRID_DELTANET).
  - `linear_num_heads`: Number of linear attention heads (LINEAR_ATTENTION).
  - `linear_head_dim`: Dimensionality per linear attention head (LINEAR_ATTENTION).
  - `state_size`: Recurrent state size (MAMBA / RWKV).
  - `hybrid_state_size`: State size per Mamba layer in hybrid models (HYBRID_MAMBA).
  - `hidden_size`: Model hidden dimension (MAMBA / RWKV / HYBRID_MAMBA).
  - **Returns:** Per-sequence KV cache in GB rounded to 2 dp, or `null` if required inputs are incomplete or no strategy matches.

- **`calculateTotalKvCacheGB(kv_cache_per_seq_gb: number|null, max_num_seqs: number|string) → number | null`**
  Multiplies per-sequence KV by the maximum concurrent request count. Returns `null` immediately if `kv_cache_per_seq_gb` is `null` (incomplete upstream inputs). Uses `_validateInput` with fallback 0 for the per-sequence value (handles the case where it's a non-negative number) and `_validatePositive` for sequence count.
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

### `gpuHelpers.js`

> GPU-dashboard-specific helper functions covering Tailwind colour mapping, numeric clamping, per-GPU VRAM consumption aggregation, and remaining-VRAM queries. All four functions are named exports usable independently. Entirely self-contained — no external or internal imports. Every function is a pure function with JSDoc annotations. Handles legacy data that lacks `assignedGpu` by treating such services as assigned to GPU 0.

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

### `validators.js`

> Client-side form validation for the two primary data entities managed by the dashboard: **PCs** (servers/GPU nodes) and **Services** (model inference workloads). Each function accepts a data object, checks field-level constraints, and returns an object containing a boolean `valid` flag and a keyed `errors` map with human-readable messages. Both functions are named exports. Imports `getRemainingVram` from `gpuHelpers.js` for per-GPU VRAM capacity checks during service validation.

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
  - **`nombre`:** Must be a non-empty, trimmed string. Error key: `nombre`. Message: *"Server name is required."*
  - **`ip`:** Must be a non-empty string matching the IPv4 pattern AND each octet must fall in `[0, 255]`. Three possible errors on key `ip`: *"IP address is required."*, *"Must be a valid IPv4 address (e.g., 192.168.1.100)."*, or *"Each octet must be between 0 and 255."*
  - **`gpus`:** Must be a non-empty array. Each element requires:
    - `name` — a non-empty string (auto-populated to `"GPU {N}"` if missing, with a warning pushed). Error key: none for missing name (handled via auto-population).
    - `vram` — a positive number ≥ 1 GB. Error key: `gpus[{idx}]`. Message: *"GPU {N} VRAM must be a positive number (≥ 1 GB)."*
  - **Returns:** `{ valid: boolean, errors: object, warnings: string[] }`. `valid` is `true` iff `errors` has zero keys. `warnings` collects auto-naming notifications.

- **`validateServiceForm(data: Object, services?: ?Array, gpus?: ?Array) → { valid: boolean, errors: object }`**
  Validates a Service data object for the fields `nombre`, `puerto`, `gpu`, and `assignedGpu`. In addition to base field-level validation, performs per-GPU capacity checks when `services` and `gpus` are provided: (1) verifies the selected GPU index is within bounds of the `gpus` array, and (2) uses `getRemainingVram(gpus, services, assignedIdx)` to check that the requested VRAM fits on the *selected* GPU. The second and third arguments are optional for backward compatibility; when omitted or not arrays, capacity checks are silently skipped.
  - **`data`:** Object with properties:
    - **`nombre`**: Must be a non-empty, trimmed string. Error key: `nombre`. Message: *"Service name is required."*
    - **`puerto`**: Must be an integer between 1 and 65535. Error key: `puerto`. Message: *"Port must be a number between 1 and 65535."*
    - **`gpu`**: Must be a non-negative number (≥ 0). Error key: `gpu`. Message: *"GPU usage must be a number ≥ 0."*. Additionally, if the per-GPU capacity check is active and requested VRAM exceeds remaining capacity, error: *"Not enough free VRAM on {gpuName}. Only {remaining} GB remaining."*
    - **`assignedGpu`**: Must be present, coercible to a non-negative integer, and within bounds `[0, gpus.length)`. Error key: `assignedGpu`. Three possible errors: *"Please select a GPU for this service."*, *"GPU index must be a non-negative integer.",* or *"Selected GPU index {N} is out of range."*
  - **`services`:** Optional. Existing services array on the target PC (excluding the entry under edit for capacity computation). Passed to `getRemainingVram`. For ADD: all current services. For EDIT: services minus the entry being edited.
  - **`gpus`:** Optional. The PC's `gpus[]` array (`[{ name, vram }]`). Used for bounds checking on `assignedGpu` and as input to `getRemainingVram`.
  - **Returns:** `{ valid: boolean, errors: { nombre?: string, puerto?: string, gpu?: string, assignedGpu?: string } }`. `valid` is `true` iff `errors` has zero keys.

## 🔄 Changes in this update

- **`calculatorEngine.js`** — In `REQUIRED_FIELDS_BY_TYPE['HYBRID_MAMBA']`, the field name `'state_size'` was renamed to `'hybrid_state_size'`. This aligns the required-fields validator with the existing parameter name used by `calculateKvCachePerSeqGB()`, ensuring consistency across the public API.

---
