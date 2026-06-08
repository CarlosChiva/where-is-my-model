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
 *   LINEAR_ATTENTION — Linear Attention (fixed state matrix, grows with seq len irrelevantly)
 *   MAMBA           — Pure State Space Model (Mamba-2 / S6)
 *   RWKV            — Pure Recurrent KV (fixed state per layer)
 *   HYBRID_MAMBA    — Alternating Mamba state-space + full attention layers
 *   HYBRID_DELTANET — Alternating Gated DeltaNet (linear, fixed state) + full attention
 *                    (Falcon H1, some RWKV-7 variants)
 */

/* ═══  Shared Helpers (imported from calcHelpers for use by strategies too) ═══ */

import { _round, validateInput as _validateInput, validatePositive as _validatePositive } from './calcHelpers.js';
import { getStrategy } from './attentionStrategies/index.js';

// Re-export helpers for backward compatibility with any external consumers
export { _round, _validateInput as validateInput, _validatePositive as validatePositive };

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
  const params = _validatePositive(num_parameters);
  const bytes  = _validatePositive(dtype_bytes);
  if (params === null || bytes === null) return null;
  return _round((params * bytes) / (1024 ** 3));
}

/* ═══  KV Cache — Architecture-aware (Strategy Pattern) ═══ */

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
 * @param {number|string} num_attention_layers       HYBRID_DELTANET / HYBRID_MAMBA — full-attention layer count
 * @param {number|string} deltanet_num_heads         HYBRID_DELTANET
 * @param {number|string} deltanet_head_dim          HYBRID_DELTANET
 * @param {number|string} linear_num_heads           LINEAR_ATTENTION
 * @param {number|string} linear_head_dim            LINEAR_ATTENTION
 * @param {number|string} state_size                 MAMBA / RWKV
 * @param {number|string} hybrid_state_size          HYBRID_MAMBA
 * @param {number|string} hidden_size                MAMBA / RWKV / HYBRID_MAMBA
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
  const layers = _validatePositive(num_hidden_layers);
  const seqLen = _validatePositive(max_model_len);
  const dtypeB = _validatePositive(kv_cache_dtype_bytes);
  if (layers === null || seqLen === null || dtypeB === null) return null;

  const strategy = getStrategy(attention_type);
  if (!strategy) return null;

  return strategy.calculateKvCachePerSeqGB({
    layers,
    seqLen,
    dtypeB,
    num_key_value_heads,
    head_dim,
    kv_lora_rank,
    qk_rope_head_dim,
    sliding_window,
    num_sliding_layers,
    sliding_window_pattern,
    num_global_key_value_heads,
    global_head_dim,
    attention_k_eq_v,
    num_attention_layers,
    deltanet_num_heads,
    deltanet_head_dim,
    linear_num_heads,
    linear_head_dim,
    state_size,
    hybrid_state_size,
    hidden_size,
  });
}

export function calculateTotalKvCacheGB(kv_cache_per_seq_gb, max_num_seqs) {
  if (kv_cache_per_seq_gb === null) return null;
  const perSeq = _validateInput(kv_cache_per_seq_gb, 0);
  const seqs   = _validatePositive(max_num_seqs);
  if (seqs === null) return null;
  return _round(perSeq * seqs);
}

export function getAvailableVram(vram_total_gb, gpu_memory_utilization) {
  const total    = _validatePositive(vram_total_gb);
  const utilFrac = _validateInput(gpu_memory_utilization, 0.90);
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
  const modelSize = _validateInput(model_size_gb, 0);
  const kvPerSeq  = _validateInput(kv_cache_per_seq_gb, 0);
  const numSeqs   = _validatePositive(max_num_seqs);
  const hitRatio  = Math.min(1, Math.max(0, _validateInput(prefix_cache_hit_ratio, 0)));
  const overhead  = _validateInput(activation_overhead_gb, 1.5);
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
  const kvPerSeq = _validateInput(kv_cache_per_seq_gb, 0);
  const numSeqs  = _validatePositive(max_num_seqs);
  const hitRatio = Math.min(1, Math.max(0, _validateInput(prefix_cache_hit_ratio, 0)));
  if (numSeqs === null) return null;
  return _round(kvPerSeq * hitRatio * Math.max(0, numSeqs - 1));
}

export function getRemainingVram(available_vram_gb, used_vram_gb) {
  if (available_vram_gb === null || used_vram_gb === null) return null;
  const avail = _validateInput(available_vram_gb, 0);
  const used  = _validateInput(used_vram_gb, 0);
  return Math.max(0, _round(avail - used));
}

export function getVramUsagePercent(used_vram_gb, available_vram_gb) {
  if (used_vram_gb === null || available_vram_gb === null) return null;
  const avail = _validateInput(available_vram_gb, 0);
  if (avail <= 0) return null;
  const used = _validateInput(used_vram_gb, 0);
  return _round((used / avail) * 100);
}
