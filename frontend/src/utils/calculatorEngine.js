/* ── Pure Calculation Engine — GPU Model Fitting Calculator ──
 * Architectures supported:
 *   MHA            — Multi-Head Attention
 *   GQA            — Grouped Query Attention
 *   MQA            — Multi-Query Attention
 *   MLA            — Multi-Head Latent Attention (Gemma 4 global, DeepSeek-V2)
 *   MLA_ROPE       — MLA with RoPE vector (DeepSeek-V3 / R1)
 *   SWA            — Pure Sliding Window Attention (Mistral 7B v0.1)
 *   SWA_GLOBAL     — Mixed SWA + global, same head geometry (Gemma 2, Phi-3)
 *   SWA_DUAL       — Mixed SWA + global, DIFFERENT head geometry per layer type
 *                    (Gemma 4 12B/31B: head_dim/kv_heads differ between local and global)
 *   HYBRID_DELTANET— Alternating Gated DeltaNet (linear, fixed state) + full attention
 *                    (Falcon H1, some RWKV-7 variants)
 */

/* ═══  Helper ═══ */

function _round(n) {
  return Math.round(n * 100) / 100;
}

/* ═══  Required fields per attention type ═══ */

export const REQUIRED_FIELDS_BY_TYPE = {
  MHA:             ['num_key_value_heads', 'head_dim'],
  GQA:             ['num_key_value_heads', 'head_dim'],
  MQA:             ['num_key_value_heads', 'head_dim'],
  MLA:             ['kv_lora_rank'],
  MLA_ROPE:        ['kv_lora_rank', 'qk_rope_head_dim'],
  SWA:             ['num_key_value_heads', 'head_dim', 'sliding_window'],
  SWA_GLOBAL:      ['num_key_value_heads', 'head_dim', 'sliding_window', 'num_sliding_layers'],
  SWA_DUAL:        [
    'num_key_value_heads', 'head_dim', 'sliding_window',       // local layers
    'num_global_key_value_heads', 'global_head_dim',           // global layers
    'sliding_window_pattern',                                   // e.g. 6 → every 6th layer is global
  ],
  HYBRID_DELTANET: [
    'num_key_value_heads', 'head_dim',                         // attention layers
    'num_attention_layers',                                     // how many are full-attention
    'deltanet_num_heads', 'deltanet_head_dim',                 // DeltaNet state geometry
  ],
  LINEAR_ATTENTION: [
  'linear_num_heads',
  'linear_head_dim',
],

MAMBA: [
  'state_size',
],

RWKV: [
  'state_size',
],

HYBRID_MAMBA: [
  'num_attention_layers',
  'state_size',
  'num_key_value_heads',
  'head_dim',
],
};

/* ═══  Input Validation ═══ */

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

export function validatePositive(value, fallback = null) {
  const n = validateInput(value, fallback);
  if (n === null || n === 0) return fallback ?? null;
  return n;
}

/* ═══  Field validation helper ═══ */

export function validateRequiredFields(attention_type, fields) {
  const required = REQUIRED_FIELDS_BY_TYPE[attention_type] ?? [];
  const missing  = required.filter((key) => {
    const n = parseFloat(fields[key]);
    return (
      fields[key] === '' ||
      fields[key] === undefined ||
      fields[key] === null ||
      Number.isNaN(n) ||
      n <= 0
    );
  });
  return { valid: missing.length === 0, missing };
}

/* ═══  Model Size ═══ */

export function calculateModelSizeGB(num_parameters, dtype_bytes) {
  const params = validatePositive(num_parameters);
  const bytes  = validatePositive(dtype_bytes);
  if (params === null || bytes === null) return null;
  return _round((params * bytes) / (1024 ** 3));
}

/* ═══  KV Cache — Architecture-aware ═══ */

/**
 * calculateKvCachePerSeqGB — KV cache for one full sequence.
 * Returns null when any required field for the selected attention_type is missing or zero.
 *
 * @param {number|string} num_hidden_layers
 * @param {number|string} num_key_value_heads        MHA/GQA/MQA/SWA/SWA_GLOBAL/SWA_DUAL/HYBRID
 * @param {number|string} head_dim                   MHA/GQA/MQA/SWA/SWA_GLOBAL/SWA_DUAL/HYBRID
 * @param {number|string} max_model_len
 * @param {number|string} kv_cache_dtype_bytes
 * @param {string}        attention_type
 * @param {number|string} kv_lora_rank               MLA / MLA_ROPE
 * @param {number|string} qk_rope_head_dim           MLA_ROPE
 * @param {number|string} sliding_window             SWA / SWA_GLOBAL / SWA_DUAL
 * @param {number|string} num_sliding_layers         SWA_GLOBAL
 * @param {number|string} sliding_window_pattern     SWA_DUAL — period (e.g. 6 → every 6th is global)
 * @param {number|string} num_global_key_value_heads SWA_DUAL — KV heads on global layers
 * @param {number|string} global_head_dim            SWA_DUAL — head dim on global layers
 * @param {boolean}       attention_k_eq_v           SWA_DUAL — if true, global layers use ×1 not ×2
 * @param {number|string} num_attention_layers       HYBRID_DELTANET — full-attention layer count
 * @param {number|string} deltanet_num_heads         HYBRID_DELTANET
 * @param {number|string} deltanet_head_dim          HYBRID_DELTANET
 * @returns {number|null}
 */
export function calculateKvCachePerSeqGB(
  num_hidden_layers,
  num_key_value_heads,
  head_dim,
  max_model_len,
  kv_cache_dtype_bytes,
  attention_type             = 'GQA',
  kv_lora_rank               = '',
  qk_rope_head_dim           = '',
  sliding_window             = '',
  num_sliding_layers         = '',
  sliding_window_pattern     = '',
  num_global_key_value_heads = '',
  global_head_dim            = '',
  attention_k_eq_v           = false,
  num_attention_layers       = '',
  deltanet_num_heads         = '',
  deltanet_head_dim          = '',
  linear_num_heads = '',
linear_head_dim = '',
state_size = '',
hybrid_state_size = '',
hidden_size = '',
) {
  const layers = validatePositive(num_hidden_layers);
  const seqLen = validatePositive(max_model_len);
  const dtypeB = validatePositive(kv_cache_dtype_bytes);
  if (layers === null || seqLen === null || dtypeB === null) return null;

  /* ── MLA (Gemma 4 global layers style, DeepSeek-V2) ── */
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
    return _round((2 * layers * heads * dim * Math.min(seqLen, window) * dtypeB) / (1024 ** 3));
  }

  /* ── Mixed SWA + Global, same geometry (Gemma 2, Phi-3) ── */
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

  /* ── Mixed SWA + Global, DUAL geometry (Gemma 4 12B / 31B) ──
   *
   * Local (sliding) layers:  head_dim_local,  kv_heads_local,  window cap, ×2
   * Global layers:           head_dim_global, kv_heads_global, full seq,   ×1 if K=V else ×2
   *
   * sliding_window_pattern = N means every Nth layer (0-indexed) is global.
   * e.g. pattern=6, layers=48 → global layers at indices [5,11,17,23,29,35,41,47] → 8 global
   */
  if (attention_type === 'SWA_DUAL') {
    const headsLocal  = validatePositive(num_key_value_heads);
    const dimLocal    = validatePositive(head_dim);
    const window      = validatePositive(sliding_window);
    const pattern     = validatePositive(sliding_window_pattern);
    const headsGlobal = validatePositive(num_global_key_value_heads);
    const dimGlobal   = validatePositive(global_head_dim);
    if (
      headsLocal === null || dimLocal === null || window === null ||
      pattern === null || headsGlobal === null || dimGlobal === null
    ) return null;

    // Count global layers: every `pattern`-th layer (1-indexed) is global
    const globalLayers = Math.floor(layers / pattern);
    const slidingLayers = layers - globalLayers;

    // K=V sharing on global layers halves their KV cache (store K only, V=K)
    const kvMultiplierGlobal = attention_k_eq_v ? 1 : 2;

    const slidingBytes = 2 * slidingLayers * headsLocal  * dimLocal  * Math.min(seqLen, window) * dtypeB;
    const globalBytes  = kvMultiplierGlobal * globalLayers * headsGlobal * dimGlobal * seqLen    * dtypeB;

    return _round((slidingBytes + globalBytes) / (1024 ** 3));
  }
if (attention_type === 'LINEAR_ATTENTION') {
  const heads = validatePositive(linear_num_heads);
  const dim   = validatePositive(linear_head_dim);

  if (heads === null || dim === null) return null;

  const stateBytes =
    layers *
    heads *
    dim *
    dim *
    dtypeB;

  return _round(stateBytes / (1024 ** 3));
}
if (attention_type === 'MAMBA') {
  const dState = validatePositive(state_size);
  const hidden = validatePositive(hidden_size);

  if (dState === null || hidden === null) return null;

  const stateBytes =
    layers *
    hidden *
    dState *
    dtypeB;

  return _round(stateBytes / (1024 ** 3));
}
if (attention_type === 'RWKV') {
  const dState = validatePositive(state_size);
  const hidden = validatePositive(hidden_size);

  if (dState === null || hidden === null) return null;

  const stateBytes =
    layers *
    hidden *
    dState *
    dtypeB;

  return _round(stateBytes / (1024 ** 3));
}
if (attention_type === 'HYBRID_MAMBA') {
  const heads      = validatePositive(num_key_value_heads);
  const dim        = validatePositive(head_dim);
  const attnLayers = validatePositive(num_attention_layers);

  const hidden     = validatePositive(hidden_size);
  const dState     = validatePositive(hybrid_state_size);

  if (
    heads === null ||
    dim === null ||
    attnLayers === null ||
    hidden === null ||
    dState === null
  ) {
    return null;
  }

  const mambaLayers =
    layers - Math.min(attnLayers, layers);

  const attnBytes =
    2 *
    attnLayers *
    heads *
    dim *
    seqLen *
    dtypeB;

  const mambaBytes =
    mambaLayers *
    hidden *
    dState *
    dtypeB;

  return _round(
    (attnBytes + mambaBytes) /
    (1024 ** 3)
  );
}
  /* ── Hybrid Gated DeltaNet + Full Attention (Falcon H1, RWKV-7 hybrid) ──
   *
   * Full-attention layers → standard GQA KV cache (grows with seq_len)
   * DeltaNet layers       → fixed recurrent state (head_dim × head_dim matrix per head, per layer)
   *                         does NOT grow with seq_len
   */
  if (attention_type === 'HYBRID_DELTANET') {
    const heads        = validatePositive(num_key_value_heads);
    const dim          = validatePositive(head_dim);
    const attnLayers   = validatePositive(num_attention_layers);
    const dnHeads      = validatePositive(deltanet_num_heads);
    const dnDim        = validatePositive(deltanet_head_dim);
    if (
      heads === null || dim === null || attnLayers === null ||
      dnHeads === null || dnDim === null
    ) return null;

    const deltanetLayers = layers - Math.min(attnLayers, layers);

    // Standard KV cache for full-attention layers
    const attnBytes = 2 * attnLayers * heads * dim * seqLen * dtypeB;

    // Fixed recurrent state for DeltaNet layers (head_dim × head_dim per head, constant)
    const deltanetBytes = deltanetLayers * dnHeads * dnDim * dnDim * dtypeB;

    return _round((attnBytes + deltanetBytes) / (1024 ** 3));
  }

  /* ── MHA / GQA / MQA (classic fallback) ── */
  const heads = validatePositive(num_key_value_heads);
  const dim   = validatePositive(head_dim);
  if (heads === null || dim === null) return null;
  return _round((2 * layers * heads * dim * seqLen * dtypeB) / (1024 ** 3));
}

export function calculateTotalKvCacheGB(kv_cache_per_seq_gb, max_num_seqs) {
  if (kv_cache_per_seq_gb === null) return null;
  const perSeq = validateInput(kv_cache_per_seq_gb, 0);
  const seqs   = validatePositive(max_num_seqs);
  if (seqs === null) return null;
  return _round(perSeq * seqs);
}

export function getAvailableVram(vram_total_gb, gpu_memory_utilization) {
  const total    = validatePositive(vram_total_gb);
  const utilFrac = validateInput(gpu_memory_utilization, 0.90);
  if (total === null || utilFrac === null) return null;
  return _round(total * utilFrac);
}

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

export function getRemainingVram(available_vram_gb, used_vram_gb) {
  if (available_vram_gb === null || used_vram_gb === null) return null;
  const avail = validateInput(available_vram_gb, 0);
  const used  = validateInput(used_vram_gb, 0);
  return Math.max(0, _round(avail - used));
}

export function getVramUsagePercent(used_vram_gb, available_vram_gb) {
  if (used_vram_gb === null || available_vram_gb === null) return null;
  const avail = validateInput(available_vram_gb, 0);
  if (avail <= 0) return null;
  const used = validateInput(used_vram_gb, 0);
  return _round((used / avail) * 100);
}