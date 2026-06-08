/* ── Mixed SWA + Global, DUAL Geometry Strategy — Gemma 4 12B / 31B ──
 *
 * Local (sliding) layers:  head_dim_local,  kv_heads_local,  window cap, x2
 * Global layers:           head_dim_global, kv_heads_global, full seq,   x1 if K=V else x2
 *
 * sliding_window_pattern = N means every Nth layer (0-indexed) is global.
 * e.g. pattern=6, layers=48 -> global layers at indices [5,11,17,23,29,35,41,47] -> 8 global
 */

import { _round, validatePositive } from '../calcHelpers.js';

export default {
  types: ['SWA_DUAL'],

  /**
   * @param {object} params
   * @returns {number|null}
   */
  calculateKvCachePerSeqGB({
    layers,
    seqLen,
    dtypeB,
    num_key_value_heads,
    head_dim,
    sliding_window,
    sliding_window_pattern,
    num_global_key_value_heads,
    global_head_dim,
    attention_k_eq_v,
  }) {
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
  },
};
