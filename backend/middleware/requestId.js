/* ------------------------------------------------------------------ */
/*  requestId                                                          */
/*  Ensures req.id carries a unique tracing identifier and echoes     */
/*  it back in the X-Request-ID response header.                      */
/*                                                                   */
/*  The actual generation/reuse logic lives in utils/logger.js        */
/*  (pino-http genReqId callback). This middleware runs after that    */
/*  stage, so req.id is already populated by pino-http for every      */
/*  request. If it were somehow missing (e.g. non-HTTP entry point),   */
/*  a fallback UUID is generated here.                                */
/* ------------------------------------------------------------------ */

import crypto from 'node:crypto';

export default function requestId(req, res, next) {
  // req.id should always be set by pino-http genReqId at this point.
  if (!req.id || typeof req.id !== 'string') {
    const fallback = crypto.randomUUID();
    req.id = fallback;
  }

  res.setHeader('X-Request-ID', req.id);
  next();
}
