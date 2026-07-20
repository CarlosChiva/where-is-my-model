import crypto from 'node:crypto';
import pino from 'pino';
import pinoHttp from 'pino-http';

/* ------------------------------------------------------------------ */
/*  Pino base logger (shared across application)                      */
/* ------------------------------------------------------------------ */

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  name: 'where-is-my-model',
  level: isProduction ? 'info' : 'debug',
  redact: {
    paths: [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'authorization',
      'cookie',
      // Sensitive query-parameter keys — redacted in body log lines
      'req.query.password',
      'req.query.token',
      'req.query.accessToken',
      'req.query.refreshToken',
    ],
    censor: '[Redacted]',
  },
  base: {
    env: process.env.NODE_ENV || 'development',
  },
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
});

/* ------------------------------------------------------------------ */
/*  Sensitive query-parameter filter                                  */
/*  Strips known-sensitive keys from the URL query string before      */
/*  pino-http serializes the request so they never appear in logs.    */
/* ------------------------------------------------------------------ */

const SENSITIVE_QUERY_PARAMS = new Set([
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'auth',
]);

function sanitizeUrl(url) {
  try {
    const parsed = new URL(url, 'http://localhost');
    parsed.searchParams.forEach((_, key) => {
      if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    });
    return parsed.pathname + (parsed.search ? '?' + parsed.search : '') + parsed.hash;
  } catch {
    // Malformed URL — return as-is; pino-http will still log it.
    return url;
  }
}

/* ------------------------------------------------------------------ */
/*  Request-ID validator                                               */
/*  Matches a standard RFC 4122 UUID. Used to decide whether an       */
/*  incoming X-Request-ID header should be trusted/reused.            */
 /* ------------------------------------------------------------------ */
const VALID_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ------------------------------------------------------------------ */
/*  pino-http middleware factory                                      */
/*  Returns an Express-usable middleware function that:               */
/*    - uses the shared pino instance (consistent format)             */
/*    - strips sensitive query params from logged URLs                */
/*    - includes matched Express route path in every response log     */
/* ------------------------------------------------------------------ */

function createHttpLogger() {
  return pinoHttp({
    // Requirement 1: reuse existing logger for consistent format.
    logger,

    // --- distributed-tracing request ID (Task 17) -----------------
    genReqId(req, _res) {
      const existing = req.headers['x-request-id'];
      if (existing && VALID_UUID_RE.test(existing)) return existing;
      return crypto.randomUUID();
    },

    // Requirement 5: default serializers auto-serialize req/res,
    // and wrapSerializers ensures our customSerializer receives the
    // already-partially-serialized object (merge-friendly).
    wrapSerializers: true,

    // --- Requirement 3: sanitize sensitive query params from URLs ---
    customSuccessObject(req, res, loggable) {
      return {
        ...loggable,
        url: sanitizeUrl(req.url),
        // Requirement 4: Express route path appended as `route` key.
        route: req.route ? req.route.path : undefined,
      };
    },

    customErrorObject(req, res, err, loggable) {
      return {
        ...loggable,
        url: sanitizeUrl(req.url),
        route: req.route ? req.route.path : undefined,
      };
    },
  });
}

export default logger;
export { createHttpLogger, sanitizeUrl };
