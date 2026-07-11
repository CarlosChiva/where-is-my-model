/* ── Hybrid Mamba Strategy — Alternating Mamba state-space + full attention layers ── */

import { _round, validatePositive } from '../calcHelpers.js';

export default {
  types: ['HYBRID_MAMBA'],

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
    num_attention_layers,
    hidden_size,
    hybrid_state_size,
  }) {
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
  },
};
