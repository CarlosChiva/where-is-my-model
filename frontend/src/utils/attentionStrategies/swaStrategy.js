/* ── Pure SWA Strategy — Sliding Window Attention (Mistral 7B v0.1) ── */

import { _round, validatePositive } from '../calcHelpers.js';

export default {
  types: ['SWA'],

  /**
   * @param {object} params
   * @returns {number|null}
   */
  calculateKvCachePerSeqGB({ layers, seqLen, dtypeB, num_key_value_heads, head_dim, sliding_window }) {
    const heads  = validatePositive(num_key_value_heads);
    const dim    = validatePositive(head_dim);
    const window = validatePositive(sliding_window);
    if (heads === null || dim === null || window === null) return null;
    return _round((2 * layers * heads * dim * Math.min(seqLen, window) * dtypeB) / (1024 ** 3));
  },
};
