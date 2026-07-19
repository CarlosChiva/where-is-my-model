# `backend`

> Path: `backend/`
> Last updated: 2026-07-18 (email verification cleanup removed from server.js)
> Type: Composite folder

Express + Mongoose REST API server that manages GPU compute servers and their assigned network services. The backend enforces per-GPU VRAM capacity constraints at the schema level (Mongoose validators), middleware level (request-body validation), and route level (error handling). Deployed as a Node.js 20 Alpine container via Docker Compose, backed by MongoDB for persistent storage. Multi-GPU servers are fully supported — each GPU is individually tracked with its own VRAM allocation pool, and services can be reassigned between GPUs on the same server via partial-update routes.

---

## 📁 Subfolders

| Folder | Documentation | Description |
|--------|--------------|-------------|
| `models/` | [see docs](./models.md) | Mongoose schema definitions for the PC model (multi-GPU servers with embedded service subdocuments, per-GPU virtual fields, and document-level VRAM-cap validators). |
| `routes/` | [see docs](./routes.md) | Express Router modules providing CRUD REST endpoints for PCs (`/api/pcs`) and nested Services (`/api/pcs/:pcId/services`), authentication flows at `/api/auth` (with cookie-based two-token rotation and 2FA intercept), TOTP-based 2FA management at `/api/auth/2fa`, admin user listing at `/api/users`, and TCP health checks at `/api/check-health`. Standardized response envelopes and CastError handling. |
| `middleware/` | [see docs](./middleware.md) | Request-body validation middleware (collect-all-errors pattern) enforcing per-GPU VRAM limits, IPv4 format checks, and legacy vram-to-gpus-array transformation. Rate-limiting middleware (`express-rate-limit`) with three tiered limiters for global API, authentication endpoints, and health probes. Request-ID tracking middleware (`requestId.js`) guaranteeing a UUID on every request and echoing it via the `X-Request-ID` response header for distributed-tracing correlation. Input sanitization middleware (`sanitization.js`) that strips HTML tags, escapes dangerous characters, blocks NoSQL injection operators (`$gt`, etc.), and prevents prototype pollution (`__proto__`, `constructor`, `prototype`) — applied on all mutation routes (POST/PUT) before body validation. |
| `services/` | [see docs](./services.md) | Application-level services — TCP health-check utility (`healthChecker.js`) for probing the reachability of network services hosted on GPU compute servers using Node.js built-in `net`, protected against SSRF via `ssrfProtection.js`. The SMTP email delivery module (`emailService.js`) has been fully removed as part of deprecating the email verification feature. |
| `utils/` | [see docs](./utils.md) | Shared logging infrastructure — Pino logger singleton, `pino-http` middleware factory with sensitive query-parameter stripping and distributed-tracing request ID generation (via `genReqId` callback using RFC 4122 UUID validation), and URL sanitization for access-log hygiene. |
| `scripts/` | [see docs](./scripts.md) | CLI utility scripts — automated MongoDB backup via `mongodump --gzip` with age-based retention management (`backup.js`), plus idempotent admin user seeding helper (`seedAdmin.js`). |

---

## 📄 Direct files

### `server.js`

Application entry point. Loads environment configuration, constructs the MongoDB connection URI dynamically via `buildMongoUri()` (supports both authenticated mode for Docker Compose deployments and unauthenticated mode for local development), performs startup validation of required secrets (JWT_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRES_IN), establishes the MongoDB connection via Mongoose, registers Express middleware in order — Helmet security headers (with explicit `permissionsPolicy` directive blocking camera, microphone, geolocation, payment, usb, magnetometer, gyroscope, accelerometer, and pictureInPicture for all origins; fullscreen allowed same-origin only; reduces XSS attack surface), CORS with origin allowlist, pino-http logging middleware (`createHttpLogger()` from `utils/logger.js`) for HTTP request/response logging with URL sanitization and distributed-tracing request ID generation, request ID tracing middleware (`requestId` from `middleware/requestId.js`) guaranteeing `req.id` presence and echoing `X-Request-ID` in every response, cookie parsing via `cookie-parser`, JSON body parsing, global rate limiting — serves a simple inline health check (`GET /api/health`), mounts six route modules in dependency-safe order (twoFactor first to prevent parameter collision, then auth, users, health, services before PCs), installs a global error handler that includes `requestId` in every JSON error envelope for log correlation, and starts listening on the configured port. Trusts the first reverse proxy for forwarded headers.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `dotenv` | `default` (namespace) | External |
| `cors` | `default` (namespace) | External |
| `cookie-parser` | `cookieParser` (default) | External |
| `express` | `default` (namespace) | External |
| `helmet` | `default` (namespace) | External |
| `mongoose` | `default` (namespace) | External |
| `./utils/logger.js` | `logger` (default), `createHttpLogger` (named) | Internal |
| `./middleware/rateLimit.js` | `globalLimiter` (named) | Internal |
| `./middleware/requestId.js` | `requestId` (default) | Internal |

### Configuration

| Variable | Default value | Purpose |
|----------|--------------|---------|
| `PORT` | `8080` | HTTP listening port |
| `MONGODB_HOST` | `localhost` | MongoDB server hostname (Docker: `mongo`; local dev: `localhost`) |
| `MONGODB_PORT` | `27017` | MongoDB server port |
| `MONGODB_DATABASE` | `where-is-my-model` | Database name |
| `MONGODB_USERNAME` | *(empty)* | MongoDB authentication username (leave empty for local dev without auth) |
| `MONGODB_PASSWORD` | *(empty)* | MongoDB authentication password (leave empty for local dev without auth) |
| `CLIENT_URL` | `http://localhost:3000` | Comma-separated list of allowed CORS origins |

### Startup validation

Before the Express app is constructed, `server.js` performs two mandatory environment variable checks. If either check fails, the process prints an error to stderr and exits with code 1 — the server will not start.

| Check | Condition | Error message |
|-------|-----------|---------------|
| `JWT_SECRET` | Must be set **and** at least 64 characters | `[server] ✗ JWT_SECRET is not set or is too short (minimum 64 characters). Generate one with: openssl rand -base64 48` |
| `JWT_EXPIRES_IN` | Must be set (any non-empty value) | `[server] ✗ JWT_EXPIRES_IN is not set. Default: 15m` |
| `JWT_REFRESH_SECRET` | Must be set **and** at least 64 characters | `[server] ✗ JWT_REFRESH_SECRET is not set or is too short (minimum 64 characters). Generate one with: openssl rand -base64 48` |
| `JWT_REFRESH_EXPIRES_IN` | Must be set (any non-empty value) | `[server] ✗ JWT_REFRESH_EXPIRES_IN is not set. Default: 7d` |

This validation ensures that a developer cannot accidentally start the server with a weak or missing JWT secret, which would compromise all signed tokens.

### Functions

- **`buildMongoUri() → string`**
  Dynamically constructs a MongoDB connection URI from component environment variables. Reads `MONGODB_HOST`, `MONGODB_PORT`, `MONGODB_DATABASE`, `MONGODB_USERNAME`, and `MONGODB_PASSWORD` from `process.env`. If both `MONGODB_USERNAME` and `MONGODB_PASSWORD` are present, builds an authenticated URI (`mongodb://user:pass@host:port/db`) and logs `[server] ✓ MongoDB: authenticated mode`. If either credential is missing, builds a plain URI (`mongodb://host:port/db`) and logs `[server] ⚠ MongoDB: no-auth mode (local dev)`. This dual-mode design allows the same server code to run in Docker Compose (with MongoDB auth enabled) and in local development (with MongoDB running without auth).
  - **Returns:** A valid MongoDB connection URI string.

- **`registerRoutes() → void`** (async)
  Dynamically imports and mounts six route modules in order: twoFactor router at `/api/auth/2fa` first (must precede auth to prevent Express parameter collision), auth router at `/api/auth` second, users router at `/api/users` third, health router at `/api/check-health` fourth, services router fifth at `/api/pcs/:pcId/services`, and PCs router sixth (last) at `/api/pcs`. The ordering prevents Express from matching `:pcId` against literal path segments (e.g., `"services"`) and ensures static auth/2FA routes are registered before any parameterized paths. Each import is wrapped in try/catch so that a missing route module degrades gracefully (warns to console rather than crashing).
  - **Returns:** nothing — side-effect only (calls `app.use()` for each router)

- **`start() → void`** (async)
  Top-level startup orchestrator. Connects to MongoDB, calls `registerRoutes()`, installs the global Express error handler (catches JSON parse errors, Mongoose CastErrors, Mongoose ValidationErrors, and unhandled exceptions), then calls `app.listen(PORT)`. Exits with code 1 if MongoDB connection fails.
  - **Returns:** nothing — side-effect only (starts HTTP server)

### Global Error Handler (Express middleware — `(err, req, res, next)`)

Registered after all routes; catches any error that escapes route-level try/catch blocks:

| Error type | HTTP status | Response envelope |
|-----------|-------------|-------------------|
| `SyntaxError` / `entity.parse.failed` | 400 | `{ success: false, message: 'Invalid JSON in request body.', requestId: req.id }` |
| Mongoose `CastError` | 400 | `{ success: false, message: 'Invalid value for parameter "{err.path}".', requestId: req.id }` |
| Mongoose `ValidationError` | 400 | `{ success: false, errors: [string, ...], requestId: req.id }` — extracted from `err.errors` |
| Unhandled (default) | 500 | `{ success: false, message: 'Internal server error', requestId: req.id }` |

---

### `seed.js`

Database seeding script that reads raw JSON data from the project root (`data.json`), transforms it from a slug-wrapped/hyphenated format into Mongoose-compatible camelCase documents, and is designed to be invoked via `npm run seed` or `docker compose exec backend node seed.js`. Loads `.env.development` relative to its own directory for the MongoDB connection URI.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `fs` (built-in) | `readFileSync` (named) | External |
| `url` (built-in) | `fileURLToPath` (named) | External |
| `path` (built-in) | `resolve`, `dirname` (named) | External |
| `mongoose` | `default` (namespace) | External |
| `dotenv` | `default` (namespace) | External |
| `./models/PC.js` | `default` (PC model) | Internal |

### Functions

- **`loadData() → object[]`**
  Reads `data.json` from the repository root (`../data.json`) using synchronous file I/O and parses it as JSON. Returns the raw parsed structure which uses hyphenated, slug-wrapped field names (e.g., `{ "pc": [{ "my-server": { "memoria-vram-en-gb": 24 } }] }`).
  - **Returns:** The full parsed JSON object containing the `pc` array.

- **`mapToMongooseDocuments(rawData: object) → object[]`**
  Transforms the raw data structure into an array of plain objects compatible with the Mongoose PC model. Unwraps each entry from its hyphenated slug key via `Object.values(entry)[0]`. Maps service fields (`nombre-servicio` → `nombre`, `tamaño-de-servicio-en-gpu` → `gpu`) to camelCase schema field names. Uses legacy `vram` scalar for backward compatibility with older `data.json` schemas (the middleware auto-transforms this into `gpus[]`.
  - `rawData`: The raw parsed JSON object from `loadData()`.
  - **Returns:** Array of plain objects, each shaped as `{ nombre, ip, vram, servicios: [{ nombre, puerto, gpu }] }`, ready to be passed to `PC.create()` or `PC.insertMany()`.

---

### `test-gpu-cap.js`

Integration verification script written in Node.js (uses built-in ES modules and native `fetch`). Exercises the GPU VRAM capacity enforcement by creating a test PC, adding services within/at/over the allocation limit, verifying correct reject-accept behavior, checking state stability after rejection, then auto-cleaning up. Outputs colorized pass/fail results with per-test assertions.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| *(none — uses only Node.js built-ins)* | — | Internal (built-in) |

### Configuration

| Argument | Default value | Purpose |
|----------|--------------|---------|
| `process.argv[2]` | `http://localhost:8080/api` | Base URL of the running backend API |

### Functions

- **`assert(condition: boolean, description: string) → void`**
  Test assertion helper. Increments either `passCount` or `failCount`, prints a colorized ✔/✘ indicator with the test description.
  - `condition`: Boolean expression to evaluate.
  - `description`: Human-readable message displayed alongside pass/fail status.
  - **Returns:** nothing — increments global counters and produces console output

- **`header(text: string) → void`**
  Prints a bordered section header with the given text. Used to demarcate each test step in the output.
  - `text`: Section title string.
  - **Returns:** nothing — side-effect only (console output)

- **`api(method: string, path: string, body?: object | null) → { status: number, body: any }`** (async)
  Thin HTTP client wrapper around native `fetch`. Sets `Content-Type: application/json`, serializes the body when provided, and attempts to parse the response as JSON. Returns an object containing the HTTP status code and parsed body.
  - `method`: HTTP method string (`GET`, `POST`, `DELETE`, etc.).
  - `path`: URL path relative to `BASE_URL`.
  - `body`: Optional JSON-serializable request body (default `null`).
  - **Returns:** `{ status: number, body: any }`

- **`cleanup() → void`** (async)
  Deletes the test PC using its stored `_id`. Invoked in the `finally` block to guarantee teardown. Handles deletion failures gracefully with warning messages rather than crashing the script.
  - **Returns:** nothing — side-effect only (HTTP DELETE to `/pcs/{pcId}`)

- **`run() → void`** (async)
  Main test sequence. Executes seven numbered tests:
    1. Create PC with 24 GB VRAM via `POST /pcs`.
    2. Add 16 GB service (expect 201 — within cap).
    3. Attempt 12 GB service (expect 400 — 28 > 24).
    4. Retrieve PC, verify exactly 1 service remains (rejection did not mutate state).
    5. Add 8 GB service (expect 201 — 24 = 24, exact cap).
    6. Attempt 1 GB service (expect 400 — 25 > 24).
    7. Final GET to verify 2 services with total GPU allocation = 24.
  Prints summary of pass/fail counts, exits with code 1 if any test failed.

---

### `test-gpu-cap.sh`

Shell counterpart to `test-gpu-cap.js`. Implements the same seven-test sequence using `curl` + `jq` instead of native Node.js fetch/colorized output via ANSI escape codes. Uses Bash strict mode (`set -euo pipefail`) and a `trap cleanup EXIT` mechanism for guaranteed teardown. Exit code 1 on any failure.

### Imports and dependencies

| Tool | Purpose |
|------|---------|
| `curl` | HTTP client for API calls |
| `jq` | JSON parsing from curl responses |
| `bash` | Script interpreter with strict mode enabled |

### Configuration

| Argument | Default value | Purpose |
|----------|--------------|---------|
| `$1` | `http://localhost:8080/api` | Base URL of the running backend API |

### Functions (Bash)

- **`pass(description: string) → void`**
  Increments PASS and TOTAL counters, prints a green ✔ indicator.

- **`fail(description: string) → void`**
  Increments FAIL and TOTAL counters, prints a red ✘ indicator.

- **`step(text: string) → void`**
  Prints a cyan-bordered section header to demarcate test steps.

- **`cleanup() → void`**
  Registered via `trap cleanup EXIT`. Deletes the test PC by its stored ID using curl. Handles failure gracefully (warns rather than aborts).

---

### `Dockerfile`

Single-stage Docker image for production deployment. Based on Node.js 20 Alpine (minimal footprint). Uses two distinct COPY layers to exploit Docker build-cache: first copies only `package*.json` for dependency installation (layer cached unless package files change), then copies the rest of the application source. In development mode, `docker-compose.yml` mounts the host `backend/` directory as a volume overlay, invalidating Layer 2 for live-reload capability.

### Build layers

| Layer | Command(s) | Cache sensitivity |
|-------|-----------|-------------------|
| Base image | `FROM node:20-alpine` | — |
| Layer 0 | `RUN apk add --no-cache mongodb-database-tools` | Cached unless Dockerfile changes. Installs `mongodump`/`mongorestore` required by `scripts/backup.js`. Placed before `USER appuser` switch so non-root user can execute the binaries. |
| Dependencies | `COPY package*.json ./` → `RUN npm install --production` | Cached unless `package.json` or `package-lock.json` change |
| Application | `COPY . .` | Rebuilt on every Docker build (overridden by volume mount in dev) |

### Runtime configuration

| Directive | Value |
|-----------|-------|
| Working directory | `/app` |
| Exposed port | `8080` |
| Default command | `node server.js` |

### Health check

A `HEALTHCHECK` directive is configured at the Dockerfile level so that Docker can determine whether the Express process inside the container is alive and able to respond. It runs as the non-root `appuser`, using Node.js's built-in `http` module — no external binaries required:

| Parameter | Value | Purpose |
|-----------|-------|---------|
| **command** | `node -e "require('http').get('http://localhost:8080/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"` | Hits the inline `/api/health` endpoint registered in `server.js`; exits 0 on HTTP 200, exits 1 otherwise |
| **interval** | `30s` | Frequency between health probes |
| **timeout** | `5s` | Maximum time a probe is allowed to run before being marked failed |
| **start-period** | `10s` | Grace period after container start during which failures are ignored (allows Express startup + MongoDB connection handshake to complete) |
| **retries** | `3` | Consecutive failures before Docker marks the container as `unhealthy` |

This health check enables Docker Compose's `condition: service_healthy` dependency — the frontend service will not start until the backend passes its first health probe.

---

### `package.json`

Node.js project manifest. Declares the backend as an ES module (`"type": "module"`), defines two npm scripts (`start` for production, `seed` for database initialization), and pins four runtime dependencies.

### Project metadata

| Field | Value |
|-------|-------|
| name | `where-is-my-model-backend` |
| version | `1.0.0` |
| type | `module` (ESM) |
| main | `server.js` |

### npm scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `start` | `node server.js` | Start the API server in production mode |
| `seed` | `node seed.js` | Populate MongoDB with initial GPU server data from `data.json` |
| `backup` | `node scripts/backup.js` | Create a timestamped, gzip-compressed MongoDB backup via mongodump; enforces age-based retention (default 7 days) |

### Dependencies

| Package | Version | Role |
|---------|---------|------|
| `express` | `^4.21.0` | Web framework — routing, middleware, request/response handling |
| `mongoose` | `^8.9.0` | MongoDB ODM — schema definition, validation, model queries |
| `express-rate-limit` | `^7.5.0` | Rate limiting — protects against brute-force attacks and API abuse with configurable per-IP throttling |
| `cors` | ^2.8.5` | Cross-Origin Resource Sharing — origin-restricted preflight support |
| `cookie-parser` | `^1.4.7` | Cookie parsing middleware — reads `req.cookies` from incoming HTTP requests, enabling cookie-based session management (access/refresh tokens, temp 2FA sessions) |
| `helmet` | `^8.0.0` | Security headers middleware — sets CSP, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy (camera, microphone, geolocation, payment, usb, magnetometer, gyroscope, accelerometer, pictureInPicture blocked; fullscreen same-origin only), and more |
| `dotenv` | `^16.4.0` | Environment variable loading from `.env.development` |
| `bcryptjs` | `^3.0.3` | Password hashing for user authentication (pre-save hook in User model) |
| `jsonwebtoken` | `^9.0.3` | JSON Web Token generation and verification for session-based auth |
| `speakeasy` | `^2.0.0` | TOTP/Hotp implementation — generates secrets, OTPAuth URIs, and performs timing-safe TOTP code verification for 2FA |
| `qrcode` | `^1.5.4` | QR code generation — produces data URIs from OTPAuth URLs for scanning by authenticator apps |
| `pino` | `^9.14.0` | Structured JSON logging — high-performance logger reused across the entire application (shared instance via `utils/logger.js`) |
| `pino-http` | `^10.0.0` | HTTP request/response middleware for pino — logs every inbound API call with method, URL, status code, response time, and matched Express route path; sanitizes sensitive query parameters from logged URLs |
| `pino-pretty` | `^13.1.3` | Human-readable transport for pino — colorized timestamps in development mode; disabled in production for JSON-only output |

---

### `.env.example`

Template file for environment variables, committed to the repository as an onboarding reference. Contains documented placeholders for all required configuration values, including generation instructions for `JWT_SECRET`. The header includes a `cp` command for quick setup:

```bash
cp backend/.env.example backend/.env.development
```

Developers should copy this file to `.env.development` and fill in the real values before running the backend.

| Variable | Placeholder value | Purpose |
|----------|-------------------|---------|
| `NODE_ENV` | `development` | Node environment (development \| production) |
| `PORT` | `8080` | HTTP listening port (inside container) |
| `MONGODB_HOST` | `mongo` | MongoDB hostname (Docker Compose: `mongo`; local dev: `localhost`) |
| `MONGODB_PORT` | `27017` | MongoDB port |
| `MONGODB_DATABASE` | `where-is-my-model` | Database name |
| `MONGODB_USERNAME` | `admin` | MongoDB authentication username (leave empty for local dev without auth) |
| `MONGODB_PASSWORD` | `changeme_dev_password` | MongoDB authentication password (leave empty for local dev without auth) |
| `CLIENT_URL` | `http://localhost:3000` | Comma-separated list of allowed CORS origins |
| `JWT_SECRET` | `CHANGE_ME_GENERATE_A_STRONG_SECRET` | JWT signing secret — MUST be at least 64 characters. Generate with: `openssl rand -base64 48` |
| `JWT_EXPIRES_IN` | `1d` | JWT token lifetime (e.g., `1h`, `1d`, `7d`) |
| `JWT_REFRESH_SECRET` | *(placeholder)* | Separate secret for signing refresh tokens — MUST be at least 64 characters |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token lifetime |
| `HEALTH_CHECK_ALLOWED_NETWORKS` | *(empty)* | CIDR allowlist for outbound health-check probes (SSRF protection) |
| `ADMIN_USERNAME` | `changeme_admin_user` | Initial admin username — used on first startup to seed an admin account |
| `ADMIN_PASSWORD` | *(placeholder)* | Initial admin password — WARNING: secret value, never commit real credentials |
| `BACKUP_DIR` | `/backups` | Directory where mongodump creates timestamped backup folders. Mount a persistent volume here in production so backups survive container restarts. Default fallback: `<os.tmpdir()>/where-is-my-model-backups`. |
| `BACKUP_RETENTION_DAYS` | `7` | Number of days to retain backups before automatic cleanup by `scripts/backup.js`. |

### `.env.development`

Environment configuration file loaded by `server.js` (via `dotenv.config({ path: '.env.development' })`) during development and via Docker Compose at runtime for production. This file is excluded from Git (see root `.gitignore`) to prevent credential leakage. Create it by copying `.env.example` and replacing the placeholder values with real secrets. The server will refuse to start if `JWT_SECRET` is missing or shorter than 64 characters.

| Variable | Value | Purpose |
|----------|-------|---------|
| `NODE_ENV` | `development` | Tells Node.js frameworks to enable verbose debug output and hot-reload modes |
| `PORT` | `8080` | HTTP listening port |
| `MONGODB_HOST` | `mongo` | MongoDB hostname — uses Docker Compose service name `mongo` for container-to-container networking |
| `MONGODB_PORT` | `27017` | MongoDB port |
| `MONGODB_DATABASE` | `where-is-my-model` | Database name |
| `MONGODB_USERNAME` | `admin` | MongoDB admin username (created by `MONGO_INITDB_ROOT_USERNAME` in docker-compose) |
| `MONGODB_PASSWORD` | `changeme_dev_password` | MongoDB admin password (created by `MONGO_INITDB_ROOT_PASSWORD` in docker-compose) |
| `CLIENT_URL` | `http://localhost:3000` | Frontend origin for CORS allowlist |
| `JWT_SECRET` | `CHANGE_ME` (placeholder — **must be replaced**) | Secret key used to sign and verify JSON Web Tokens. Server refuses to start if missing or shorter than 64 characters. Generate with: `openssl rand -base64 48`. See `.env.example` for the template. |
| `JWT_EXPIRES_IN` | `1d` | Token lifetime — all JWTs expire after 24 hours once issued |

---

### `.dockerignore`

Docker build-context exclusion list. Prevents `node_modules/`, environment files (`.env*`), editor artifacts, and IDE directories from being baked into the Docker image. This keeps the build context lean and prevents credential leakage from `.env` files being committed to the image layer. Comments explicitly note that `seed.js` is intentionally included so it can be run inside the container via `docker compose exec backend node seed.js`.

### Excluded patterns

| Pattern | Rationale |
|---------|-----------|
| `node_modules` | Dependencies installed fresh during Docker build (`npm install --production`) |
| `.env*` | Environment variables injected at runtime by docker-compose (credential safety) |
| `.DS_Store` | macOS filesystem artifact |
| `*.swp`, `*.swo`, `*~` | Vim swap/backup files |
| `.vscode/`, `.idea/` | IDE project configuration directories |

---

## 🔐 Authentication infrastructure

The backend has been instrumented with JWT-based user authentication, a cookie-based two-token rotation system (short-lived access token + long-lived refresh token), and TOTP-based two-factor authentication (2FA). Production dependencies in `package.json` include `bcryptjs@^3.0.3`, `jsonwebtoken@^9.0.3`, `cookie-parser@^1.4.7`, `speakeasy@^2.0.0`, and `qrcode@^1.5.4`. Six corresponding environment variables are present in `.env.development`: `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_SECRET`, and `JWT_REFRESH_EXPIRES_IN` (plus the MongoDB component variables).

### What exists now

| Component | File / Location | Status |
|-----------|----------------|--------|
| **User Mongoose model** | `models/User.js` | ✅ Implemented — includes 2FA fields (`totpSecret`, `totpEnabled`) |
| **Password hashing (pre-save hook)** | `models/User.js` — `bcryptjs` with 10 salt rounds | ✅ Implemented |
| **Refresh token model** | `models/RefreshToken.js` | ✅ Implemented — two-token rotation architecture |
| **JWT secret and expiry env vars** | `.env.development` — access + refresh tokens | ✅ Configured (4 variables: `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`) |
| **Auth dependencies** | `package.json` — `bcryptjs`, `jsonwebtoken`, `cookie-parser`, `speakeasy`, `qrcode` | ✅ Installed |
| **Auth middleware** | `middleware/auth.js` | ✅ Active — verifies Bearer JWT, attaches payload to `req.user` |
| **Auth routes** | `routes/auth.js` | ✅ Active — session management with cookie-based token rotation and 2FA intercept in login flow |
| **2FA routes** | `routes/twoFactor.js` | ✅ Active — TOTP setup, verification, status, disable |
| **Users admin routes** | `routes/users.js` | ✅ Active — exposes `GET /api/users`, `PUT /:userId/role`, `DELETE /:userId` (admin-only) |

### Two-factor authentication flow

```
Client                          Backend                        MongoDB
  │                                │                               │
  ├─ POST /api/auth/2fa/setup ───→ │                               │
  │   Authorization: Bearer <jwt>  ├─ speakeasy.generateSecret()    │
  │                                ├─ user.totpSecret = base32     →│ user.save()
  │                                ├─ qrcode.toDataURL(otpauth_url) │
  │   ← { success, qrCode,        │                               │
  │        manualEntry } ◀────────┤                               │
  │                                │                               │
  ├─ Scans QR code in authenticator│                               │
  │   app → receives 6-digit OTP  │                               │
  │                                │                               │
  ├─ POST /api/auth/2fa/verify ──→ │                               │
  │   { code: "123456" }          ├─ speakeasy.totp.verify()      │
  │   Cookie: tempAuthSession     │   (timing-safe, window: 1)    │
  │                                ├─ user.totpEnabled = true    →│ user.save()
  │                                ├─ revoke old refresh tokens  →│ RefreshToken.updateMany()
  │                                ├─ set access+refresh cookies  │
  │   ← { success, user } ◀──────┤                               │
```

### Planned authentication flow

```
Client                          Backend                        MongoDB
  │                                │                               │
  ├─ POST /api/auth/register ────→ │                               │
  │   { username, password }       ├─ hash(password) with bcryptjs →│ User.create()
  │                                ├─ sign JWT(payload, JWT_SECRET) │
  │   ← { success: true,          │                               │
  │        token, user } ◀────────┤                               │
  │                                │                               │
  ├─ POST /api/auth/login    ────→ │                               │
  │   { username, password }       ├─ User.findOne(username) ──────→│ .select('password')
  │                                │ ← user doc                        │
  │                                ├─ user.comparePassword()        │
  │                                ├─ sign JWT(payload, JWT_SECRET) │
  │   ← { success: true,          │                               │
  │        token, user } ◀────────┤                               │
  │                                │                               │
  ├─ GET /api/auth/me            ─→ │                               │
  │   Authorization: Bearer <jwt>  ├─ verify(token, JWT_SECRET)    │
  │                                ├─ User.findById(userId) ───────→│ (no .select('password'))
  │   ← { success: true,         │ ← user doc                       │
  │        user } ◀──────────────┤                               │
```

### Active endpoints

All authentication endpoints are implemented and active across two router modules:

**`routes/auth.js`** mounted at `/api/auth`:

| Method | Path | Purpose | Auth required? |
|--------|------|---------|----------------|
| `POST` | `/api/auth/register` | Create a new user account; hashes password, issues session cookies for admin users | No (public) |
| `POST` | `/api/auth/login` | Authenticate with username/password; returns 200 + cookies or 403 `2FA_REQUIRED` + temp cookie | No (public) |
| `POST` | `/api/auth/refresh` | Rotate expired access token via valid refresh token cookie | Yes (refresh cookie) |
| `GET`  | `/api/auth/me` | Return the authenticated user's profile | Yes (access cookie / Bearer JWT) |
| `POST` | `/api/auth/logout` | Revoke all refresh tokens and clear cookies | Yes (access cookie / Bearer JWT) |

**`routes/twoFactor.js`** mounted at `/api/auth/2fa`:

| Method | Path | Purpose | Auth required? |
|--------|------|---------|----------------|
| `POST` | `/api/auth/2fa/setup` | Generate TOTP secret + QR code data URI | Yes (access cookie / Bearer JWT) |
| `POST` | `/api/auth/2fa/verify` | Verify TOTP code; dual-mode (temp session or mid-session) | Temp session cookie OR access cookie |
| `POST` | `/api/auth/2fa/disable` | Disable 2FA (requires password + current TOTP code) | Yes (access cookie / Bearer JWT) |
| `GET`  | `/api/auth/2fa/status` | Check if 2FA is enabled for the current user | Yes (access cookie / Bearer JWT) |

**`routes/users.js`** mounted at `/api/users`:

| Method | Path | Purpose | Auth required? |
|--------|------|---------|----------------|
| `GET`  | `/api/users` | List all registered users (safe projection only) | Yes — JWT + admin role |
| `PUT`  | `/api/users/:userId/role` | Change a user's role to admin/user/pending | Yes — JWT + admin role |
| `DELETE` | `/api/users/:userId` | Delete a user (with last-admin safeguard) | Yes — JWT + admin role |

### Role-based access control (active)

The User model supports three roles, enforced via `requireAdmin` middleware from `middleware/auth.js`:

| Role | Current permission scope |
|------|--------------------------|
| `'admin'` | Full CRUD access to PCs, services, health probes, and user management (`routes/users.js`) |
| `'user'` | Read-only access to PCs and services; admin mutation routes (POST/PUT/DELETE) return 403 |
| `'pending'` | Cannot log in — credentials are accepted but `/login` returns 403 until an admin changes the role via `PUT /api/users/:userId/role` |

Role enforcement is active on the following route groups:
- `routes/pcs.js` — POST, PUT, DELETE require both `authMiddleware` + `requireAdmin`.
- `routes/users.js` — All endpoints require both `authMiddleware` + `requireAdmin`.


## Architecture overview

### Technology stack

- **Runtime:** Node.js 20 (ES modules)
- **Framework:** Express 4.x
- **Database:** MongoDB via Mongoose 8.x ODM
- **Containerization:** Docker (Alpine-based), orchestrated via Docker Compose

### Request flow

```
Client request
    │
    ├─→ Helmet middleware (security headers: CSP, X-Frame-Options, HSTS, Permissions-Policy, etc.)
    │       Configuration overrides:
    │       - crossOriginOpenerPolicy: same-origin
    │       - permissionsPolicy: blocks camera, microphone, geolocation, payment, usb,
    │         magnetometer, gyroscope, accelerometer, pictureInPicture for all origins;
    │         fullscreen allowed same-origin only — reduces XSS attack surface
    │       - xXssProtection: false (deprecated header, disabled to avoid browser warnings)
    │
    ├─→ CORS middleware (origin whitelist from CLIENT_URL)
    │
    ├─→ pino-http logging middleware (createHttpLogger())
    │       Logs method, sanitized URL, status code, response time, Express route path
    │       Sensitive query params stripped via sanitizeUrl() before serialization
    │       Distributed-tracing: genReqId generates/reuses a UUID (req.id) per request
    │
    ├─→ requestId middleware (middleware/requestId.js)
    │       Ensures req.id is present (fallback crypto.randomUUID() if absent)
    │       Echoes X-Request-ID header on every response for client-side correlation
    │
    ├─→ cookieParser (session cookie parsing for access/refresh tokens)
    │
    ├─→ express.json() (body parsing; errors → global 400 handler)
    │
    ├─→ globalLimiter (rate limiting on all /api/* routes — 100 req/15 min per IP)
    │
    ├─→ Input sanitization middleware (sanitizeMiddleware — middleware/sanitization.js)
    │       Applied on POST/PUT mutation routes before validation. Strips HTML tags,
    │       escapes < > & characters, blocks NoSQL operators ($gt, $ne, etc.), and
    │       prevents prototype pollution (__proto__, constructor, prototype).
    │       Skips password/totpSecret fields for string sanitization; all fields are
    │       checked for NoSQL injection. Numeric fields (puerto, gpu, assignedGpu, vram)
    │       bypass string treatment. Every blocked request is logged via pino.
    │
    ├─→ Route-specific validation middleware (routes use it: backend/middleware/validation.js)
    │       │
    │       ├─→ validatePcBody        — POST/PUT /api/pcs
    │       └─→ validateServiceBody   -  POST /api/pcs/:pcId/services
    │           validateServiceUpdate — PUT  /api/pcs/:pcId/services/:serviceIndex
    │
    ├─→ Route handler (routes)
    │       │
    │       ├─→ MongoDB query via PC model
    │       └─→ Mongoose .save() triggers document-level GPU-cap validator
    │
    └─→ Global error handler (catches anything that escapes route handlers)
```

### Database schema relationships

```
PC  (1 collection: "pcs")
│
├── nombre          string — server label
├── ip              string — IPv4 address
├── gpus            array  [{ name: string, vram: number }] — per-GPU definitions
└── servicios       array  [{ nombre, puerto, gpu, assignedGpu }] — embedded services
                                                        │
                                                        └── assignedGpu → indexes into parent's gpus[]
                                                                        (enforced by document-level validator)
```

A PC has many Services. A Service belongs to exactly one PC and is assigned to exactly one GPU within that PC (via `assignedGpu` index). No separate services collection exists — services are embedded subdocuments.

### Deployment approach

The Dockerfile produces a single-stage Node.js 20 Alpine image. In development, `docker-compose.yml` mounts the local `backend/` directory as a named volume overlay on `/app`, enabling hot-reload without rebuilding. Production relies on baked-in source code with production-only dependencies (`npm install --production`). Database connectivity is via Docker Compose internal networking (`mongodb://mongo:27017/...`).

### Entry points

| Entry point | How to invoke | Purpose |
|-------------|--------------|---------|
| `server.js` | `node server.js` or `docker compose up backend` | Main API server |
| `seed.js` | `npm run seed` or `docker compose exec backend node seed.js` | Database initial data population from `data.json` |
| `scripts/backup.js` | `npm run backup` or `docker compose exec backend npm run backup` | MongoDB backup via mongodump --gzip with retention management (cron/CI integration, exit 0 success / exit 1 failure) |
| `test-gpu-cap.js` | `node test-gpu-cap.js [BASE_URL]` | Node.js integration test for VRAM-cap enforcement |
| `test-gpu-cap.sh` | `./test-gpu-cap.sh [BASE_URL]` | Shell-based integration test (same coverage as .js variant) 

---

## 🔄 Changes in this update

- **`server.js`** — Added health router registration inside `registerRoutes()`. A new dynamic import block loads `./routes/health.js` and mounts it at `/api/check-health`, wrapped in try/catch for graceful degradation. The health router is now the *first* registered route, preceding services and PCs routers (order: health → services → pcs). Updated code comments to document all three routers and their ordering rationale. Current documentation now reflects all three dynamically imported route modules instead of the previous two.
- **T001 — Auth dependencies installed** — Added `bcryptjs@^3.0.3` and `jsonwebtoken@^9.0.3` to production dependencies in `package.json`. Updated dependencies table accordingly.
- **T002 — JWT environment variables added** — New variables `JWT_SECRET` (dev signing key) and `JWT_EXPIRES_IN=1d` appended to `.env.development`. Updated env vars table with both entries.
- **T003 — Auth infrastructure section added** — New "Authentication infrastructure" section documenting the User model, password hashing pipeline, planned JWT-based auth flow, pending endpoints (`/api/auth/register`, `/api/auth/login`, `/api/auth/me`), and role-based access control design.

## 🔄 Changes in this update

- **2026-07-12 — Users router registered in `server.js`:** `registerRoutes()` now dynamically imports and mounts a fifth route module: `./routes/users.js` at `/api/users`. It is registered second, between auth (`/api/auth`) and health (`/api/check-health`). Updated the `registerRoutes()` function description to reflect five routers instead of three. Updated the server.js general description accordingly. Added entry in "What exists now" table for the users admin routes.

## 🔄 Changes in this update

- **Security hardening — JWT_SECRET removed from repository:** Hardcoded JWT secret removed from `.env.development` and replaced with `CHANGE_ME` placeholder. Server now performs startup validation (in `server.js`) that rejects `JWT_SECRET` if missing or shorter than 64 characters, and rejects missing `JWT_EXPIRES_IN`. Server exits with code 1 on validation failure.
- **New file — `.env.example`:** Template file added to the repository with documented placeholders and generation instructions (`openssl rand -base64 48`). Serves as the onboarding reference for setting up environment variables. Full documentation added as a new section.
- **`.env.development` updated:** `JWT_SECRET` value changed from a hardcoded secret to `CHANGE_ME` placeholder. Documentation updated to reflect that this file is now git-ignored and must be populated from `.env.example` before the server will start.
- **`.gitignore` updated:** `.env.development` added to the root `.gitignore` exclusion list to prevent accidental credential commits.

---

## 🔄 Changes in this update

- **T5 — Security hardening: .env files moved out of Git tracking:** `backend/.env.development` is now untracked by Git (previously committed with placeholder values). Updated `.env.example` documentation to include the `cp` command from the file's header comment. Updated `.env.development` description to remove "committed copy" reference — it now instructs developers to create the file by copying from `.env.example`.

---

## 🔄 Changes in this update

- **Security hardening — MongoDB authentication enabled:** `server.js` no longer uses a monolithic `MONGODB_URI` environment variable. Instead, a new `buildMongoUri()` function dynamically constructs the connection URI from five component environment variables: `MONGODB_HOST`, `MONGODB_PORT`, `MONGODB_DATABASE`, `MONGODB_USERNAME`, and `MONGODB_PASSWORD`. The function supports two modes: authenticated mode (when username and password are both present, used in Docker Compose) and no-auth mode (when credentials are absent, used for local development without MongoDB auth). A console log message indicates which mode is active at startup.
- **`.env.example` updated:** `MONGODB_URI` replaced with five component variables (`MONGODB_HOST`, `MONGODB_PORT`, `MONGODB_DATABASE`, `MONGODB_USERNAME`, `MONGODB_PASSWORD`). The template includes Docker Compose defaults and notes that username/password can be left empty for local dev without auth.
- **`.env.development` updated:** Same structural change — `MONGODB_URI` replaced with component variables. Current values point to the Docker Compose MongoDB instance with `admin` / `changeme_dev_password` credentials.
- **Configuration table updated:** The server.js configuration table now lists the five MongoDB component variables instead of the single `MONGODB_URI`.
- **Functions section updated:** Added documentation for `buildMongoUri()` with full parameter and return details.

---

## 🔄 Changes in this update

- **Security hardening — Helmet.js added:** `helmet@^8.0.0` (installed 8.3.0) added to `package.json` production dependencies and imported in `server.js`. The middleware is registered as the **first** middleware in the Express chain, before CORS and `express.json()`. Configuration overrides: `crossOriginOpenerPolicy: { policy: 'same-origin' }` and `xXssProtection: false` (deprecated, explicitly disabled to avoid browser console warnings). Default Helmet headers are active: Content-Security-Policy (CSP), X-Frame-Options, Strict-Transport-Security (HSTS), X-Content-Type-Options, Referrer-Policy, Permissions-Policy, and cross-origin embedding/opener/policy protections. Updated `server.js` description, imports table, dependencies table, and request flow diagram to reflect the new middleware position.

---

## 🔄 Changes in this update

- **Task 3 — Rate limiting infrastructure added:** New production dependency `express-rate-limit@^7.5.0` added to `package.json`. New middleware file `backend/middleware/rateLimit.js` created with three named exports:
  - **`globalLimiter`** (100 requests / 15 min per IP) — imported in `server.js` and registered at the app level via `app.use('/api', globalLimiter)` after `express.json()` but before route registration. Protects all `/api/*` endpoints from excessive request volume.
  - **`authLimiter`** (5 requests / 15 min per IP) — applied directly on `POST /register` and `POST /login` in `routes/auth.js` to prevent brute-force credential guessing.
  - **`healthLimiter`** (10 requests / min per IP) — applied via `router.use()` in `routes/health.js` to prevent health-check abuse.
- **`server.js` updated:** Added import of `globalLimiter` from `./middleware/rateLimit.js`. Registered `app.use('/api', globalLimiter)` as the fourth middleware in the Express chain (after Helmet, CORS, and JSON body parsing). Updated server.js general description, imports table, and request flow diagram.
- **`routes/auth.js` updated:** Both `POST /register` and `POST /login` now accept `authLimiter` as middleware before the handler function. Updated routes.md authentication section accordingly.
- **`routes/health.js` updated:** The health router now has `router.use(healthLimiter)` applied at the top, covering all `/check-health/*` sub-routes. Updated routes.md health section accordingly.
- **Subfolder description updated:** The middleware folder entry in the subfolders table now mentions the rate-limiting capabilities alongside the existing validation middleware description.

---

## 🔄 Changes in this update

- **Task 21 — TOTP-based 2FA infrastructure added across the backend:**
  - **`package.json`:** Two new production dependencies installed: `speakeasy@^2.0.0` (TOTP/HOTP generation and timing-safe verification) and `qrcode@^1.5.4` (QR code data URI generation from OTPAuth URLs). Updated the dependencies table accordingly.
  - **`server.js`:**
    - Added `cookie-parser` import — required for reading session cookies (`accessToken`, `refreshToken`, `tempAuthSession`) from incoming requests. Registered as Express middleware before body parsing.
    - Added startup validation for two new environment variables: `JWT_REFRESH_SECRET` (minimum 64 characters) and `JWT_REFRESH_EXPIRES_IN` (must be set). The server now validates four JWT-related secrets/keys total (`JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`).
    - Added dynamic import of `./routes/twoFactor.js` in `registerRoutes()` — mounted at `/api/auth/2fa` **before** the general auth router to prevent Express from matching `/auth/2fa/*` against the longer auth route patterns. Six routers are now registered (twoFactor → auth → users → health → services → pcs).
  - **Authentication infrastructure section:** Completely rewritten to reflect the new two-tier cookie-based session system and TOTP 2FA capabilities. Added a dedicated sequence diagram showing `POST /setup` → QR generation → `POST /verify` → timing-safe verification → token issuance. Updated the "What exists now" table with entries for the RefreshToken model, 2FA routes, and expanded dependency list. Rewrote the active endpoints table to include all five auth endpoints plus four 2FA endpoints across two router modules. Added the `pending` role to the RBAC documentation.
  - **Models:** Updated User.js fields table (documented in models.md) with `totpSecret` and `totpEnabled` schema additions.
  - **Routes:** Full documentation for `twoFactor.js` added to routes.md, plus comprehensive auth.js updates covering cookie-based token management, the post-login 2FA intercept flow, `/refresh`, `/logout`, temp session helpers, and shared helper functions duplicated from twoFactor.js.

---

## 🔄 Changes in this update

- **Task 11 — HEALTHCHECK added to backend Dockerfile:** A `HEALTHCHECK` directive was added that uses Node.js built-in `http` module to probe `GET /api/health` on `localhost:8080`. Runs as non-root `appuser`. Configured with 30s interval, 5s timeout, 10s start-period, 3 retries. New "Health check" section added to the Dockerfile documentation with full parameter table. This health check is consumed by `docker-compose.yml` — the frontend service uses `depends_on.backend.condition: service_healthy` so that Vite does not start until the backend passes its first health probe.

---

## 🔄 Changes in this update

- **Task 18 — HTTP request/response logging middleware (pino-http):**
  - **`package.json`:** Three new production dependencies installed: `pino@^9.14.0` (structured JSON logging), `pino-http@^10.0.0` (Express HTTP access-log middleware), and `pino-pretty@^13.1.3` (human-readable transport for development). Updated the dependencies table accordingly.
  - **New file — `utils/logger.js`:** Full rewrite of the logging infrastructure. The module now exports:
    - **Default export (`logger`)**: Shared Pino logger singleton with redaction paths expanded to include query-parameter keys (`req.query.password`, `req.query.token`, `req.query.accessToken`, `req.query.refreshToken`). Uses `pino-pretty` transport in development for colorized output; JSON-only in production.
    - **`createHttpLogger()` (named)**: Factory returning a pino-http Express middleware that — reuses the shared logger, sanitizes sensitive query parameters from logged URLs via `sanitizeUrl()`, and appends the matched Express route path as a `route` field on every log line for full request-to-route tracing.
    - **`sanitizeUrl()` (named)**: Utility that strips sensitive query-parameter keys (`password`, `token`, `accessToken`, `refreshToken`, `authorization`, `auth`) from URLs before logging. Case-insensitive match via `SENSTIVE_QUERY_PARAMS` Set.
  - **`server.js`:** Updated import statement to include `createHttpLogger` as a named export alongside the default `logger` export (`import logger, { createHttpLogger } from './utils/logger.js'`). Registered pino-http middleware (`app.use(createHttpLogger())`) between CORS and cookieParser in the Express middleware chain — positioned after security headers and origin checks so that access logs capture the final resolved request context. New section comment documents its placement and purpose.
  - **Subfolder table updated:** New `utils/` entry added with link to `./utils.md`.
  - **Request flow diagram updated:** Added pino-http logging middleware step between CORS and cookieParser in the architecture overview's request flow diagram.

---

## Changes in this update

- **Task 17 — Request ID tracking across the backend:**
  - **New file — `middleware/requestId.js`:** New Express middleware that guarantees every request carries a UUID on `req.id` (with `crypto.randomUUID()` fallback) and sets the `X-Request-ID` response header for client-side correlation. Registered in `server.js` immediately after pino-http so pino's `genReqId` callback has already populated `req.id`.
  - **`utils/logger.js`:** Added `crypto` import from `node:crypto`. New constant `VALID_UUID_RE` (RFC 4122 UUID regex) for validating incoming request IDs. The `createHttpLogger()` factory now includes a `genReqId(req, _res)` callback — if the client sends a valid RFC 4122 UUID in the `X-Request-ID` header, that ID is reused by pino-http (assigned to `req.id`) for distributed-tracing correlation across logs. Otherwise a new UUID is generated via `crypto.randomUUID()`.
  - **`server.js`:** New import of `requestId` from `./middleware/requestId.js`. Registered as `app.use(requestId)` after pino-http and before cookieParser (line 107). All four error-handler JSON responses in the global error handler now include `requestId: req.id` for log correlation.
  - **Subfolder descriptions updated:** `middleware/` entry now mentions request-ID tracking; `utils/` entry notes distributed-tracing request ID generation.
  - **Request flow diagram updated:** Added requestId middleware step between pino-http and cookieParser.
  - **Global error handler table updated:** All four error response envelopes now document the `requestId: req.id` field.

---

## 🔄 Changes in this update

- **Task 16 — Automated MongoDB backup capability:**
  - **New file — `scripts/backup.js`:** ESM CLI script for automated database backups using `mongodump --gzip`. Creates timestamped backup folders in a configurable directory (`BACKUP_DIR=/backups`), enforces age-based retention (`BACKUP_RETENTION_DAYS=7` default), uses safe `execFile` with array arguments (no shell injection vector), structured logging via shared pino logger, and proper exit codes for cron/CI integration (0 success / 1 failure). Full documentation in [scripts.md](./scripts.md).
  - **New file — `docs/documentation/backend/scripts.md`:** Leaf documentation covering both `scripts/backup.js` and `scripts/seedAdmin.js` with full function signatures, parameter descriptions, and configuration tables.
  - **Subfolder table updated:** New `scripts/` entry added with link to `./scripts.md`.
  - **Dockerfile — Layer 0 added:** `RUN apk add --no-cache mongodb-database-tools` inserted after `WORKDIR /app` and before the `USER appuser` switch. This installs `mongodump`/`mongorestore` binaries required by the backup script while ensuring the non-root user retains execute permissions. Updated build layers table accordingly.
  - **`package.json` — New npm script:** `"backup": "node scripts/backup.js"` added to the scripts section. Updated npm scripts table with this entry.
  - **`.env.example` — Backup configuration variables appended:** Two new optional variables documented: `BACKUP_DIR=/backups` (backup output directory, should be mounted to persistent volume in production) and `BACKUP_RETENTION_DAYS=7` (auto-cleanup threshold). Updated `.env.example` variable table accordingly.
  - **Entry points table updated:** Added row for `scripts/backup.js` with invocation commands (`npm run backup` or via docker compose exec).

---

## 🔄 Changes in this update

- **Task 15 — Bug fix: `emailService.js` import path corrected and documented:** A blocking startup bug was fixed in `backend/services/emailService.js`. The logger import on line 2 was changed from `'../../utils/logger.js'` (incorrect, one directory level too deep) to `'../utils/logger.js'` (correct relative path from `backend/services/`). This bug prevented the entire auth router (`routes/auth.js`) from loading during dynamic import in `server.js::registerRoutes()`, which disabled all `/api/auth/*` endpoints at startup — effectively breaking registration, login, and authentication. Full documentation for `emailService.js` has been added to [services.md](./services.md), including both exported functions with parameter types, return types, and behavioral descriptions (lazy transport caching, graceful SMTP degradation, verification email construction). The subfolder description for `services/` in this file's table has been updated to reflect the presence of both `emailService.js` and `healthChecker.js`.

---

## 🔄 Changes in this update

- **Task 24 — Input sanitization layer added (new middleware file `middleware/sanitization.js`):**
  - **New file — `backend/middleware/sanitization.js`:** Express middleware module that provides defense-in-depth against XSS, NoSQL injection, and prototype pollution. Exports three public functions:
    - **`sanitizeMiddleware(req, res, next)`** — Express middleware function. Two-phase inspection of `req.body`:
      1. Calls `hasNoSqlInjection()` to recursively detect MongoDB query operators (`$gt`, `$gte`, `$lt`, `$lte`, `$ne`, `$eq`, `$regex`, `$exists`, `$type`, `$where`, `$set`, `$unset`, `$push`, `$pull`, `$inc`, `$rename`, `$currentDate`, `$addFields`, `$and`, `$or`, `$nor`, `$not`) and prototype-poisoning keys (`__proto__`, `constructor`, `prototype`). If any are found, returns HTTP 400 with `{ success: false, message: 'Request contains forbidden patterns.' }` and logs the event via pino.
      2. Calls `sanitizeBodyDeep()` which mutates `req.body` in-place — trims whitespace, strips HTML tags via regex `<[^>]*(?:>[^<]*)*>`, and escapes remaining dangerous characters (`& → &amp;`, `< → &lt;`, `> → &gt;`). Skips `password` and `totpSecret` fields for string sanitization (but still scans them for NoSQL injection). Numeric fields (`puerto`, `gpu`, `assignedGpu`, `vram`) bypass string treatment entirely.
    - **`sanitizeString(str, fieldName) → { clean: string, changed: boolean }`** — Pure function that trims, strips HTML tags, and escapes `< > &`. Returns both the cleaned string and a mutation flag. Skips fields in `SKIP_SANITIZE_FIELDS` set (`password`, `totpSecret`).
    - **`hasNoSqlInjection(value) → { found: boolean, details: string[] }`** — Pure function that recursively walks an object/array tree detecting MongoDB operators and prototype-poisoning keys. Returns a flag and an array of human-readable detection messages with full dotted paths (e.g., `"NoSQL operator detected: \"body.$gt\"" `).
  - Private helper `escapeHtmlChars(str)` handles the HTML entity substitution (`&`, `<`, `>`).
  - Private recursive function `sanitizeBodyDeep(value, fieldName)` performs in-place mutation of string leaves within an object tree.
  - **Routes updated — sanitizeMiddleware applied on all POST/PUT handlers:** Four route modules now import and chain `sanitizeMiddleware` after rate-limiting / authentication middleware but before body validation:
    | Route file | Affected endpoints | Position in middleware chain |
    |-----------|-------------------|------------------------------|
    | `routes/auth.js` | `POST /register`, `POST /login`, `POST /refresh` | After `authLimiter`, before handler |
    | `routes/pcs.js` | `POST /`, `PUT /:id` | After `requireAdmin`, before `validatePcBody` |
    | `routes/services.js` | `POST /`, `PUT /:serviceIndex` | After `requireAdmin`, before `validateServiceBody` / `validateServiceUpdate` |
    | `routes/users.js` | `PUT /:userId/role` | After `requireAdmin`, before handler |
  - **Subfolder description updated:** The `middleware/` entry in the subfolders table now documents the input sanitization middleware alongside existing entries (validation, rate limiting, request ID).
  - **Request flow diagram updated:** Added "Input sanitization middleware" step between global rate limiting and route-specific validation in the architecture overview's request flow diagram. This reflects that sanitized bodies reach downstream validators in a cleaned state.

---

## 🔄 Changes in this update

- **Task 25 — `permissionsPolicy` directive added to Helmet.js configuration (`server.js` lines 96-113):**
  - **Purpose:** Explicitly restrict browser feature access via the W3C Permissions Policy standard, reducing the attack surface for XSS exploits that attempt to invoke device-hardware APIs (camera streams, microphone capture, geolocation leakage, USB device enumeration, inertial sensors).
  - **Helmet `permissionsPolicy` block** — ten features governed:

    | Feature | Policy | Rationale |
    |---------|--------|-----------|
    | `camera` | `[]` (blocked for all origins) | No webcam access — application has no video-capture functionality. |
    | `microphone` | `[]` (blocked for all origins) | No audio-capture — prevents rogue scripts from recording ambient sound via XSS vectors. |
    | `geolocation` | `[]` (blocked for all origins) | No location data needed — prevents browser geolocation prompts or silent coordinate leakage. |
    | `payment` | `[]` (blocked for all origins) | Not a payment application — disables Payment Request API surface. |
    | `usb` | `[]` (blocked for all origins) | No USB device interaction — blocks USB Device API enumeration. |
    | `magnetometer` | `[]` (blocked for all origins) | No orientation sensing — prevents sensor abuse via XSS in mobile browsers. |
    | `gyroscope` | `[]` (blocked for all origins) | No rotation sensing — same rationale as magnetometer. |
    | `accelerometer` | `[]` (blocked for all origins) | No motion sensing — same rationale as magnetometer. |
    | `fullscreen` | `['self']` (same-origin only) | Allows the application itself to go fullscreen if needed, but prevents third-party iframes from hijacking display mode. |
    | `pictureInPicture` | `[]` (blocked for all origins) | No video playback — disables PiP API surface. |

  - **Integration:** The policy is defined inline within the existing `helmet()` middleware options object in `server.js`. It sits alongside the existing `crossOriginOpenerPolicy` and `xXssProtection` overrides — no new imports or dependencies introduced.
  - **Request flow diagram updated:** The Helmet step now lists Permissions-Policy among the active security headers, with a note that device-feature APIs are restricted to reduce XSS impact.
  - **Dependencies table updated:** The `helmet` entry now enumerates the ten governed permissions-policy features.

---

## 🔄 Changes in this update

- **Email verification cleanup removed from `server.js`:** The automatic deprovisioning of stale pending users has been fully removed from the server startup sequence:
  - **Removed import:** `import User from './models/User.js'` — the User model was imported directly at the top level solely to support the cleanup function. It is no longer needed in `server.js` (the routes that access User import it themselves).
  - **Removed constant:** `SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000` — time threshold used by the cleanup query.
  - **Removed function:** entire `cleanupUnverifiedUsers()` including comment headers. This function called `User.deleteMany()` with a compound filter (`role: 'pending'`, `emailVerified: false`, `createdAt: { $lt: sevenDaysAgo }`) to purge unverified accounts older than one week.
  - **Removed startup call:** `await cleanupUnverifiedUsers()` was invoked synchronously at the beginning of `start()`, immediately after MongoDB connection and before route registration, causing startup delay proportional to the number of stale user documents.
  - **Removed periodic scheduler:** `setInterval(cleanupUnverifiedUsers, 24 * 60 * 60 * 1000)` — a recurring cleanup task running every 24 hours during the entire lifetime of the process. No orphaned interval timers remain.
  - The remaining startup sequence (MongoDB connect → seedAdmin → registerRoutes → global error handler install → listen) is intact and unchanged by this removal.
