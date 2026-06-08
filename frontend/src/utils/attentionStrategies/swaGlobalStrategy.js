/* ── Mixed SWA + Global Strategy — Same Head Geometry (Gemma 2, Phi-3) ── */

import { _round, validatePositive } from '../calcHelpers.js';

export default {
  types: ['SWA_GLOBAL'],

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
    num_sliding_layers,
  }) {
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
  },
};
