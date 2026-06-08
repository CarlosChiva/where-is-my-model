/* ── Hybrid Gated DeltaNet + Full Attention Strategy — Falcon H1, RWKV-7 hybrid ──
 *
 * Full-attention layers -> standard GQA KV cache (grows with seq_len)
 * DeltaNet layers       -> fixed recurrent state (head_dim x head_dim matrix per head, per layer)
 *                         does NOT grow with seq_len
 */

import { _round, validatePositive } from '../calcHelpers.js';

export default {
  types: ['HYBRID_DELTANET'],

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
    deltanet_num_heads,
    deltanet_head_dim,
  }) {
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

    // Fixed recurrent state for DeltaNet layers (head_dim x head_dim per head, constant)
    const deltanetBytes = deltanetLayers * dnHeads * dnDim * dnDim * dtypeB;

    return _round((attnBytes + deltanetBytes) / (1024 ** 3));
  },
};
