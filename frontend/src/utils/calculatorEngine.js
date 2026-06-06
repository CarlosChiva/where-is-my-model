/* ── Pure Calculation Engine — GPU Model Fitting Calculator ──
 * Architectures supported:
 *   MHA        — Multi-Head Attention
 *   GQA        — Grouped Query Attention
 *   MQA        — Multi-Query Attention
 *   MLA        — Multi-Head Latent Attention (Gemma 4, DeepSeek-V2)
 *   MLA_ROPE   — MLA with RoPE vector (DeepSeek-V3 / R1)
 *   SWA        — Pure Sliding Window Attention (Mistral 7B v0.1)
 *   SWA_GLOBAL — Mixed SWA + global layers (Gemma 2, Phi-3)
 */

/* ═══  Helper ═══ */

function _round(n) {
  return Math.round(n * 100) / 100;
}

/* ═══  Required fields per attention type ═══ */

export const REQUIRED_FIELDS_BY_TYPE = {
  MHA:        ['num_key_value_heads', 'head_dim'],
  GQA:        ['num_key_value_heads', 'head_dim'],
  MQA:        ['num_key_value_heads', 'head_dim'],
  MLA:        ['kv_lora_rank'],
  MLA_ROPE:   ['kv_lora_rank', 'qk_rope_head_dim'],
  SWA:        ['num_key_value_heads', 'head_dim', 'sliding_window'],
  SWA_GLOBAL: ['num_key_value_heads', 'head_dim', 'sliding_window', 'num_sliding_layers'],
};

/* ═══  Input Validation ═══ */

/**
 * validateInput — Guard against null, undefined, NaN and negative values.
 * Returns null instead of fallback when the value is missing/empty,
 * so callers can distinguish "not provided" from "zero".
 *
 * @param {*}      value
 * @param {number} [fallback]  If provided, returned on invalid input. If omitted, returns null.
 * @returns {number|null}
 */
export function validateInput(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = parseFloat(value);
  if (Number.isNaN(num) || num < 0) {
    if (typeof value === 'number' && value < 0) {
      console.warn(`validateInput: negative value (${value}), returning fallback (${fallback})`);
    }
    return fallback ?? null;
  }
  return _round(num);
}

/**
 * validatePositive — Like validateInput but also rejects zero.
 * Used for fields that must be strictly positive (heads, dims, ranks…).
 *
 * @param {*}      value
 * @param {number} [fallback]
 * @returns {number|null}
 */
export function validatePositive(value, fallback = null) {
  const n = validateInput(value, fallback);
  if (n === null || n === 0) return fallback ?? null;
  return n;
}

/* ═══  Field validation helper ═══ */

/**
 * validateRequiredFields — Check that all fields required for a given
 * attention type are present and strictly positive.
 *
 * @param {string} attention_type
 * @param {Object} fields  — { kv_lora_rank, qk_rope_head_dim, sliding_window, … }
 * @returns {{ valid: boolean, missing: string[] }}
 */
export function validateRequiredFields(attention_type, fields) {
  const required = REQUIRED_FIELDS_BY_TYPE[attention_type] ?? [];
  const missing  = required.filter((key) => {
    const n = parseFloat(fields[key]);
    return fields[key] === '' || fields[key] === undefined ||
           fields[key] === null || Number.isNaN(n) || n <= 0;
  });
  return { valid: missing.length === 0, missing };
}

/* ═══  Model Size ═══ */

/**
 * calculateModelSizeGB — Raw model-weight memory in gigabytes.
 * Uses 1024³ (GiB) for accuracy against real VRAM figures.
 *
 * @param {number|string} num_parameters
 * @param {number|string} dtype_bytes  FP32→4, BF16/FP16→2, INT8→1, INT4→0.5
 * @returns {number|null} GB rounded to 2 dp, or null if inputs are invalid.
 */
export function calculateModelSizeGB(num_parameters, dtype_bytes) {
  const params = validatePositive(num_parameters);
  const bytes  = validatePositive(dtype_bytes);
  if (params === null || bytes === null) return null;
  return _round((params * bytes) / (1024 ** 3));
}

/* ═══  KV Cache — Architecture-aware ═══ */

/**
 * calculateKvCachePerSeqGB — KV cache for one full sequence.
 *
 * Returns null (instead of a silently wrong 0) when any required field
 * for the selected attention_type is missing or zero.
 *
 * @param {number|string} num_hidden_layers
 * @param {number|string} num_key_value_heads   MHA/GQA/MQA/SWA only.
 * @param {number|string} head_dim              MHA/GQA/MQA/SWA only.
 * @param {number|string} max_model_len
 * @param {number|string} kv_cache_dtype_bytes
 * @param {string}        attention_type
 * @param {number|string} kv_lora_rank          MLA / MLA_ROPE only.
 * @param {number|string} qk_rope_head_dim      MLA_ROPE only.
 * @param {number|string} sliding_window        SWA / SWA_GLOBAL only.
 * @param {number|string} num_sliding_layers    SWA_GLOBAL only.
 * @returns {number|null} Per-sequence KV cache in GB, or null if inputs incomplete.
 */
export function calculateKvCachePerSeqGB(
  num_hidden_layers,
  num_key_value_heads,
  head_dim,
  max_model_len,
  kv_cache_dtype_bytes,
  attention_type     = 'GQA',
  kv_lora_rank       = '',
  qk_rope_head_dim   = '',
  sliding_window     = '',
  num_sliding_layers = '',
) {
  const layers = validatePositive(num_hidden_layers);
  const seqLen = validatePositive(max_model_len);
  const dtypeB = validatePositive(kv_cache_dtype_bytes);

  if (layers === null || seqLen === null || dtypeB === null) return null;

  /* ── MLA (Gemma 4, DeepSeek-V2) ── */
  if (attention_type === 'MLA') {
    const rank = validatePositive(kv_lora_rank);
    if (rank === null) return null;
    return _round((layers * rank * seqLen * dtypeB) / (1024 ** 3));
  }

  /* ── MLA + RoPE (DeepSeek-V3 / R1) ── */
  if (attention_type === 'MLA_ROPE') {
    const rank    = validatePositive(kv_lora_rank);
    const ropeDim = validatePositive(qk_rope_head_dim);
    if (rank === null || ropeDim === null) return null;
    return _round((layers * (rank + ropeDim) * seqLen * dtypeB) / (1024 ** 3));
  }

  /* ── Pure SWA (Mistral 7B v0.1) ── */
  if (attention_type === 'SWA') {
    const heads  = validatePositive(num_key_value_heads);
    const dim    = validatePositive(head_dim);
    const window = validatePositive(sliding_window);
    if (heads === null || dim === null || window === null) return null;
    const effectiveLen = Math.min(seqLen, window);
    return _round((2 * layers * heads * dim * effectiveLen * dtypeB) / (1024 ** 3));
  }

  /* ── Mixed SWA + Global (Gemma 2, Phi-3) ── */
  if (attention_type === 'SWA_GLOBAL') {
    const heads      = validatePositive(num_key_value_heads);
    const dim        = validatePositive(head_dim);
    const window     = validatePositive(sliding_window);
    const swaCount   = validatePositive(num_sliding_layers);
    if (heads === null || dim === null || window === null || swaCount === null) return null;

    const swaLayers    = Math.min(swaCount, layers);
    const globalLayers = layers - swaLayers;
    const swaBytes     = 2 * swaLayers    * heads * dim * Math.min(seqLen, window) * dtypeB;
    const globalBytes  = 2 * globalLayers * heads * dim * seqLen                   * dtypeB;
    return _round((swaBytes + globalBytes) / (1024 ** 3));
  }

  /* ── MHA / GQA / MQA (classic) ── */
  const heads = validatePositive(num_key_value_heads);
  const dim   = validatePositive(head_dim);
  if (heads === null || dim === null) return null;
  return _round((2 * layers * heads * dim * seqLen * dtypeB) / (1024 ** 3));
}

/**
 * calculateTotalKvCacheGB — Aggregate KV cache across all concurrent sequences.
 * Returns null if kv_cache_per_seq_gb is null (incomplete inputs).
 */
export function calculateTotalKvCacheGB(kv_cache_per_seq_gb, max_num_seqs) {
  if (kv_cache_per_seq_gb === null) return null;
  const perSeq = validateInput(kv_cache_per_seq_gb, 0);
  const seqs   = validatePositive(max_num_seqs);
  if (seqs === null) return null;
  return _round(perSeq * seqs);
}

/* ═══  VRAM Accounting ═══ */

/**
 * getAvailableVram — Usable VRAM after applying the utilisation ceiling.
 */
export function getAvailableVram(vram_total_gb, gpu_memory_utilization) {
  const total    = validatePositive(vram_total_gb);
  const utilFrac = validateInput(gpu_memory_utilization, 0.90);
  if (total === null || utilFrac === null) return null;
  return _round(total * utilFrac);
}

/**
 * getUsedVramWithPrefixCache — VRAM consumed by weights + effective KV cache + overhead.
 *
 * Prefix caching model:
 *   shared_kv  = kv_per_seq × hit_ratio          (stored once)
 *   unique_kv  = kv_per_seq × (1 - hit_ratio) × N (per sequence)
 *   effective  = shared_kv + unique_kv
 *
 * Returns null if model_size_gb or kv_cache_per_seq_gb are null.
 */
export function getUsedVramWithPrefixCache(
  model_size_gb,
  kv_cache_per_seq_gb,
  max_num_seqs,
  prefix_cache_hit_ratio,
  activation_overhead_gb = 1.5,
) {
  if (model_size_gb === null || kv_cache_per_seq_gb === null) return null;
  const modelSize = validateInput(model_size_gb, 0);
  const kvPerSeq  = validateInput(kv_cache_per_seq_gb, 0);
  const numSeqs   = validatePositive(max_num_seqs);
  const hitRatio  = Math.min(1, Math.max(0, validateInput(prefix_cache_hit_ratio, 0)));
  const overhead  = validateInput(activation_overhead_gb, 1.5);
  if (numSeqs === null) return null;

  const sharedKv    = kvPerSeq * hitRatio;
  const uniqueKv    = kvPerSeq * (1 - hitRatio) * numSeqs;
  const effectiveKv = sharedKv + uniqueKv;

  return _round(modelSize + effectiveKv + overhead);
}

/**
 * calculatePrefixCacheSavingsGB — VRAM saved vs no prefix caching.
 *   savings = kv_per_seq × hit_ratio × (num_seqs - 1)
 */
export function calculatePrefixCacheSavingsGB(
  kv_cache_per_seq_gb,
  max_num_seqs,
  prefix_cache_hit_ratio,
) {
  if (kv_cache_per_seq_gb === null) return null;
  const kvPerSeq = validateInput(kv_cache_per_seq_gb, 0);
  const numSeqs  = validatePositive(max_num_seqs);
  const hitRatio = Math.min(1, Math.max(0, validateInput(prefix_cache_hit_ratio, 0)));
  if (numSeqs === null) return null;
  return _round(kvPerSeq * hitRatio * Math.max(0, numSeqs - 1));
}

/**
 * getRemainingVram — Free VRAM after allocation, floored at zero.
 */
export function getRemainingVram(available_vram_gb, used_vram_gb) {
  if (available_vram_gb === null || used_vram_gb === null) return null;
  const avail = validateInput(available_vram_gb, 0);
  const used  = validateInput(used_vram_gb, 0);
  return Math.max(0, _round(avail - used));
}

/**
 * getVramUsagePercent — Utilisation percentage for UI colour-coding.
 */
export function getVramUsagePercent(used_vram_gb, available_vram_gb) {
  if (used_vram_gb === null || available_vram_gb === null) return null;
  const avail = validateInput(available_vram_gb, 0);
  if (avail <= 0) return null;
  const used = validateInput(used_vram_gb, 0);
  return _round((used / avail) * 100);
}