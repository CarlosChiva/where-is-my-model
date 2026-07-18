import rateLimit from 'express-rate-limit';

const tooManyRequestsHandler = (_req, _res) => {
  _res.status(429).json({
    success: false,
    message: 'Too many requests, please try again later.',
  });
};

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
});

export const healthLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
});

const resendTooManyRequestsHandler = (_req, res) => {
  res.status(429).json({
    success: false,
    message: 'Too many resend attempts. Please try again in one hour.',
  });
};

export const resendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 3,                    // 3 requests per email per hour
  keyGenerator: (req) => req.body.email?.trim().toLowerCase() || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  handler: resendTooManyRequestsHandler,
});
