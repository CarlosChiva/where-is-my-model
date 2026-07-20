import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import logger from '../utils/logger.js';

/* ------------------------------------------------------------------ */
/*  Configuration — env vars with safe defaults                         */
/* ------------------------------------------------------------------ */

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(os.tmpdir(), 'where-is-my-model-backups');
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS, 10) || 7;
const BACKUP_PREFIX = 'where-is-my-model-backup';

/* ------------------------------------------------------------------ */
/*  buildDumpUri — construct MongoDB URI for mongodump                   */
/*  Mirrors the pattern used in server.js for connection strings.       */
/* ------------------------------------------------------------------ */

function buildDumpUri() {
  // Prefer the full MONGODB_URI if available (set by .env.development)
  if (process.env.MONGODB_URI) {
    return process.env.MONGODB_URI;
  }

  const user = process.env.MONGODB_USERNAME;
  const pass = process.env.MONGODB_PASSWORD;
  const host = 'mongo'; // Docker Compose DNS; localhost for native dev
  const port = '27017';
  const db = 'where-is-my-model';

  if (user && pass) {
    return `mongodb://${user}:${pass}@${host}:${port}/${db}`;
  }
  return `mongodb://${host}:${port}/${db}`;
}

/* ------------------------------------------------------------------ */
/*  cleanupOldBackups — retain only last N days of backups               */
/* ------------------------------------------------------------------ */

async function cleanupOldBackups(directory, maxAgeDays) {
  const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);

  try {
    const entries = await fs.readdir(directory);

    for (const entry of entries) {
      if (!entry.startsWith(BACKUP_PREFIX)) continue;
      const fullPath = path.join(directory, entry);
      const stat = await fs.stat(fullPath);
      if (stat.mtimeMs < cutoff) {
        logger.info('[backup] Removing old backup: %s', entry);
        await fs.rm(fullPath, { recursive: true });
      }
    }
  } catch (err) {
    logger.warn('[backup] Cleanup scan failed — backups may accumulate:', err.message);
  }
}

/* ------------------------------------------------------------------ */
/*  runBackup — main backup workflow                                   */
/* ------------------------------------------------------------------ */

async function runBackup() {
  logger.info('[backup] Starting backup to %s', BACKUP_DIR);

  try {
    /* --- Ensure backup directory exists -------------------------------- */
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    /* --- Build timestamped output path --------------------------------- */
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 19).replace(/:/g, '').replace('T', '-').replace(' ', '-');
    // Format: where-is-my-model-backup-2026-07-18-143022
    const timestampedDir = path.join(BACKUP_DIR, `${BACKUP_PREFIX}-${dateStr}`);

    /* --- Execute mongodump --------------------------------------------- */
    const dumpUri = buildDumpUri();
    const dbName = process.env.MONGODB_DATABASE || 'where-is-my-model';

    logger.info('[backup] mongodump output: %s', timestampedDir);

    await new Promise((resolve, reject) => {
      execFile('mongodump', [
        '--uri', dumpUri,
        '--db', dbName,
        '--gzip',
        '--out', timestampedDir,
      ], (error, stdout, stderr) => {
        if (error) {
          logger.error('[backup] mongodump failed:', error.message);
          if (stderr) logger.error('[backup] mongodump stderr: %s', stderr);
          return reject(error);
        }
        resolve();
      });
    });

    /* --- Log success --------------------------------------------------- */
    logger.info('[backup] Backup completed successfully: %s', timestampedDir);

    /* --- Cleanup old backups ------------------------------------------- */
    await cleanupOldBackups(BACKUP_DIR, RETENTION_DAYS);

    process.exit(0);
  } catch (err) {
    logger.error('[backup] Backup failed:', err.message || err);
    process.exit(1);
  }
}

/* ------------------------------------------------------------------ */
/*  Entry point                                                        */
/* ------------------------------------------------------------------ */

runBackup();
