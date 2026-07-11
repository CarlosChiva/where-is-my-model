/* ── Attention Strategy Registry ── */

import mhaGqaMqaStrategy from './mhaGqaMqaStrategy.js';
import mlaStrategy from './mlaStrategy.js';
import mlaRopeStrategy from './mlaRopeStrategy.js';
import swaStrategy from './swaStrategy.js';
import swaGlobalStrategy from './swaGlobalStrategy.js';
import swaDualStrategy from './swaDualStrategy.js';
import linearAttentionStrategy from './linearAttentionStrategy.js';
import mambaStrategy from './mambaStrategy.js';
import rwkvStrategy from './rwkvStrategy.js';
import hybridMambaStrategy from './hybridMambaStrategy.js';
import hybridDeltanetStrategy from './hybridDeltanetStrategy.js';

const STRATEGIES = [
  mhaGqaMqaStrategy,
  mlaStrategy,
  mlaRopeStrategy,
  swaStrategy,
  swaGlobalStrategy,
  swaDualStrategy,
  linearAttentionStrategy,
  mambaStrategy,
  rwkvStrategy,
  hybridMambaStrategy,
  hybridDeltanetStrategy,
];

/**
 * getStrategy — Look up the strategy for a given attention_type string.
 * @param {string} attentionType
 * @returns {object|null} Strategy object or null if not found.
 */
export function getStrategy(attentionType) {
  for (const s of STRATEGIES) {
    if (s.types.includes(attentionType)) return s;
  }
  return null;
}

/**
 * getAllTypes — Return a flat array of all supported attention_type strings.
 * Useful for dropdown / select options.
 * @returns {string[]}
 */
export function getAllTypes() {
  const types = [];
  for (const s of STRATEGIES) {
    types.push(...s.types);
  }
  return types;
}
