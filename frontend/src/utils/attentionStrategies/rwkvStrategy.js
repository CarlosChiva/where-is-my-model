/* ── RWKV Strategy — Pure Recurrent KV ── */

import { _round, validatePositive } from '../calcHelpers.js';

export default {
  types: ['RWKV'],

  /**
   * @param {object} params
   * @returns {number|null}
   */
  calculateKvCachePerSeqGB({ layers, dtypeB, state_size, hidden_size }) {
    const dState = validatePositive(state_size);
    const hidden = validatePositive(hidden_size);

    if (dState === null || hidden === null) return null;

    const stateBytes =
      layers *
      hidden *
      dState *
      dtypeB;

    return _round(stateBytes / (1024 ** 3));
  },
};
