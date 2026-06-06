# `utils`

> Path: `frontend/src/utils/`
> Last updated: 2026-06-06
> Type: Leaf folder

General-purpose utility module for the GPU Infrastructure Dashboard frontend. Provides four files covering client-side numerical calculation of VRAM budgets for LLM model fitting (calculatorEngine), URL-slug generation, GPU visualization colour mapping and value clamping, and client-side form validation for PC and Service entities. These utilities are designed to be imported on-demand by React components and editor modules.

---

## 📄 `calculatorEngine.js`

Pure calculation engine for estimating VRAM requirements when loading a large-language model (LLM) onto one or more GPUs. Provides seven self-contained, pure functions with zero external or internal dependencies — every public function validates its arguments through the shared `validateInput()` helper and rounds all size results to two decimal places via the private `_round()` helper. All exports are named ES-module exports with full JSDoc (`@param`, `@returns`, `@example`) annotations.

### Imports and dependencies

None — entirely self-contained. No external or internal imports.

### Helper (not exported)

- **`_round(n: number) → number`**
  Rounds a numeric value to two decimal places using `Math.round(n * 100) / 100`. Internal helper used by every public function.

### Functions

- **`validateInput(value: any, fallback?: number = 0) → number`**
  Guards against `null`, `undefined`, `NaN`, empty string, and negative values. Coerces the input via `parseFloat()`, rounds to 2 decimal places, and returns the optional `fallback` (default `0`) whenever the guard fires. Serves as the universal input validator for all other functions in this module.
  - `value`: Any value — number, numeric string, etc.
  - `fallback`: Default returned when validation fails (default: `0`).
  - **Returns:** A validated, non-negative, rounded number or `fallback`.

- **`calculateModelSizeGB(num_parameters: number|string, dtype_bytes: number|string) → number`**
  Estimates raw model-weight memory in GB by multiplying parameter count by bytes-per-parameter and dividing by 1024³. The `dtype_bytes` parameter defaults to `2` (FP16/BF16) if invalid.
  - `num_parameters`: Total trainable parameters (e.g., `7_000_000_000` for a 7B model).
  - `dtype_bytes`: Bytes per parameter: FP16 → `2`, BF16 → `2`, FP32 → `4`, INT8 → `1`.
  - **Returns:** Model weight size in GB, rounded to 2 dp.

- **`calculateKvCachePerSeqGB(num_hidden_layers: number|string, num_key_value_heads: number|string, head_dim: number|string, max_model_len: number|string, kv_cache_dtype_bytes: number|string) → number`**
  Computes the per-sequence Key/Value cache footprint. The formula includes a `× 2` factor to account for both Key and Value caches independently. All parameters are validated; `kv_cache_dtype_bytes` defaults to `2`.
  - `num_hidden_layers`: Transformer depth (e.g., `32`).
  - `num_key_value_heads`: GQA/MQA heads count (e.g., `8`).
  - `head_dim`: Dimension of each key/value head (e.g., `128`).
  - `max_model_len`: Maximum context length / sequence length (e.g., `4096`).
  - `kv_cache_dtype_bytes`: Bytes per element in KV cache (FP16 → `2`, INT8 → `1`).
  - **Returns:** Per-sequence KV cache in GB, rounded to 2 dp.

- **`calculateTotalKvCacheGB(kv_cache_per_seq_gb: number|string, max_num_seqs: number|string) → number`**
  Multiplies per-sequence KV (from `calculateKvCachePerSeqGB`) by the maximum concurrent request count to obtain aggregate KV cache memory across all sequences.
  - `kv_cache_per_seq_gb`: Per-sequence KV cache size.
  - `max_num_seqs`: Maximum concurrent request count (e.g., `256`).
  - **Returns:** Total KV cache in GB, rounded to 2 dp.

- **`getAvailableVram(vram_total_gb: number|string, gpu_memory_utilization: number|string) → number`**
  Computes the usable VRAM on a GPU by multiplying physical VRAM by a utilization ceiling fraction (default `0.95`, meaning 5 % headroom is reserved).
  - `vram_total_gb`: Physical VRAM (e.g., `80` for an A100).
  - `gpu_memory_utilization`: Fraction of VRAM available to inference, range `[0, 1]`. Defaults to `0.95` if invalid.
  - **Returns:** Available VRAM in GB, rounded to 2 dp.

- **`getUsedVramWithPrefixCache(model_size_gb: number|string, total_kv_cache_gb: number|string, prefix_cache_hit_ratio: number|string) → number`**
  Computes effective VRAM consumption when prefix caching is active. The KV cache portion eligible for sharing across requests with a common prompt prefix is counted only once: `effectiveKV = totalKV * (1 - hitRatio)`. Result is `modelSize + effectiveKV`.
  - `model_size_gb`: Raw model weight size (from `calculateModelSizeGB`).
  - `total_kv_cache_gb`: Aggregate KV cache (from `calculateTotalKvCacheGB`).
  - `prefix_cache_hit_ratio`: Fraction of KV cache covered by shared prefix (`0` = no benefit, `1` = fully deduplicated).
  - **Returns:** Used VRAM in GB (model + effective KV), rounded to 2 dp.

- **`getRemainingVram(available_vram_gb: number|string, used_vram_gb: number|string) → number`**
  Returns the free VRAM remaining after allocation. The result is clamped to a minimum of `0` via `Math.max()` so that over-committed configurations do not produce negative numbers.
  - `available_vram_gb`: Available VRAM (from `getAvailableVram`).
  - `used_vram_gb`: Used VRAM (from `getUsedVramWithPrefixCache`).
  - **Returns:** Remaining VRAM in GB, clamped to ≥ 0, rounded to 2 dp.

- **`getVramUsagePercent(used_vram_gb: number|string, available_vram_gb: number|string) → number`**
  Computes VRAM utilisation as a percentage (`(used / available) × 100`), suitable for colour-coded progress bars in the UI. Includes division-by-zero protection: returns `0` when `available ≤ 0`.
  - `used_vram_gb`: Used VRAM in GB.
  - `available_vram_gb`: Total available VRAM in GB.
  - **Returns:** Utilisation percentage (0–100+), rounded to 2 dp. Returns `0` on division-by-zero.

---

## 📄 `slugify.js`

Produce a URL-safe slug from arbitrary text by applying Unicode normalisation, accent stripping, lowercasing, hyphenation of non-alphanumeric groups, collapsing consecutive hyphens, and removing leading/trailing hyphens. Exposed as the module's default export.

### Functions

- **`slugify(str) → string`**
  Transforms an input string into a kebab-case, URL-safe slug.
  - `str`: The text to slugify. If not a string, returns `''` immediately.
  - **Returns:** A lowercase, hyphen-separated slug suitable for use in URLs, CSS class names, or identifiers.

---

## 📄 `gpuHelpers.js`

GPU-dashboard-specific helper functions covering colour mapping, numeric clamping, per-GPU VRAM computation, and remaining-VRAM queries. All four functions are named exports usable independently. Entirely self-contained — no external or internal imports. Every function is a pure function with JSDoc annotations.

### Functions

- **`getGpuColorClass(percent) → string`**
  Maps a GPU utilisation percentage to a Tailwind-compatible background-colour utility class name.
  - `percent`: A numeric percentage (0—100+). Thresholds: ≤ 35 returns `'bg-gpu-green'` (`#3fb950`), 36–70 returns `'bg-gpu-yellow'` (`#d29922`), > 70 returns `'bg-gpu-red'` (`#f85149`).
  - **Returns:** The corresponding CSS class name string.

- **`clamp(value, min = 0, max = 100) → number`**
  Restricts a numeric value to an inclusive `[min, max]` range. Converts the input via `Number()` first; if the result is `NaN`, returns `min` as a fallback.
  - `value`: The value to clamp (any type, coerced to `number`).
  - `min`: Lower bound of the allowed range (default: `0`).
  - `max`: Upper bound of the allowed range (default: `100`).
  - **Returns:** A number between `min` and `max`, inclusive.

- **`computeGpuUsage(gpus, services) → Array<{ gpuIndex: number, name: string, totalVram: number, usedVram: number }>`**
  Computes per-GPU VRAM consumption by aggregating service GPU usage against a PC's gpus array. Iterates the `gpus` array with `.map()`, filters `services` for each GPU index (using `svc.assignedGpu` if present, falling back to index 0 for legacy data), then reduces the filtered services' `.gpu` field into a sum. Safely handles a missing or non-array `services` argument by defaulting to `[]`.
  - `gpus`: Array of `{ name: string, vram: number }` objects describing each GPU attached to a PC.
  - `services`: Optional array of service objects with `.gpu` (VRAM consumed, in GB) and optionally `.assignedGpu` (zero-based GPU index). If omitted or not an array, defaults to `[]`.
  - **Returns:** Array of `{ gpuIndex, name, totalVram, usedVram }` — one entry per GPU in the input `gpus` array, preserving original order.

- **`getRemainingVram(gpus, services, gpuIndex) → number`**
  Returns free (unused) VRAM in GB on a specific GPU index. Computes total VRAM from `gpus[gpuIndex].vram`, subtracts the sum of `.gpu` for services assigned to that index (with the same legacy fallback to GPU 0), and floors the result at 0 via `Math.max(0, ...)`. Guards against out-of-bounds `gpuIndex`, null/undefined `gpus`, and missing `services` — returning `0` in all error cases.
  - `gpus`: Array of `{ name: string, vram: number }` objects describing each GPU attached to a PC.
  - `services`: Optional array of service objects with `.gpu` (VRAM consumed) and `.assignedGpu`. If omitted or not an array, defaults to `[]`.
  - `gpuIndex`: Zero-based index into the `gpus` array. Must be `>= 0` and `< gpus.length`; otherwise returns `0`.
  - **Returns:** Remaining VRAM in GB, clamped to a minimum of 0. Returns 0 for invalid inputs (null/undefined gpus, out-of-bounds gpuIndex).

---

## 📄 `validators.js`

Client-side form validation for the two primary data entities in the dashboard: PCs (servers) and Services. Each function accepts a data object, checks field-level constraints, and returns an object containing a boolean `valid` flag and a keyed `errors` map with human-readable messages. Both functions are named exports. Imports `getRemainingVram` from `gpuHelpers.js` for per-GPU VRAM capacity checks (added in T12).

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `IPV4_PATTERN` | `/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/` | Regex used to pre-validate the structure of an IPv4 address (four numeric groups separated by dots) before octet-range checking |

### Functions

- **`validatePcForm(data) → { valid: boolean, errors: object }`**
  Validates a PC (server) data object for the required fields `nombre`, `ip`, and `vram`.
  - `data`: An object with optional properties `nombre` (string), `ip` (string — IPv4), `vram` (number — total VRAM in GB). If the input is `null`/`undefined`, destructuring yields empty values and triggers errors.
    - **`nombre`:** Must be a non-empty, trimmed string. Error: _"Server name is required."_
    - **`ip`:** Must be a non-empty string matching the IPv4 pattern AND each octet must fall in `[0, 255]`. Three possible errors: _"IP address is required."_, _"Must be a valid IPv4 address (e.g., 192.168.1.100)."_, or _"Each octet must be between 0 and 255."_
    - **`vram`:** Must be a positive number ≥ 1 GB. Error: _"Total VRAM must be a positive number (≥ 1 GB)."_
  - **Returns:** `{ valid: boolean, errors: { nombre?: string, ip?: string, vram?: string } }`. `valid` is `true` iff `errors` has zero keys.

- **`validateServiceForm(data, services, gpus) → { valid: boolean, errors: object }`** *(updated in T12)*
  Validates a Service data object for the required fields `nombre`, `puerto`, `gpu`, and NEW **`assignedGpu`**. In addition to base field-level validation, performs two per-GPU capacity checks: (1) verifies the selected GPU index is within bounds of the `gpus` array, and (2) uses `getRemainingVram(gpus, services, assignedIdx)` to check that the requested VRAM fits on the *selected* GPU — replacing the old aggregate-total-VRAM overflow check. The second and third arguments (`services`, `gpus`) are optional for backward compatibility; when omitted or not arrays, capacity checks are skipped.
  - **`data`:** An object with properties `nombre` (string), `puerto` (number — TCP/UDP port), `gpu` (number — VRAM in GB), and `assignedGpu` (number|string — zero-based GPU index). Same null-safety behaviour as `validatePcForm`.
    - **`nombre`:** Must be a non-empty, trimmed string. Error: _"Service name is required."_
    - **`puerto`:** Must be an integer between 1 and 65 535. Error: _"Port must be a number between 1 and 65535."_
    - **`gpu`:** Must be a non-negative number (≥ 0). Error: _"GPU usage must be a number ≥ 0."_ Additionally, if per-GPU capacity check is active and the requested VRAM exceeds remaining capacity on the selected GPU, error: _"Not enough free VRAM on {gpuName}. Only {remaining} GB remaining."_
    - **`assignedGpu`:** *(new in T12)* Validates that `assignedGpu` is present, coercible to a non-negative integer, and within bounds `[0, gpus.length)`. Errors: _"Please select a GPU for this service."_, _"GPU index must be a non-negative integer.",_ or _"Selected GPU index {N} is out of range."_
  - **`services`:** *(new optional parameter in T12)* Existing services array on the target PC. Used by `getRemainingVram` to compute what VRAM is already consumed on each GPU. For ADD: all current services. For EDIT: services minus the entry being edited (so its prior allocation is excluded).
  - **`gpus`:** *(new optional parameter in T12)* The PC's `gpus[]` array (`[{ name, vram }]`). Used for bounds checking on `assignedGpu` and as input to `getRemainingVram`.
  - **Returns:** `{ valid: boolean, errors: { nombre?: string, puerto?: string, gpu?: string, assignedGpu?: string } }`. `valid` is `true` iff `errors` has zero keys.

## 🔄 Changes in this update

- **Updated** `gpuHelpers.js` section: added documentation for two new functions — `computeGpuUsage(gpus, services)` and `getRemainingVram(gpus, services, gpuIndex)`.
  - Module description updated from "two named exports" to "four named exports."
  - Noted that all four exports are self-contained pure functions with JSDoc annotations.
- **computeGpuUsage**: documents per-GPU VRAM aggregation logic, legacy `assignedGpu` fallback to GPU 0, and null/undefined services guard (defaults to `[]`).
- **getRemainingVram**: documents free-VRAM calculation for a specific GPU index, out-of-bounds / null input guards returning 0, and the `Math.max(0, ...)` floor.
- **Updated** last-updated date to `2026-06-05`.

### T12 — validateServiceForm gains 3 arguments and per-GPU capacity validation
- **Updated** module description: now imports `getRemainingVram` from `gpuHelpers.js` (no longer entirely self-contained).
- **Rewrote** `validateServiceForm` signature: was `validateServiceForm(data)`, now `validateServiceForm(data, services, gpus)`.
  - **New parameter `services`**: existing services array on the target PC. Passed to `getRemainingVram` to compute already-consumed VRAM per GPU.
  - **New parameter `gpus`**: the PC's `gpus[]` array (`[{ name, vram }]`). Used for assignedGpu bounds checking and as input to `getRemainingVram`.
  - **New field validation: `assignedGpu`** — validates presence, non-negative integer coercion, and within-bounds check against `gpus.length`. Three possible errors: *"Please select a GPU for this service."*, *"GPU index must be a non-negative integer."*, *"Selected GPU index {N} is out of range."*
  - **Per-GPU capacity check** — replaces the old aggregate-total-VRAM overflow. Calls `getRemainingVram(gpus, services, assignedIdx)` and checks if the requested `gpu` value exceeds remaining VRAM on the *selected* GPU. Error message now names the specific GPU: *"Not enough free VRAM on {gpuName}. Only {remaining} GB remaining."*
  - **Backward compatibility** — `services` and `gpus` are optional; when omitted or not arrays, capacity checks are silently skipped so the function still works as a simple validator.
- **Updated** return type: errors object now includes `assignedGpu?: string`.

### T1 — calculatorEngine.js added (GPU Calculator)
- **Added new file documentation** for `calculatorEngine.js`: pure calculation engine for estimating VRAM requirements when loading LLM models onto GPUs.
  - 8 total functions documented (7 public exports + 1 private helper `_round`).
  - 0 external dependencies, 0 internal imports — entirely self-contained.
  - Every public function validates arguments via `validateInput()` and rounds results to 2 dp.
  - Full JSDoc coverage: each export has `@param`, `@returns`, and `@example`.
  - Functions cover: model weight size (`calculateModelSizeGB`), per-sequence KV cache (`calculateKvCachePerSeqGB`), total KV cache (`calculateTotalKvCacheGB`), available VRAM with utilisation ceiling (`getAvailableVram`), effective used VRAM with prefix caching (`getUsedVramWithPrefixCache`), remaining free VRAM (`getRemainingVram`), and utilization percentage for UI colour-coding (`getVramUsagePercent`).
- **Updated** module-level description: count changed from "three focused helper files" to "four files", added reference to `calculatorEngine`.
- **Updated** last-updated date to `2026-06-06`.
