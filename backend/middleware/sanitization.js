import logger from '../utils/logger.js';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SKIP_SANITIZE_FIELDS = new Set(['password', 'totpSecret']);
const NUMERIC_FIELDS = new Set(['puerto', 'gpu', 'assignedGpu', 'vram']);
const NOSQL_OPERATORS = new Set([
  '$gt', '$gte', '$lt', '$lte', '$ne', '$eq',
  '$regex', '$exists', '$type', '$where',
  '$set', '$unset', '$push', '$pull', '$inc', '$rename',
  '$currentDate', '$addFields',
  '$and', '$or', '$nor', '$not',
]);
const PROTOTYPE_POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/* ------------------------------------------------------------------ */
/*  escapeHtmlChars                                                     */
/*  Private helper — replace < > & with their HTML-entitites.          */
/* ------------------------------------------------------------------ */

function escapeHtmlChars(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ------------------------------------------------------------------ */
/*  sanitizeString                                                       */
/*  Trims whitespace, strips HTML tags via regex, and escapes          */
/*  remaining dangerous characters. Skips fields listed in             */
/*  SKIP_SANITIZE_FIELDS so password / totpSecret are untouched.       */
/*  Returns { clean, changed } where `changed` signals mutation.        */
/* ------------------------------------------------------------------ */

export function sanitizeString(str, fieldName) {
  if (typeof str !== 'string') {
    return { clean: str, changed: false };
  }

  /* Skip secret / credential fields entirely */
  if (SKIP_SANITIZE_FIELDS.has(fieldName)) {
    return { clean: str, changed: false };
  }

  let cleaned = str.trim();
  const trimChanged = cleaned !== str;

  /* Strip HTML tags */
  cleaned = cleaned.replace(/<[^>]*(?:>[^<]*)*>/g, '');
  const stripChanged = (cleaned !== str.trim());

  /* Escape any remaining dangerous characters */
  cleaned = escapeHtmlChars(cleaned);
  const escapeChanged = cleaned !== str.trim();

  return {
    clean: cleaned,
    changed: trimChanged || stripChanged || escapeChanged,
  };
}

/* ------------------------------------------------------------------ */
/*  hasNoSqlInjection                                                    */
/*  Recursively walks objects and arrays. Detects MongoDB query        */
/*  operators ($gt …) and prototype-poisoning keys (__proto__, etc.).   */
/*  Returns { found: boolean, details: string[] }.                      */
/* ------------------------------------------------------------------ */

export function hasNoSqlInjection(value) {
  const details = [];

  function walk(current, pathPrefix) {
    if (current === null || current === undefined) return;

    if (Array.isArray(current)) {
      current.forEach((item, idx) => walk(item, `${pathPrefix}[${idx}]`));
      return;
    }

    if (typeof current !== 'object') return;

    const keys = Object.keys(current);
    for (const key of keys) {
      const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;

      /* --- MongoDB operator detection -------------------------------- */
      if (NOSQL_OPERATORS.has(key)) {
        details.push(`NoSQL operator detected: "${fullPath}"`);
        continue; // skip descending — the value itself is the threat
      }

      /* --- Prototype pollution detection ----------------------------- */
      if (PROTOTYPE_POLLUTION_KEYS.has(key)) {
        details.push(`Prototype pollution attempt detected: "${fullPath}"`);
        continue;
      }

      /* Recurse into nested objects / arrays */
      walk(current[key], fullPath);
    }
  }

  walk(value, '');
  return { found: details.length > 0, details };
}

/* ------------------------------------------------------------------ */
/*  sanitizeBodyDeep                                                     */
/*  Mutates an object tree in-place. Applies sanitizeString to each    */
/*  string leaf that is NOT a secret field and NOT a numeric field.     */
/*  Returns nothing (mutation side-effect only).                        */
/* ------------------------------------------------------------------ */

function sanitizeBodyDeep(value, fieldName) {
  if (value === null || value === undefined) return;

  if (Array.isArray(value)) {
    value.forEach((item, idx) => {
      // If array items are numbers (numeric fields like gpu entries in some edge case), skip.
      if (typeof item !== 'object') return;
      sanitizeBodyDeep(item, fieldName ? `${fieldName}[${idx}]` : `[${idx}]`);
    });
    return;
  }

  if (typeof value === 'string') {
    const result = sanitizeString(value, fieldName);
    // Caller handles assignment back to parent — this is called via
    // sanitizeBodyObject which assigns the `clean` back.  But here
    // we cannot mutate the string in-place on the parent; instead
    // return clean value up through caller context.
    // To keep things simple, sanitizeBodyDeep only handles object
    // leaves; direct string mutation is delegated to sanitizeString.
    return;
  }

  const keys = Object.keys(value);
  for (const key of keys) {
    /* Skip secret fields entirely */
    if (SKIP_SANITIZE_FIELDS.has(key)) continue;

    /* Skip numeric fields — do not run string sanitization on them */
    if (NUMERIC_FIELDS.has(key) && typeof value[key] === 'number') continue;

    const childField = fieldName ? `${fieldName}.${key}` : key;

    if (typeof value[key] === 'string') {
      const result = sanitizeString(value[key], childField);
      if (result.changed) {
        value[key] = result.clean;
      }
    } else if (typeof value[key] === 'object' && value[key] !== null) {
      sanitizeBodyDeep(value[key], childField);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  sanitizeMiddleware                                                   */
/*  Express middleware. First inspects req.body for NoSQL injection    */
/*  and prototype-pollution patterns. If any are found the request is   */
/*  rejected with a 400 response. Otherwise all string fields in       */
/*  req.body are sanitized in-place via sanitizeBodyDeep, then next()  */
/*  is called to downstream middleware / route handlers.                */
/* ------------------------------------------------------------------ */

export function sanitizeMiddleware(req, res, next) {
  /* If there is no body (GET, HEAD, etc.) skip silently */
  if (!req.body || typeof req.body !== 'object') {
    return next();
  }

  /* --- NoSQL injection / prototype-pollution guard ----------------- */
  const threat = hasNoSqlInjection(req.body);
  if (threat.found) {
    logger.warn('[sanitization] Blocked request — suspicious body detected:', threat.details.join('; '));
    return res.status(400).json({
      success: false,
      message: 'Request contains forbidden patterns.',
    });
  }

  /* --- In-place string field sanitization -------------------------- */
  sanitizeBodyDeep(req.body, '');

  next();
}
