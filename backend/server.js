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
import requestId from './middleware/requestId.js';
import versionMiddleware from './middleware/versionMiddleware.js';
import logger, { createHttpLogger } from './utils/logger.js';
import User from './models/User.js';

const API_PREFIX = '/api/v1';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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
    logger.info('MongoDB: authenticated mode');
    return `mongodb://${user}:${pass}@${host}:${port}/${db}?authSource=admin`;
  }
  logger.info('MongoDB: no-auth mode (local dev)');
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
  logger.error(
    'JWT_SECRET is not set or is too short (minimum 64 characters). ' +
    'Generate one with: openssl rand -base64 48'
  );
  process.exit(1);
}

if (!JWT_EXPIRES_IN) {
  logger.error(
    'JWT_EXPIRES_IN is not set. Default: 15m'
  );
  process.exit(1);
}

if (!JWT_REFRESH_SECRET || JWT_REFRESH_SECRET.length < 64) {
  logger.error(
    'JWT_REFRESH_SECRET is not set or is too short (minimum 64 characters). ' +
    'Generate one with: openssl rand -base64 48'
  );
  process.exit(1);
}

if (!JWT_REFRESH_EXPIRES_IN) {
  logger.error(
    'JWT_REFRESH_EXPIRES_IN is not set. Default: 7d'
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
    permissionsPolicy: {
      policies: {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: [],
        usb: [],
        magnetometer: [],
        gyroscope: [],
        accelerometer: [],
        fullscreen: ['self'],
        pictureInPicture: [],
      },
    },
    xXssProtection: false,
  })
);

const allowedOrigins = CLIENT_URL.split(',').map(u => u.trim());
app.use(cors({ origin: allowedOrigins, credentials: true }));

/* ------------------------------------------------------------------ */
/*  HTTP request/response logging (pino-http)                         */
/*  Registered after helmet + CORS to ensure security headers and     */
/*  origin checks are applied first. Uses the shared pino instance    */
/*  for consistent log format across all application output.         */
/* ------------------------------------------------------------------ */
app.use(createHttpLogger());
app.use(requestId); // Task 17: request ID tracing (after pino-http so req.id is populated)
app.use(versionMiddleware); // Task 23: API versioning — sets X-API-Version header

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
/*    Auth router first — ${API_PREFIX}/auth before any dynamic segments */
/*    Health router second — ${API_PREFIX}/check-health/pcs/:pcId won't collide */
/*    Services router third — ${API_PREFIX}/pcs/:pcId/services before :id      */
/*    PCs router last — ${API_PREFIX}/pcs catches the rest                         */
/* ------------------------------------------------------------------ */

async function registerRoutes() {
  /* --- 2FA router must be registered BEFORE general auth router ---- */
  /* so that ${API_PREFIX}/auth/2fa/* is matched by its own router first. */
  try {
    const twoFactorModule = await import('./routes/twoFactor.js');
    app.use(`${API_PREFIX}/auth/2fa`, twoFactorModule.default);
    logger.info(`TwoFactor router registered at ${API_PREFIX}/auth/2fa`);
  } catch {
    logger.warn(
      `TwoFactor router not found — ` +
      `${API_PREFIX}/auth/2fa endpoints unavailable (create routes/twoFactor.js)`
    );
  }

  try {
    const authModule = await import('./routes/auth.js');
    app.use(`${API_PREFIX}/auth`, authModule.default);
    logger.info(`Auth router registered at ${API_PREFIX}/auth`);
  } catch {
    logger.warn(
      `Auth router not found — ` +
      `${API_PREFIX}/auth endpoints unavailable (create routes/auth.js)`
    );
  }

  try {
    const auditLogsModule = await import('./routes/auditLogs.js');
    app.use(`${API_PREFIX}/audit-logs`, auditLogsModule.default);
    logger.info(`AuditLogs router registered at ${API_PREFIX}/audit-logs`);
  } catch {
    logger.warn('AuditLogs router not available');
  }

  try {
    const usersModule = await import('./routes/users.js');
    app.use(`${API_PREFIX}/users`, usersModule.default);
    logger.info(`Users router registered at ${API_PREFIX}/users`);
  } catch {
    logger.warn(
      `Users router not found — ` +
      `${API_PREFIX}/users endpoints unavailable (create routes/users.js)`
    );
  }

  try {
    const healthModule = await import('./routes/health.js');
    app.use(`${API_PREFIX}/check-health`, healthModule.default);
    logger.info(`Health router registered at ${API_PREFIX}/check-health`);
  } catch {
    logger.warn(
      `Health router not found — ` +
      `${API_PREFIX}/check-health endpoints unavailable (create routes/health.js)`
    );
  }

  try {
    const servicesModule = await import('./routes/services.js');
    app.use(`${API_PREFIX}/pcs/:pcId/services`, servicesModule.default);
    logger.info(`Services router registered at ${API_PREFIX}/pcs/:pcId/services`);
  } catch {
    logger.warn(
      `Services router not found — ` +
      `${API_PREFIX}/pcs/:pcId/services endpoints unavailable (create routes/services.js)`
    );
  }

  try {
    const pcsModule = await import('./routes/pcs.js');
    app.use(`${API_PREFIX}/pcs`, pcsModule.default);
    logger.info(`PCs router registered at ${API_PREFIX}/pcs`);
  } catch {
    logger.warn(
      `PCs router not found — ` +
      `${API_PREFIX}/pcs endpoints unavailable (create routes/pcs.js)`
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Cleanup: remove unverified pending users older than 7 days        */
/* ------------------------------------------------------------------ */

async function cleanupUnverifiedUsers() {
  try {
    const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);
    const result = await User.deleteMany({
      role: 'pending',
      emailVerified: false,
      createdAt: { $lt: sevenDaysAgo },
    });
    if (result.deletedCount > 0) {
      logger.info(
        '[server] Cleaned up %d unverified user(s) older than 7 days',
        result.deletedCount
      );
    }
  } catch (err) {
    logger.warn('[server] Cleanup of unverified users failed:', err.message);
  }
}

/* ------------------------------------------------------------------ */
/*  MongoDB connection and server startup                             */
/* ------------------------------------------------------------------ */

async function start() {
  try {
    await mongoose.connect(MONGODB_URI, {
      retryWrites: false, // Standalone MongoDB in dev; transactions still work
    });
    logger.info('Connected to MongoDB');
  } catch (err) {
    logger.error('[server] MongoDB connection failed:', err.message);
    process.exit(1);
  }

  /* --- Remove stale unverified users at startup ------------------- */
  await cleanupUnverifiedUsers();

  /* --- Periodic cleanup every 24 hours ---------------------------- */
  setInterval(cleanupUnverifiedUsers, 24 * 60 * 60 * 1000);

  /* --- Seed initial admin user before routes are registered ------ */
  try {
    const { seedAdmin } = await import('./scripts/seedAdmin.js');
    await seedAdmin();
  } catch (err) {
    logger.warn(
      '[server] seedAdmin module unavailable — ' +
        'no initial admin user will be created automatically.'
    );
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
      logger.warn('JSON parse error: %s', err.message);
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON in request body.',
        requestId: req.id,
      });
    }

    // Mongoose CastError — invalid ObjectId in URL parameters
    if (err.name === 'CastError') {
      logger.warn('Invalid %s: %s', err.path, err.value);
      return res.status(400).json({
        success: false,
        message: `Invalid value for parameter "${err.path}".`,
        requestId: req.id,
      });
    }

    // Mongoose ValidationError — schema-level validation failure
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      logger.warn('Validation error:', messages);
      return res.status(400).json({
        success: false,
        errors: messages,
        requestId: req.id,
      });
    }

    // Anything else — log and return 500
    logger.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      requestId: req.id,
    });
  });

  app.listen(PORT, () => {
    logger.info('Listening on port %d', PORT);
  });
}

start();
