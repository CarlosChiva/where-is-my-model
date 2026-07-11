/* ── MLA + RoPE Strategy — DeepSeek-V3 / R1 ── */

import { _round, validatePositive } from '../calcHelpers.js';

export default {
  types: ['MLA_ROPE'],

  /**
   * @param {object} params
   * @returns {number|null}
   */
  calculateKvCachePerSeqGB({ layers, seqLen, dtypeB, kv_lora_rank, qk_rope_head_dim }) {
    const rank    = validatePositive(kv_lora_rank);
    const ropeDim = validatePositive(qk_rope_head_dim);
    if (rank === null || ropeDim === null) return null;
    return _round((layers * (rank + ropeDim) * seqLen * dtypeB) / (1024 ** 3));
  },
};
