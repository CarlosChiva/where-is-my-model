import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });
// NOTE: If running in production via Docker Compose, the compose file passes
// environment variables directly, making this dotenv call a no-op for any
// vars defined at both levels. This is safe because docker-compose env
// takes precedence.

import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { globalLimiter } from './middleware/rateLimit.js';

/* ------------------------------------------------------------------ */
/*  Configuration                                                     */
/* ------------------------------------------------------------------ */

const PORT = process.env.PORT || 8080;
const CLIENT_URL = process.env.CLIENT_URL || 'https://localhost,http://localhost:3000';

function buildMongoUri() {
  const host = process.env.MONGODB_HOST || 'localhost';
  const port = process.env.MONGODB_PORT || '27017';
  const db = process.env.MONGODB_DATABASE || 'where-is-my-model';
  const user = process.env.MONGODB_USERNAME;
  const pass = process.env.MONGODB_PASSWORD;

  if (user && pass) {
    console.log('[server] ✓ MongoDB: authenticated mode');
    return `mongodb://${user}:${pass}@${host}:${port}/${db}`;
  }
  console.log('[server] ⚠ MongoDB: no-auth mode (local dev)');
  return `mongodb://${host}:${port}/${db}`;
}

const MONGODB_URI = buildMongoUri();

/* ------------------------------------------------------------------ */
/*  Required environment validation                                   */
/* ------------------------------------------------------------------ */

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN;

if (!JWT_SECRET || JWT_SECRET.length < 64) {
  console.error(
    '[server] ✗ JWT_SECRET is not set or is too short (minimum 64 characters). ' +
    'Generate one with: openssl rand -base64 48'
  );
  process.exit(1);
}

if (!JWT_EXPIRES_IN) {
  console.error(
    '[server] ✗ JWT_EXPIRES_IN is not set. Default: 15m'
  );
  process.exit(1);
}

if (!JWT_REFRESH_SECRET || JWT_REFRESH_SECRET.length < 64) {
  console.error(
    '[server] ✗ JWT_REFRESH_SECRET is not set or is too short (minimum 64 characters). ' +
    'Generate one with: openssl rand -base64 48'
  );
  process.exit(1);
}

if (!JWT_REFRESH_EXPIRES_IN) {
  console.error(
    '[server] ✗ JWT_REFRESH_EXPIRES_IN is not set. Default: 7d'
  );
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/*  Express app and middleware                                        */
/* ------------------------------------------------------------------ */

const app = express();

// Trust the first reverse proxy (nginx) so that forwarded
// headers (X-Forwarded-Proto, X-Real-IP, etc.) are honored.
app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    xXssProtection: false,
  })
);

const allowedOrigins = CLIENT_URL.split(',').map(u => u.trim());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use('/api', globalLimiter);

/* ------------------------------------------------------------------ */
/*  Health check                                                      */
/* ------------------------------------------------------------------ */

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

/* ------------------------------------------------------------------ */
/*  Route registration (deferred until DB connects)                   */
/*  Order matters to avoid Express parameter collision:                */
/*    Auth router first — /api/auth before any dynamic segments        */
/*    Health router second — /api/check-health/pcs/:pcId won't collide */
/*    Services router third — /api/pcs/:pcId/services before :id       */
/*    PCs router last — /api/pcs catches the rest                      */
/* ------------------------------------------------------------------ */

async function registerRoutes() {
  /* --- 2FA router must be registered BEFORE general auth router ---- */
  /* so that /api/auth/2fa/* is matched by its own router first.       */
  try {
    const twoFactorModule = await import('./routes/twoFactor.js');
    app.use('/api/auth/2fa', twoFactorModule.default);
    console.log('[server] ✓ TwoFactor router registered at /api/auth/2fa');
  } catch {
    console.warn(
      '[server] ⚠ TwoFactor router not found — ' +
      '/api/auth/2fa endpoints unavailable (create routes/twoFactor.js)'
    );
  }

  try {
    const authModule = await import('./routes/auth.js');
    app.use('/api/auth', authModule.default);
    console.log('[server] ✓ Auth router registered at /api/auth');
  } catch {
    console.warn(
      '[server] ⚠ Auth router not found — ' +
      '/api/auth endpoints unavailable (create routes/auth.js)'
    );
  }

  try {
    const usersModule = await import('./routes/users.js');
    app.use('/api/users', usersModule.default);
    console.log('[server] ✓ Users router registered at /api/users');
  } catch {
    console.warn(
      '[server] ⚠ Users router not found — ' +
      '/api/users endpoints unavailable (create routes/users.js)'
    );
  }

  try {
    const healthModule = await import('./routes/health.js');
    app.use('/api/check-health', healthModule.default);
    console.log('[server] ✓ Health router registered at /api/check-health');
  } catch {
    console.warn(
      '[server] ⚠ Health router not found — ' +
      '/api/check-health endpoints unavailable (create routes/health.js)'
    );
  }

  try {
    const servicesModule = await import('./routes/services.js');
    app.use('/api/pcs/:pcId/services', servicesModule.default);
    console.log('[server] ✓ Services router registered at /api/pcs/:pcId/services');
  } catch {
    console.warn(
      '[server] ⚠ Services router not found — ' +
      '/api/pcs/:pcId/services endpoints unavailable (create routes/services.js)'
    );
  }

  try {
    const pcsModule = await import('./routes/pcs.js');
    app.use('/api/pcs', pcsModule.default);
    console.log('[server] ✓ PCs router registered at /api/pcs');
  } catch {
    console.warn(
      '[server] ⚠ PCs router not found — ' +
      '/api/pcs endpoints unavailable (create routes/pcs.js)'
    );
  }
}

/* ------------------------------------------------------------------ */
/*  MongoDB connection and server startup                             */
/* ------------------------------------------------------------------ */

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('[server] ✓ Connected to MongoDB');
  } catch (err) {
    console.error('[server] ✗ MongoDB connection failed:', err.message);
    process.exit(1);
  }

  await registerRoutes();

  /* ---------------------------------------------------------------- */
  /*  Global error handler — safety net for unhandled errors           */
  /*  Must be registered AFTER all routes so it only catches errors    */
  /*  that escape route-level try/catch blocks.                       */
  /* ---------------------------------------------------------------- */
  app.use((err, req, res, _next) => {
    // JSON parse errors from express.json() middleware
    if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      console.warn(`[server] ⚠ JSON parse error: ${err.message}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON in request body.',
      });
    }

    // Mongoose CastError — invalid ObjectId in URL parameters
    if (err.name === 'CastError') {
      console.warn(`[server] ⚠ Invalid ${err.path}: ${err.value}`);
      return res.status(400).json({
        success: false,
        message: `Invalid value for parameter "${err.path}".`,
      });
    }

    // Mongoose ValidationError — schema-level validation failure
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      console.warn(`[server] ⚠ Validation error:`, messages);
      return res.status(400).json({ success: false, errors: messages });
    }

    // Anything else — log and return 500
    console.error('[server] ✗ Unhandled error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  });

  app.listen(PORT, () => {
    console.log(`[server] ✓ Listening on port ${PORT}`);
  });
}

start();
