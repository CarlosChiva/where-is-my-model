import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import { authMiddleware } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import logger from '../utils/logger.js';
import { sanitizeMiddleware } from '../middleware/sanitization.js';

const router = express.Router();

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{12,}$/;

/* ------------------------------------------------------------------ */
/*  Constants: temporary 2FA session                                  */
/* ------------------------------------------------------------------ */
const TEMP_SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

/* ------------------------------------------------------------------ */
/*  Helper: create a temp signed token for the 2FA-required           */
/*  intermediate state. Contains only userId + timestamp; valid 5 min. */
/* ------------------------------------------------------------------ */
function createTempAuthToken(userId) {
  return jwt.sign(
    { userId, ts: Date.now() },
    process.env.JWT_SECRET,
    { expiresIn: '5m' }
  );
}

/* ------------------------------------------------------------------ */
/*  Helper: verify and extract userId from a temp session cookie      */
/*  Returns the decoded payload or null on failure/expiry.            */
/* ------------------------------------------------------------------ */
function verifyTempAuthToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Enforce 5-minute window even if JWT expiry is slightly generous
    if (Date.now() - decoded.ts > TEMP_SESSION_TTL_MS) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Helper: parse JWT duration string (e.g. "7d", "30m") to ms        */
/* ------------------------------------------------------------------ */

function parseDurationToMs(duration) {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return value * multipliers[unit];
}

/* ------------------------------------------------------------------ */
/*  Helper: sign an access JWT for the authenticated user             */
/* ------------------------------------------------------------------ */

function signAccessToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      username: user.username,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
}

/* ------------------------------------------------------------------ */
/*  Helper: sign and persist a refresh JWT                            */
/* ------------------------------------------------------------------ */

async function signRefreshToken(user) {
  const tokenValue = jwt.sign(
    { userId: user._id.toString() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
  );

  const refreshMs = parseDurationToMs(process.env.JWT_REFRESH_EXPIRES_IN);

  await RefreshToken.create({
    userId: user._id,
    token: tokenValue,
    expiresAt: new Date(Date.now() + refreshMs),
  });

  return tokenValue;
}

/* ------------------------------------------------------------------ */
/*  Helper: set both auth cookies on the response                     */
/* ------------------------------------------------------------------ */

function setAuthCookies(res, accessTokenValue, refreshTokenValue) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('accessToken', accessTokenValue, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'Strict' : 'Lax',
    maxAge: 15 * 60 * 1000,
    path: '/api',
  });
  res.cookie('refreshToken', refreshTokenValue, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'Strict' : 'Lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth/refresh',
  });
}

/* ------------------------------------------------------------------ */
/*  Helper: build the safe user profile object (no password)           */
/* ------------------------------------------------------------------ */

function userProfile(user) {
  return {
    userId: user._id.toString(),
    username: user.username,
    role: user.role,
  };
}

/* ------------------------------------------------------------------ */
/*  POST /register — Create a new account                             */
/* ------------------------------------------------------------------ */

router.post('/register', authLimiter, sanitizeMiddleware, async (req, res) => {
  try {
    const { username, password } = req.body;

    /* --- Validate presence and type -------------------------------- */
    if (!username || typeof username !== 'string' || username.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Username is required.',
      });
    }

    if (!password || typeof password !== 'string' || password.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Password is required.',
      });
    }

    /* --- Password complexity (cheap sync guard before async DB work) -- */
    if (!PASSWORD_REGEX.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password does not meet complexity requirements.',
      });
    }

    /* --- Check for duplicate username --------------------------------*/
    const existingUser = await User.findOne({ username: username.trim() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Username already exists.',
      });
    }

    /* --- First-user-is-admin logic ----------------------------------*/
    const userCount = await User.countDocuments();
    const role = userCount === 0 ? 'admin' : 'pending';

    /* --- Create user (pre-save hook hashes password) -----------------*/
    const newUser = new User({
      username: username.trim(),
      password,
      role,
    });
    await newUser.save();

    /* --- Respond — 201 (JWT as httpOnly cookie for non-pending roles) --*/
    if (role === 'pending') {
      return res.status(201).json({
        success: true,
        message: 'Cuenta registrada exitosamente. Espera aprobación del administrador.',
        role: 'pending',
      });
    }

    const accessToken = signAccessToken(newUser);
      const refreshTokenValue = await signRefreshToken(newUser);
      setAuthCookies(res, accessToken, refreshTokenValue);
    res.status(201).json({
      success: true,
      user: userProfile(newUser),
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, errors: messages });
    }
    logger.error('[auth] POST /register error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /login — Authenticate and return a JWT                       */
/* ------------------------------------------------------------------ */

router.post('/login', authLimiter, sanitizeMiddleware, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || typeof username !== 'string' || username.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Username is required.',
      });
    }

    if (!password || typeof password !== 'string' || password.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Password is required.',
      });
    }

    /* --- Find user (must include the excluded password field) ----------*/
    const user = await User.findOne({ username: username.trim() }).select('+password +totpEnabled');

    /* --- Verify credentials ----------------------------------------- */
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    /* --- Block pending users ---------------------------------------- */
    if (user.role === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Tu cuenta está pendiente de aprobación por un administrador.',
      });
    }

    /* --- Check 2FA status ------------------------------------------------*/
    if (user.totpEnabled) {
      /* --- Set short-lived temp session cookie for 2FA verification ---- */
      const isProd = process.env.NODE_ENV === 'production';
      const tempToken = createTempAuthToken(user._id.toString());
      res.cookie('tempAuthSession', tempToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'Strict' : 'Lax',
        maxAge: TEMP_SESSION_TTL_MS,
        path: '/api/auth/2fa/verify',
      });

      return res.status(403).json({
        success: false,
        status: '2FA_REQUIRED',
        message: 'Two-factor authentication required.',
        userId: user._id.toString(),
      });
    }

    /* --- Revoke old refresh tokens (rotation) ------------------------- */
    await RefreshToken.updateMany(
      { userId: user._id, revoked: false },
      { revoked: true, revokedAt: new Date() }
    );

    /* --- Set JWT cookie and respond — 200 -----------------------------*/
    const accessToken = signAccessToken(user);
    const refreshTokenValue = await signRefreshToken(user);
    setAuthCookies(res, accessToken, refreshTokenValue);
    res.json({
      success: true,
      user: userProfile(user),
    });
  } catch (err) {
    logger.error('[auth] POST /login error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /refresh — Rotate tokens via a valid refresh JWT             */
/* ------------------------------------------------------------------ */

router.post('/refresh', authLimiter, sanitizeMiddleware, async (req, res) => {
  try {
    const raw = req.cookies?.refreshToken;
    if (!raw) {
      return res.status(401).json({ success: false, message: 'No refresh token provided.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(raw, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        res.clearCookie('accessToken', { path: '/api' });
        res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
        return res.status(401).json({ success: false, message: 'Refresh token expired.' });
      }
      return res.status(403).json({ success: false, message: 'Invalid refresh token.' });
    }

    const stored = await RefreshToken.findByToken(raw);
    if (!stored || !stored.isValid()) {
      if (stored) {
        await RefreshToken.updateMany(
          { userId: stored.userId, revoked: false },
          { revoked: true, revokedAt: new Date() }
        );
      }
      res.clearCookie('accessToken', { path: '/api' });
      res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
      return res.status(401).json({ success: false, message: 'Refresh token revoked or not found.' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      res.clearCookie('accessToken', { path: '/api' });
      res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }

    stored.revoked = true;
    stored.revokedAt = new Date();
    await stored.save();

    const newAccessToken = signAccessToken(user);
    const newRefreshTokenValue = await signRefreshToken(user);
    setAuthCookies(res, newAccessToken, newRefreshTokenValue);

    res.json({ success: true, message: 'Tokens rotated.' });
  } catch (err) {
    logger.error('[auth] POST /refresh error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /me — Return the authenticated user's profile                 */
/* ------------------------------------------------------------------ */

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    res.json(userProfile(user));
  } catch (err) {
    logger.error('[auth] GET /me error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /logout — Revoke all refresh tokens and clear cookies        */
/* ------------------------------------------------------------------ */

router.post('/logout', authMiddleware, async (req, res) => {
  try {
    if (req.user?.userId) {
      await RefreshToken.updateMany(
        { userId: req.user.userId, revoked: false },
        { revoked: true, revokedAt: new Date() }
      );
    }
  } catch {
    // Best-effort — do not fail logout if DB write fails
  }

  res.clearCookie('accessToken', { path: '/api' });
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
  res.json({ success: true, message: 'Logged out' });
});

export default router;
