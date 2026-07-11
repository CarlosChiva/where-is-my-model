import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });
// NOTE: If running in production via Docker Compose, the compose file passes
// environment variables directly, making this dotenv call a no-op for any
// vars defined at both levels. This is safe because docker-compose env
// takes precedence.

import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';

/* ------------------------------------------------------------------ */
/*  Configuration                                                     */
/* ------------------------------------------------------------------ */

const PORT = process.env.PORT || 8080;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/where-is-my-model';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

/* ------------------------------------------------------------------ */
/*  Express app and middleware                                        */
/* ------------------------------------------------------------------ */

const app = express();

const allowedOrigins = CLIENT_URL.split(',').map(u => u.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

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
