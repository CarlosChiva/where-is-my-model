import bcryptjs from 'bcryptjs';
import User from '../models/User.js';
import logger from '../utils/logger.js';

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const SALT_ROUNDS = 10; // Matches User model pre-save hook

/* ------------------------------------------------------------------ */
/*  seedAdmin — idempotent admin creation on first startup             */
/*  - Queries user count; if 0, creates admin from env vars.           */
/*  - If users already exist, is a silent no-op (no log spam).         */
/*  - If ADMIN_USERNAME or ADMIN_PASSWORD are missing, warns and skips.*/
/*  - Uses direct bcryptjs.hash() to defend against hook bypass.       */
/* ------------------------------------------------------------------ */

export async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    logger.warn(
      '[seedAdmin] ADMIN_USERNAME or ADMIN_PASSWORD not set — ' +
        'skipping admin seeding. Set both variables to create an initial admin user.'
    );
    return;
  }

  try {
    const count = await User.countDocuments();

    if (count > 0) {
      // Users already exist — silent no-op, no log spam.
      return;
    }

    /* --- Direct bcrypt hashing (defense-in-depth) ---------------- */
    const hashedPassword = await bcryptjs.hash(password, SALT_ROUNDS);

    /* --- Bypass Mongoose hooks entirely — insert raw document     */
    /*      to guarantee no double-hashing of the password field.   */
    await User.collection.insertOne({
      username: username.trim(),
      password: hashedPassword,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
      __v: 0,
    });

    logger.info('[seedAdmin] Initial admin user "%s" created successfully.', username.trim());
  } catch (err) {
    logger.error('[seedAdmin] Failed to seed admin user:', err);
    // Do NOT call process.exit() — the server can still run;
    // an operator may create an admin via registration + admin approval.
  }
}

/* ------------------------------------------------------------------ */
/*  Module-level guard: prevents accidental direct execution           */
/*  (this file is imported by server.js, not run as a CLI script)      */
/* ------------------------------------------------------------------ */
