/* ------------------------------------------------------------------ */
/*  versionMiddleware                                                  */
/*  Sets the X-API-Version header on every API response, makes the    */
/*  active version string available as req.apiVersion, and returns    */
/*  a 410 Gone response for versions past their sunset date.          */
/*                                                                    */
/*  Enhancements (Task 23):                                           */
/*  - X-Sunset header (RFC 8594) for future sunsetting versions       */
/*  - Deprecation signaling during grace period                       */
/*  - Unknown-version fallback with X-Available-Versions header       */
/* ------------------------------------------------------------------ */

const API_VERSION = 'v1';

/**
 * Version registry mapping each supported API version to its lifecycle metadata.
 * - `sunsetDate` (optional): ISO-8601 date string after which the version returns 410 Gone.
 *   When omitted, the version is considered permanently active.
 * - `successor` (optional): The version string that replaces this one for the deprecation
 *   grace-period workflow.  When present and `sunsetDate` is in the future, the middleware
 *   emits `Deprecation: true` + RFC 7234 `Warning` header on every response.
 *
 * @type {Record<string, { sunsetDate?: string, successor?: string }>}
 */
const VERSION_REGISTRY = {
  v1: {},
};

/**
 * Check whether an API version is past its sunset date or currently in
 * the deprecation grace period.
 *
 * @param {string} apiVersion - The version string extracted from the request.
 * @returns {{ expired: boolean, sunsetting: boolean, sunsetDate: string | null, successor: string | null }}
 */
function isVersionSunset(apiVersion) {
  const entry = VERSION_REGISTRY[apiVersion];
  if (!entry || !entry.sunsetDate) {
    return { expired: false, sunsetting: false, sunsetDate: null, successor: null };
  }
  const sunset = new Date(entry.sunsetDate);
  const expired = sunset <= new Date();
  const sunsetting = !expired && entry.successor;

  return {
    expired,
    sunsetting,
    sunsetDate: entry.sunsetDate,
    successor: entry.successor || null,
  };
}

/** Format a Date as RFC 3339 (ISO-8601 / HTTP-date compatible).            */
function toRfc3339(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

import logger from '../utils/logger.js';

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export default function versionMiddleware(req, res, next) {
  /* ------------------------------------------------------------------ */
  /*  Non-versioned paths passthrough                                    */
  /*  Routes like /api/health do not carry a version prefix. We pass    */
  /*  them through immediately so Docker health checks and monitoring   */
  /*  probes are unaffected.                                           */
  /* ------------------------------------------------------------------ */
  const apiVersion = req.baseUrl?.match(/^\/api\/(v\d+)/)?.[1];

  if (!apiVersion) {
    next();
    return;
  }

  /* ---- PART 2c — unknown version number in registry ----------------- */
  if (!VERSION_REGISTRY[apiVersion]) {
    const available = Object.keys(VERSION_REGISTRY).join(', ');
    logger.warn(
      '[version] Request used an unknown version "%s" on path "%s" — responding 404',
      apiVersion,
      req.path
    );
    return res.status(404)
      .set('X-Available-Versions', available)
      .json({
        success: false,
        message: `API version "${apiVersion}" is not recognized. ` +
          `Supported versions are: [${available}].`,
      });
  }

  /* ---- PART 2a + 2b — sunset / deprecation metadata ----------------- */
  const { expired, sunsetting, sunsetDate, successor } = isVersionSunset(apiVersion);

  // 410 Gone for versions past their sunset date (existing behavior)
  if (expired) {
    return res.status(410).json({
      success: false,
      message: `API version ${apiVersion} has been sunset since ${sunsetDate}. Please migrate to the latest API version.`,
    });
  }

  // X-Sunset header (RFC 8594) — set when a future sunsetDate exists
  if (sunsetDate) {
    res.setHeader('X-Sunset', toRfc3339(new Date(sunsetDate)));
  }

  // Deprecation signaling during grace period (has successor, not yet sunset)
  if (sunsetting) {
    res.setHeader('Deprecation', 'true');
    const warnValue = `299 - "API version ${apiVersion} is deprecated. Please migrate to ${successor} before ${sunsetDate}. "`;
    res.setHeader('Warning', warnValue);
  }

  // Make the resolved version available to downstream middleware/routes
  req.apiVersion = apiVersion;

  // Echo version so clients (and proxies/monitoring tools) can inspect it
  res.setHeader('X-API-Version', apiVersion);

  next();
}
