import AuditLog from '../models/AuditLog.js';
import logger from '../utils/logger.js';

/* ------------------------------------------------------------------ */
/*  auditLogger(action) — factory returning Express middleware        */
/*  Intercepts res.end and logs only on 2xx status codes.             */
/*  Failures are swallowed so they never break the request flow.       */
/* ------------------------------------------------------------------ */

export function auditLogger(action) {
  return async function auditMiddleware(req, res, next) {
    const originalEnd = res.end;

    res.end = function (...args) {
      // Restore immediately so downstream middleware / framework code
      // sees a valid res.end. The actual DB write is fire-and-forget.
      res.end = originalEnd;
      originalEnd.apply(res, args);

      /* --- Only log successful (2xx) responses ---------------------- */
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return;
      }

      // Fire-and-forget — never reject or block the request pipeline.
      Promise.resolve()
        .then(async () => {
          const payload = {
            action,
            userId: req.user?.userId || null,
            username: req.user?.username || 'unknown',
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers['user-agent'] || '',
            requestId: req.id || '',
            metadata: req.auditMetadata || null,
          };

          try {
            await AuditLog.record(payload);
          } catch (err) {
            logger.warn('[audit] Failed to log action %s: %s', action, err.message);
          }
        })
        .catch((err) => {
          logger.error('[audit] Unhandled error in audit write for %s: %s', action, err.message);
        });
    };

    next();
  };
}

/* ------------------------------------------------------------------ */
/*  manualAudit(action, req, metadata) — convenience function         */
/*  For one-off audit calls (FAILED_LOGIN, etc.). Handles the case   */
/*  where there is no authMiddleware so req.user may be undefined.   */
/*  Uses req._auditUsername as fallback username.                    */
/* ------------------------------------------------------------------ */

export async function manualAudit(action, req, metadata = null) {
  const payload = {
    action,
    userId: req.user?.userId || null,
    username: req.user?.username || req._auditUsername || 'anonymous',
    ipAddress: req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || '',
    requestId: req.id || '',
    metadata,
  };

  try {
    await AuditLog.record(payload);
  } catch (err) {
    logger.warn('[audit] Failed to log manual action %s: %s', action, err.message);
  }
}
