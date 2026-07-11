# `attentionStrategies`

> Path: `frontend/src/utils/attentionStrategies/`
> Last updated: 2026-06-08
> Type: Leaf folder

Strategy-pattern implementations for computing per-sequence KV cache memory consumption across 13 distinct attention architectures (MHA, GQA, MQA, MLA, MLA_ROPE, SWA, SWA_GLOBAL, SWA_DUAL, LINEAR_ATTENTION, MAMBA, RWKV, HYBRID_MAMBA, HYBRID_DELTANET). Each strategy exports a plain object with a `types[]` array (the attention type strings it handles) and a `calculateKvCachePerSeqGB()` method implementing the architecture-specific formula. The registry in `index.js` allows looking up the correct strategy by name and collecting all supported type strings for UI select options.

---

## 📄 `index.js`

> Attention strategy registry. Imports all 11 strategy modules, maintains a `STRATEGIES` array, and provides two lookup helpers: one to find the appropriate strategy object given an attention type string, and another to enumerate all supported types (used by frontend dropdowns).

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `./mhaGqaMqaStrategy.js` | `default` (strategy object) | Internal |
| `./mlaStrategy.js` | `default` (strategy object) | Internal |
| `./mlaRopeStrategy.js` | `default` (strategy object) | Internal |
| `./swaStrategy.js` | `default` (strategy object) | Internal |
| `./swaGlobalStrategy.js` | `default` (strategy object) | Internal |
| `./swaDualStrategy.js` | `default` (strategy object) | Internal |
| `./linearAttentionStrategy.js` | `default` (strategy object) | Internal |
| `./mambaStrategy.js` | `default` (strategy object) | Internal |
| `./rwkvStrategy.js` | `default` (strategy object) | Internal |
| `./hybridMambaStrategy.js` | `default` (strategy object) | Internal |
| `./hybridDeltanetStrategy.js` | `default` (strategy object) | Internal |

### Constants

| Constant | Type | Purpose |
|----------|------|---------|
| `STRATEGIES` | `Array<object>` | Ordered array of all imported strategy objects. Used as the single source of truth for both lookup and type enumeration. |

### Functions

- **`getStrategy(attentionType: string) → object | null`**
  Iterates the `STRATEGIES` array and returns the first strategy whose `types[]` includes the given `attentionType`. Returns `null` if no strategy matches.
  - `attentionType`: An architecture identifier string such as `'MHA'`, `'GQA'`, `'MLA_ROPE'`, `'SWA_DUAL'`, etc.
  - **Returns:** The matching strategy object `{ types, calculateKvCachePerSeqGB }` or `null`.

- **`getAllTypes() → string[]`**
  Flattens the `types[]` arrays of every strategy in `STRATEGIES` into a single array. Useful for populating dropdown/select options in the calculator UI.
  - **Returns:** A flat `string[]` containing all supported attention type identifiers. Contains duplicates if a strategy lists the same type multiple times (not expected under normal use).

---

## 📄 `mhaGqaMqaStrategy.js`

> Strategy for classic self-attention architectures: Multi-Head Attention (MHA), Grouped-Query Attention (GQA), and Multi-Query Attention (MQA). Shares the same KV cache formula — all three differ only in their `num_key_value_heads` configuration. Handles type strings `'MHA'`, `'GQA'`, `'MQA'`.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `../calcHelpers.js` | `_round`, `validatePositive` | Internal |

### Strategy object (default export)

**Properties:**
- `types: ['MHA', 'GQA', 'MQA']` — the attention type strings this strategy handles.

#### `calculateKvCachePerSeqGB(params: object) → number | null`

Computes per-sequence KV cache for classic attention using the formula:

```
(2 × layers × num_key_value_heads × head_dim × seqLen × dtypeB) / 1024³
```

The factor of `2` accounts for both K and V caches. Returns `null` if heads or dim fail validation.

- `params.layers`: Number of transformer hidden layers.
- `params.seqLen`: Maximum sequence / context length.
- `params.dtypeB`: Bytes per element (e.g., 2 for BF16/FP16, 4 for FP32).
- `params.num_key_value_heads`: Key/value head count.
- `params.head_dim`: Dimensionality per key/value head.
- **Returns:** KV cache size in GB rounded to 2 dp, or `null` if inputs are invalid.

---

## 📄 `mlaStrategy.js`

> Strategy for Multi-Head Latent Attention (MLA) as used in Gemma 4 (global layers) and DeepSeek-V2. Compresses the KV cache into a low-rank latent representation, reducing memory proportional to the rank rather than the full head dimension. Handles type string `'MLA'`.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `../calcHelpers.js` | `_round`, `validatePositive` | Internal |

### Strategy object (default export)

**Properties:**
- `types: ['MLA']` — the attention type string this strategy handles.

#### `calculateKvCachePerSeqGB(params: object) → number | null`

Computes per-sequence KV cache using the compressed MLA formula:

```
(layers × kv_lora_rank × seqLen × dtypeB) / 1024³
```

Note the absence of the factor-of-2 multiplier (single compressed C-cache, not separate K/V). Returns `null` if `kv_lora_rank` fails validation.

- `params.layers`: Number of transformer hidden layers.
- `params.seqLen`: Maximum sequence / context length.
- `params.dtypeB`: Bytes per element.
- `params.kv_lora_rank`: Low-rank dimension used to compress the KV cache.
- **Returns:** Compressed KV cache size in GB rounded to 2 dp, or `null` if inputs are invalid.

---

## 📄 `mlaRopeStrategy.js`

> Strategy for MLA with RoPE (Rotary Position Embedding) as used in DeepSeek-V3 and R1. Extends the MLA approach by adding a separate RoPE head dimension on top of the compressed latent rank. Handles type string `'MLA_ROPE'`.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `../calcHelpers.js` | `_round`, `validatePositive` | Internal |

### Strategy object (default export)

**Properties:**
- `types: ['MLA_ROPE']` — the attention type string this strategy handles.

#### `calculateKvCachePerSeqGB(params: object) → number | null`

Computes per-sequence KV cache using the MLA+RoPE formula:

```
(layers × (kv_lora_rank + qk_rope_head_dim) × seqLen × dtypeB) / 1024³
```

The total effective dimension is the sum of the compressed rank and the RoPE head dimension. Returns `null` if either parameter fails validation.

- `params.layers`: Number of transformer hidden layers.
- `params.seqLen`: Maximum sequence / context length.
- `params.dtypeB`: Bytes per element.
- `params.kv_lora_rank`: Low-rank dimension for compressed KV cache.
- `params.qk_rope_head_dim`: RoPE head dimension (stored separately from the compressed rank).
- **Returns:** KV cache size in GB rounded to 2 dp, or `null` if inputs are invalid.

---

## 📄 `swaStrategy.js`

> Pure Sliding Window Attention (SWA) strategy for models like Mistral 7B v0.1 where all layers use a fixed window size rather than full-sequence attention. Caps the effective sequence length at the sliding window size, reducing KV cache proportional to the ratio of window-to-context. Handles type string `'SWA'`.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `../calcHelpers.js` | `_round`, `validatePositive` | Internal |

### Strategy object (default export)

**Properties:**
- `types: ['SWA']` — the attention type string this strategy handles.

#### `calculateKvCachePerSeqGB(params: object) → number | null`

Computes per-sequence KV cache by capping the sequence length at the sliding window:

```
(2 × layers × num_key_value_heads × head_dim × min(seqLen, sliding_window) × dtypeB) / 1024³
```

If `seqLen <= sliding_window`, the formula degenerates to standard GQA/MHA. Returns `null` if any required parameter fails validation.

- `params.layers`: Number of transformer hidden layers.
- `params.seqLen`: Maximum sequence / context length.
- `params.dtypeB`: Bytes per element.
- `params.num_key_value_heads`: Key/value head count.
- `params.head_dim`: Dimensionality per key/value head.
- `params.sliding_window`: Window size that bounds the effective KV cache depth.
- **Returns:** Window-capped KV cache size in GB rounded to 2 dp, or `null` if inputs are invalid.

---

## 📄 `swaGlobalStrategy.js`

> Mixed SWA + Global attention with same head geometry for all layers. Models like Gemma 2 and Phi-3 where some layers use sliding window and others use full global attention, but both share identical `head_dim` and `num_key_value_heads`. The number of sliding-window layers is explicit in the model spec. Handles type string `'SWA_GLOBAL'`.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `../calcHelpers.js` | `_round`, `validatePositive` | Internal |

### Strategy object (default export)

**Properties:**
- `types: ['SWA_GLOBAL']` — the attention type string this strategy handles.

#### `calculateKvCachePerSeqGB(params: object) → number | null`

Splits layers into two groups and computes separate byte totals:

1. **SWA layers** (`swaCount`, capped at `layers`): uses `min(seqLen, window)` as effective depth.
2. **Global layers** (`layers - swaLayers`): uses full `seqLen` as depth.

```
swaBytes   = 2 × swaLayers    × heads × dim × min(seqLen, window) × dtypeB
globalBytes = 2 × globalLayers × heads × dim × seqLen              × dtypeB
```

Sums both contributions and converts to GB. Returns `null` if any required parameter fails validation.

- `params.layers`: Total number of transformer hidden layers.
- `params.seqLen`: Maximum sequence / context length.
- `params.dtypeB`: Bytes per element.
- `params.num_key_value_heads`: Key/value head count (shared by both SWA and global layers).
- `params.head_dim`: Head dimensionality (shared by both groups).
- `params.sliding_window`: Window size for sliding-window layers.
- `params.num_sliding_layers`: Number of layers that use sliding window (capped at `layers`).
- **Returns:** Mixed-layer KV cache size in GB rounded to 2 dp, or `null` if inputs are invalid.

---

## 📄 `swaDualStrategy.js`

> Mixed SWA + Global attention with dual head geometry for models like Gemma 4 (12B / 31B). Local sliding-window layers and global layers use different `head_dim` and `num_key_value_heads`. Layer assignment follows an Nth-pattern rather than a count: every `sliding_window_pattern`-th layer (0-indexed) is a global layer. Additionally, global layers can optionally share K=V (halving their KV cache). Handles type string `'SWA_DUAL'`.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `../calcHelpers.js` | `_round`, `validatePositive` | Internal |

### Strategy object (default export)

**Properties:**
- `types: ['SWA_DUAL']` — the attention type string this strategy handles.

#### `calculateKvCachePerSeqGB(params: object) → number | null`

Determines layer composition via the pattern-based formula:

```
globalLayers    = floor(layers / pattern)
slidingLayers   = layers - globalLayers
```

Computes two separate byte totals with distinct head geometries:

1. **Sliding layers:** `2 × slidingLayers × headsLocal × dimLocal × min(seqLen, window) × dtypeB`
2. **Global layers:** `kvMultiplierGlobal × globalLayers × headsGlobal × dimGlobal × seqLen × dtypeB`

Where `kvMultiplierGlobal` is `1` when K=V sharing is enabled (`attention_k_eq_v = true`) and `2` otherwise. Returns `null` if any required parameter fails validation.

- `params.layers`: Total number of transformer hidden layers.
- `params.seqLen`: Maximum sequence / context length.
- `params.dtypeB`: Bytes per element.
- `params.num_key_value_heads`: Key/value head count for sliding (local) layers.
- `params.head_dim`: Head dimensionality for sliding (local) layers.
- `params.sliding_window`: Window size for sliding-window layers.
- `params.sliding_window_pattern`: Nth-layer pattern — every Nth layer (0-indexed) is global. E.g., pattern=6, layers=48 → 8 global layers.
- `params.num_global_key_value_heads`: Key/value head count for global layers.
- `params.global_head_dim`: Head dimensionality for global layers.
- `params.attention_k_eq_v`: Boolean — when true, global layers store K only (V=K), halving the multiplier from 2→1.
- **Returns:** Dual-geometry KV cache size in GB rounded to 2 dp, or `null` if inputs are invalid.

---

## 📄 `linearAttentionStrategy.js`

> Strategy for linear attention models that maintain a fixed-size state matrix instead of an unbounded KV cache. The state size grows with `dim × dim` per head (not with sequence length). Handles type string `'LINEAR_ATTENTION'`.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `../calcHelpers.js` | `_round`, `validatePositive` | Internal |

### Strategy object (default export)

**Properties:**
- `types: ['LINEAR_ATTENTION']` — the attention type string this strategy handles.

#### `calculateKvCachePerSeqGB(params: object) → number | null`

Computes per-sequence state memory using a quadratic formula in head dimension:

```
(layers × linear_num_heads × linear_head_dim² × dtypeB) / 1024³
```

Note the absence of `seqLen` — state size is sequence-length independent. Returns `null` if heads or dim fail validation.

- `params.layers`: Number of transformer hidden layers.
- `params.dtypeB`: Bytes per element.
- `params.linear_num_heads`: Number of linear attention heads.
- `params.linear_head_dim`: Dimensionality per linear attention head (squared in formula).
- **Returns:** Fixed state size in GB rounded to 2 dp, or `null` if inputs are invalid.

---

## 📄 `mambaStrategy.js`

> Strategy for pure state-space models (Mamba-2 / S6 architecture). Instead of a KV cache that grows with sequence length, Mamba maintains a fixed-size state tensor per layer proportional to `hidden_size × state_size`. Handles type string `'MAMBA'`.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `../calcHelpers.js` | `_round`, `validatePositive` | Internal |

### Strategy object (default export)

**Properties:**
- `types: ['MAMBA']` — the attention type string this strategy handles.

#### `calculateKvCachePerSeqGB(params: object) → number | null`

Computes per-sequence state memory independent of sequence length:

```
(layers × hidden_size × state_size × dtypeB) / 1024³
```

Returns `null` if either `state_size` or `hidden_size` fail validation.

- `params.layers`: Number of transformer/SSM layers.
- `params.dtypeB`: Bytes per element.
- `params.state_size`: Size of the recurrent state (d_state in Mamba terminology).
- `params.hidden_size`: Model hidden dimension (d_model / d_hidden).
- **Returns:** Fixed state size in GB rounded to 2 dp, or `null` if inputs are invalid.

---

## 📄 `rwkvStrategy.js`

> Strategy for pure recurrent KV architectures (RWKV family). Like Mamba, the state size is fixed and does not grow with sequence length. Uses `hidden_size × state_size` per layer for consistent dimensionality tracking. Handles type string `'RWKV'`.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `../calcHelpers.js` | `_round`, `validatePositive` | Internal |

### Strategy object (default export)

**Properties:**
- `types: ['RWKV']` — the attention type string this strategy handles.

#### `calculateKvCachePerSeqGB(params: object) → number | null`

Computes per-sequence state memory using the same formula as mambaStrategy (shared dimensionality pattern):

```
(layers × hidden_size × state_size × dtypeB) / 1024³
```

Returns `null` if either parameter fails validation.

- `params.layers`: Number of recurrent/transformer layers.
- `params.dtypeB`: Bytes per element.
- `params.state_size`: Size of the recurrent state tensor (d_state or n_layers-equivalent in RWKV terminology).
- `params.hidden_size`: Model hidden dimension (d_model).
- **Returns:** Fixed state size in GB rounded to 2 dp, or `null` if inputs are invalid.

---

## 📄 `hybridMambaStrategy.js`

> Hybrid strategy for models that alternate between Mamba state-space layers and full attention layers (e.g., Jamba family). Attention layers accumulate a standard GQA KV cache that grows with sequence length, while Mamba layers contribute fixed-size state memory. Handles type string `'HYBRID_MAMBA'`.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `../calcHelpers.js` | `_round`, `validatePositive` | Internal |

### Strategy object (default export)

**Properties:**
- `types: ['HYBRID_MAMBA']` — the attention type string this strategy handles.

#### `calculateKvCachePerSeqGB(params: object) → number | null`

Computes a combined memory estimate from two disjoint layer sets:

1. **Attention layers** (`num_attention_layers`, capped at `layers`): standard KV cache that grows with `seqLen`.
   ```
   2 × attnLayers × heads × dim × seqLen × dtypeB
   ```
2. **Mamba layers** (`mambaLayers = layers - min(attnLayers, layers)`): fixed state memory independent of sequence length.
   ```
   mambaLayers × hidden_size × hybrid_state_size × dtypeB
   ```

Sums both and converts to GB. Returns `null` if any required parameter fails validation.

- `params.layers`: Total number of model layers (attention + Mamba combined).
- `params.seqLen`: Maximum sequence / context length (affects only attention layers).
- `params.dtypeB`: Bytes per element.
- `params.num_key_value_heads`: Key/value head count for attention layers.
- `params.head_dim`: Head dimensionality for attention layers.
- `params.num_attention_layers`: Number of full-attention layers (capped at `layers`). Remaining layers are Mamba.
- `params.hidden_size`: Model hidden dimension for Mamba state computation.
- `params.hybrid_state_size`: State size per Mamba layer (d_state).
- **Returns:** Combined (attention + Mamba) memory in GB rounded to 2 dp, or `null` if inputs are invalid.

---

## 📄 `hybridDeltanetStrategy.js`

> Hybrid strategy for models combining full GQA attention with Gated DeltaNet recurrent layers (Falcon H1, RWKV-7 hybrid). Attention layers use a standard KV cache that grows with sequence length; DeltaNet layers maintain a fixed `head_dim × head_dim` matrix per head that does NOT grow with sequence length. Handles type string `'HYBRID_DELTANET'`.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `../calcHelpers.js` | `_round`, `validatePositive` | Internal |

### Strategy object (default export)

**Properties:**
- `types: ['HYBRID_DELTANET']` — the attention type string this strategy handles.

#### `calculateKvCachePerSeqGB(params: object) → number | null`

Computes a combined memory estimate from two disjoint layer sets:

1. **Attention layers** (`num_attention_layers`, capped at `layers`): standard GQA KV cache.
   ```
   2 × attnLayers × heads × dim × seqLen × dtypeB
   ```
2. **DeltaNet layers** (`deltanetLayers = layers - min(attnLayers, layers)`): fixed recurrent state. Unlike Mamba's `hidden × state_size`, DeltaNet uses a quadratic head-dimension matrix:
   ```
   deltanetLayers × deltanet_num_heads × deltanet_head_dim² × dtypeB
   ```

Sums both and converts to GB. Returns `null` if any required parameter fails validation.

- `params.layers`: Total number of model layers (attention + DeltaNet combined).
- `params.seqLen`: Maximum sequence / context length (affects only attention layers).
- `params.dtypeB`: Bytes per element.
- `params.num_key_value_heads`: Key/value head count for attention layers.
- `params.head_dim`: Head dimensionality for attention layers.
- `params.num_attention_layers`: Number of full-attention layers (capped at `layers`). Remaining layers are DeltaNet.
- `params.deltanet_num_heads`: Number of heads in the DeltaNet recurrent component.
- `params.deltanet_head_dim`: Dimensionality per DeltaNet head (squared in formula).
- **Returns:** Combined (attention + DeltaNet) memory in GB rounded to 2 dp, or `null` if inputs are invalid.

---