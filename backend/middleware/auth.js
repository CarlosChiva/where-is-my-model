import jwt from 'jsonwebtoken';

/* ------------------------------------------------------------------ */
/*  authMiddleware                                                     */
/*  Dual-mode: checks BOTH Bearer token in Authorization header AND   */
/*  the httpOnly 'accessToken' cookie. Decodes the first valid source  */
/*  found and attaches the payload to req.user for downstream          */
/*  middleware and route handlers. Returns 401 on failure.             */
/* ------------------------------------------------------------------ */

export function authMiddleware(req, res, next) {
  let token = null;

  /* --- Method 1: Bearer token from Authorization header ----------- */
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  /* --- Method 2: accessToken cookie ------------------------------- */
  if (!token && req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided',
    });
  }

  /* --- Verify and decode ---------------------------------------- */
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // contains userId, username, role
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res
        .setHeader('X-Session-Expired', 'true')
        .status(401)
        .json({
          success: false,
          message: 'Access denied. Token expired.',
        });
    }

    // Invalid signature or malformed token — not a recovery scenario.
    return res.status(401).json({
      success: false,
      message: 'Access denied. Invalid token.',
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
