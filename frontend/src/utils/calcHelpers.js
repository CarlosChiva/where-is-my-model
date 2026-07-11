/* ── Shared Calculation Helpers — GPU Model Fitting Calculator ── */

export function _round(n) {
  return Math.round(n * 100) / 100;
}

export function validateInput(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = parseFloat(value);
  if (Number.isNaN(num) || num < 0) {
    if (typeof value === 'number' && value < 0) {
      console.warn(`validateInput: negative value (${value}), returning fallback (${fallback})`);
    }
    return fallback ?? null;
  }
  return _round(num);
}

export function validatePositive(value, fallback = null) {
  const n = validateInput(value, fallback);
  if (n === null || n === 0) return fallback ?? null;
  return n;
}
