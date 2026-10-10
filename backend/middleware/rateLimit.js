import rateLimit from 'express-rate-limit';

// Limits dimensioned for normal frontend usage: fan-out of N health checks
// (one per PC), initial load of 4+N requests, and CRUD refetches. Abuse
// protection is preserved by the short health window (1 min) and the
// per-route auth/health caps.

const tooManyRequestsHandler = (_req, _res) => {
  _res.status(429).json({
    success: false,
    message: 'Too many requests, please try again later.',
  });
};

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
});

export const healthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
});
