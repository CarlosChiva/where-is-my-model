/* ── MLA Strategy — Multi-Head Latent Attention (Gemma 4 global, DeepSeek-V2) ── */

import { _round, validatePositive } from '../calcHelpers.js';

export default {
  types: ['MLA'],

  /**
   * @param {object} params
   * @returns {number|null}
   */
  calculateKvCachePerSeqGB({ layers, seqLen, dtypeB, kv_lora_rank }) {
    const rank = validatePositive(kv_lora_rank);
    if (rank === null) return null;
    return _round((layers * rank * seqLen * dtypeB) / (1024 ** 3));
  },
};
