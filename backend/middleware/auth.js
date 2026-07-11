import jwt from 'jsonwebtoken';

/* ------------------------------------------------------------------ */
/*  authMiddleware                                                     */
/*  Verifies a Bearer token in the Authorization header, decodes it,   */
/*  and attaches the payload to req.user for downstream middleware     */
/*  and route handlers. Returns 401 on any authentication failure.     */
/* ------------------------------------------------------------------ */

export function authMiddleware(req, res, next) {
  /* --- Extract Authorization header ----------------------------- */
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    });
  }

  /* --- Parse Bearer format -------------------------------------- */
  const parts = header.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Invalid token format.',
    });
  }

  const token = parts[1];

  /* --- Verify and decode ---------------------------------------- */
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // contains userId, username, role
    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token.',
      });
    }

    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Token expired.',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Access denied. Token verification failed.',
    });
  }
}

/* ------------------------------------------------------------------ */
/*  requireAdmin                                                       */
/*  Must be used AFTER authMiddleware — assumes req.user is already    */
/*  set. Enforces that the authenticated user has role === 'admin'.    */
/*  Returns 403 if the role check fails.                               */
/* ------------------------------------------------------------------ */

export function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Admin access required.',
  });
}
