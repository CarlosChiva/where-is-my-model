import express from 'express';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import speakeasy from 'speakeasy';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import { authMiddleware } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import logger from '../utils/logger.js';

const router = express.Router();

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const TEMP_SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes
const APP_NAME = 'WhereIsMyModel';

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
/*  Helper: verify and extract userId from a temp session cookie      */
/* ------------------------------------------------------------------ */
function verifyTempAuthToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (Date.now() - decoded.ts > TEMP_SESSION_TTL_MS) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
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
/*  POST /api/auth/2fa/setup                                          */
/*  Authenticated via authMiddleware — user is already logged in.     */
/*  Generates a TOTP secret, stores it on the user (not yet enabled),*/
/*  and returns a QR code data URI + plaintext manual entry code.     */
/* ------------------------------------------------------------------ */

router.post('/setup', authLimiter, authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('+totpSecret');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    /* --- Generate a fresh TOTP secret -------------------------------- */
    const secret = speakeasy.generateSecret({
      name: `${APP_NAME}:${user.username}`,
      length: 20,
    });

    /* --- Persist secret on the user (not yet enabled) ------------------ */
    user.totpSecret = secret.base32;
    await user.save();

    /* --- Generate QR code data URI ----------------------------------- */
    const qrDataUri = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      success: true,
      message: 'TOTP secret generated successfully.',
      qrCode: qrDataUri,
      manualEntry: secret.base32,
    });
  } catch (err) {
    logger.error('[2fa] POST /setup error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /api/auth/2fa/verify                                         */
/*  Dual-mode endpoint:                                               */
/*    Mode A — Post-login flow: reads `tempAuthSession` cookie.       */
/*    Mode B — Mid-session verify: reads `accessToken` cookie.        */
/*                                                                    */
/*  On success, issues full session cookies (access + refresh) and    */
/*  clears the temp session.                                          */
/* ------------------------------------------------------------------ */

router.post('/verify', authLimiter, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'TOTP code is required.',
      });
    }

    let userId = null;

    /* --- Mode A: post-login temp session ----------------------------- */
    const tempToken = req.cookies?.tempAuthSession;
    if (tempToken) {
      const decoded = verifyTempAuthToken(tempToken);
      if (decoded && decoded.userId) {
        userId = decoded.userId;
      }
    }

    /* --- Mode B: already authenticated mid-session ------------------- */
    if (!userId && req.cookies?.accessToken) {
      try {
        const decoded = jwt.verify(req.cookies.accessToken, process.env.JWT_SECRET);
        userId = decoded.userId;
      } catch {
        /* fall through — invalid access token */
      }
    }

    if (!userId) {
      res.clearCookie('tempAuthSession', { path: '/api/auth/2fa/verify' });
      return res.status(401).json({
        success: false,
        message: 'No valid 2FA session. Please log in again.',
      });
    }

    /* --- Load user with TOTP secret ---------------------------------- */
    const user = await User.findById(userId).select('+totpSecret +password');

    if (!user || !user.totpSecret) {
      res.clearCookie('tempAuthSession', { path: '/api/auth/2fa/verify' });
      return res.status(400).json({
        success: false,
        message: '2FA is not set up for this account.',
      });
    }

    /* --- Verify TOTP code (timing-safe via speakeasy) ---------------- */
    const verified = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token: code.trim(),
      window: 1,
    });

    if (!verified) {
      res.clearCookie('tempAuthSession', { path: '/api/auth/2fa/verify' });
      return res.status(401).json({
        success: false,
        message: 'Invalid TOTP code.',
      });
    }

    /* --- Code valid — if 2FA is not yet enabled, enable it now ------- */
    if (!user.totpEnabled) {
      user.totpEnabled = true;
      await user.save();
    }

    /* --- Issue full session cookies ---------------------------------- */
    await RefreshToken.updateMany(
      { userId: user._id, revoked: false },
      { revoked: true, revokedAt: new Date() }
    );

    const accessToken = signAccessToken(user);
    const refreshTokenValue = await signRefreshToken(user);
    setAuthCookies(res, accessToken, refreshTokenValue);

    /* --- Clear temp session cookie ----------------------------------- */
    res.clearCookie('tempAuthSession', { path: '/api/auth/2fa/verify' });

    res.json({
      success: true,
      message: 'Two-factor authentication verified.',
      user: userProfile(user),
    });
  } catch (err) {
    logger.error('[2fa] POST /verify error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /api/auth/2fa/disable                                        */
/*  Authenticated via authMiddleware. Requires current password in   */
/*  the request body to confirm identity. Clears all TOTP state.      */
/* ------------------------------------------------------------------ */

router.post('/disable', authLimiter, authMiddleware, async (req, res) => {
  try {
    const { password, code } = req.body;

    if (!password || typeof password !== 'string' || password.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Current password is required to disable 2FA.',
      });
    }

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'TOTP code is required to disable 2FA.',
      });
    }

    const user = await User.findById(req.user.userId)
      .select('+password +totpSecret +totpEnabled');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    /* --- Verify password first --------------------------------------- */
    const passwordValid = await user.comparePassword(password);
    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password.',
      });
    }

    /* --- Verify TOTP code (timing-safe via speakeasy) ------------------ */
    const totpVerified = speakeasy.totp.verify({
      secret: user.totpSecret,
      encoding: 'base32',
      token: code.trim(),
      window: 1,
    });

    if (!totpVerified) {
      return res.status(401).json({
        success: false,
        message: 'Invalid TOTP code.',
      });
    }

    /* --- Clear TOTP fields -------------------------------------------- */
    user.totpSecret = undefined;
    user.totpEnabled = false;
    await user.save();

    res.json({
      success: true,
      message: 'Two-factor authentication has been disabled.',
    });
  } catch (err) {
    logger.error('[2fa] POST /disable error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /api/auth/2fa/status                                          */
/*  Authenticated via authMiddleware. Returns whether TOTP is        */
/*  enabled for the current user (boolean).                           */
/* ------------------------------------------------------------------ */

router.get('/status', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('totpEnabled');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    res.json({
      success: true,
      totpEnabled: !!user.totpEnabled,
    });
  } catch (err) {
    logger.error('[2fa] GET /status error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
