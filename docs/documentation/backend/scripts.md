# `scripts`

> Path: `backend/scripts/`
> Last updated: 2026-07-18
> Type: Leaf folder

CLI utility scripts for the backend. Currently contains the MongoDB backup automation script (`backup.js`) and the idempotent admin seed helper (`seedAdmin.js`). Both are ESM modules that can be invoked directly via `node` or through npm scripts defined in `package.json`.

---

## 📄 `backup.js`

ESM CLI script that automates MongoDB backups using `mongodump`. Creates timestamped, gzip-compressed backup folders and enforces age-based retention to prevent disk-space exhaustion. Designed for cron or CI integration — returns exit code 0 on success, 1 on failure. Uses safe `execFile` with array arguments (no shell injection vector).

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `node:child_process` | `execFile` (named) | External (built-in) |
| `node:fs/promises` | `default` (namespace as `fs`) | External (built-in) |
| `node:path` | `default` (namespace as `path`) | External (built-in) |
| `node:os` | `default` (namespace as `os`) | External (built-in) |
| `../utils/logger.js` | `default` (pino logger singleton) | Internal |

### Configuration

Environment variables read by the script at runtime, with safe defaults:

| Variable | Default value | Purpose |
|----------|--------------|---------|
| `BACKUP_DIR` | `<os.tmpdir()>/where-is-my-model-backups` | Directory where timestamped backup folders are created. For production, mount a persistent volume to this path. |
| `BACKUP_RETENTION_DAYS` | `7` | Number of days to retain backups. Older backups are deleted after each successful run. |
| `MONGODB_URI` | *(derived from component vars)* | Full MongoDB connection URI. If set, used directly. Otherwise constructed from `MONGODB_USERNAME`, `MONGODB_PASSWORD`, host `mongo`, port `27017`, database `where-is-my-model`. |
| `MONGODB_DATABASE` | `where-is-my-model` | Database name passed to `mongodump --db`. |

### Functions

- **`buildDumpUri() → string`**
  Constructs the MongoDB connection URI for mongodump. Mirrors the pattern used in `server.js` — prefers a full `MONGODB_URI` if available, otherwise builds from component env vars (`MONGODB_USERNAME`, `MONGODB_PASSWORD`) with hardcoded host `mongo` (Docker Compose DNS; for native local dev, replace with `localhost`), port `27017`, and database `where-is-my-model`.
  - **Returns:** A valid MongoDB connection URI string for mongodump.

- **`cleanupOldBackups(directory: string, maxAgeDays: number) → void`** (async)
  Scans the backup directory for folders prefixed with `where-is-my-model-backup-`. Compares each folder's modification time against the cutoff timestamp (`now - maxAgeDays * 24h`). Deletes folders older than the threshold using recursive removal. All deletions are logged via pino at info level. Failures are caught and logged at warn level — they do not abort the backup run.
  - `directory`: Absolute path to the backup root directory.
  - `maxAgeDays`: Maximum age in days before a backup folder is considered stale.
  - **Returns:** nothing — side-effect only (file deletion).

- **`runBackup() → void`** (async)
  Main backup workflow orchestrator. Executes five sequential steps:
    1. **Ensure backup directory exists** — `fs.mkdir(BACKUP_DIR, { recursive: true })`.
    2. **Build timestamped output path** — ISO timestamp formatted as `where-is-my-model-backup-YYYY-MM-DD-HHMMSS` inside `BACKUP_DIR`.
    3. **Execute `mongodump --gzip`** — Uses `execFile` with array arguments (safe against shell injection). Passes the URI from `buildDumpUri()`, target database name, `--gzip` flag for compression, and the timestamped output directory. Errors are logged at error level with stderr capture.
    4. **Log success** — Timestamped path echoed to structured logs.
    5. **Cleanup old backups** — Calls `cleanupOldBackups()` with configured retention policy.
  On success, exits with code 0. On any failure, exits with code 1. All logging uses the shared pino logger (no `console.*` calls).
  - **Returns:** nothing — side-effect only (calls `process.exit(0)` or `process.exit(1)`).

---

## 📄 `seedAdmin.js`

Idempotent helper that creates an initial admin user on first server startup. Imported by `server.js` — not intended to be run directly as a CLI script (module-level guard prevents accidental direct execution). If the `users` collection is empty and both `ADMIN_USERNAME` and `ADMIN_PASSWORD` env vars are set, it hashes the password via `bcryptjs.hash()` and inserts a raw document using `User.collection.insertOne()` to bypass Mongoose pre-save hooks (preventing double-hashing). Subsequent runs are silent no-ops.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `bcryptjs` | `default` (namespace) | External |
| `../models/User.js` | `default` (User model) | Internal |
| `../utils/logger.js` | `default` (pino logger singleton) | Internal |

### Functions

- **`seedAdmin() → void`** (async, exported)
  Idempotent admin creation. Checks user count; if zero and both credentials are set, creates an admin user with role `'admin'`. If users already exist, returns silently without logging. If env vars are missing, emits a warning. Direct `bcryptjs.hash()` call defends against Mongoose hook bypass (no double-hashing).
  - **Returns:** nothing — side-effect only (MongoDB insert on first run).
