/* ── MHA / GQA / MQA Strategy — Classic Attention ── */

import { _round, validatePositive } from '../calcHelpers.js';

export default {
  types: ['MHA', 'GQA', 'MQA'],

  /**
   * @param {object} params
   * @returns {number|null}
   */
  calculateKvCachePerSeqGB({ layers, seqLen, dtypeB, num_key_value_heads, head_dim }) {
    const heads = validatePositive(num_key_value_heads);
    const dim   = validatePositive(head_dim);
    if (heads === null || dim === null) return null;
    return _round((2 * layers * heads * dim * seqLen * dtypeB) / (1024 ** 3));
  },
};
