/* ── Linear Attention Strategy ── */

import { _round, validatePositive } from '../calcHelpers.js';

export default {
  types: ['LINEAR_ATTENTION'],

  /**
   * @param {object} params
   * @returns {number|null}
   */
  calculateKvCachePerSeqGB({ layers, dtypeB, linear_num_heads, linear_head_dim }) {
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
  },
};
