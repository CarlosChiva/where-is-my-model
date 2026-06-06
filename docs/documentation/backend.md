# `backend`

> Path: `backend/`
> Last updated: 2026-06-04
> Type: Composite folder

Node.js backend for the where-is-my-model GPU dashboard. An Express server connects to MongoDB via Mongoose, applies CORS and JSON middleware, exposes a health check endpoint, and lazily registers route modules after database connectivity is confirmed. Database seeding is handled exclusively by the standalone `seed.js` script (manual or pipeline invocation with destructive idempotency); the server no longer performs any automatic seeding on startup. Mongoose models under `models/` define the `PC` entity (GPU servers with embedded network services) and enforce VRAM-capacity guards at the document level. REST routers under `routes/` expose CRUD endpoints for managing PC records. The backend is containerized via a single-stage Dockerfile (Node.js 20 Alpine) with optimized layer caching and a `.dockerignore` that excludes dependency artifacts, environment files, and editor residue — designed for Docker Compose orchestration alongside the frontend and MongoDB services.

---

## 📁 Subfolders

| Folder | Documentation | Description |
|--------|--------------|-------------|
| `middleware/` | [see docs](./backend/middleware.md) | Request validation middleware for PC and Service API endpoints — collect-all-errors pattern with legacy `vram`→`gpus` fallback. |
| `models/` | [see docs](./backend/models.md) | Mongoose schemas for database entities — currently the `PC` model (GPU server with embedded services, VRAM validators, and a `totalGpu` virtual field). |
| `routes/` | [see docs](./backend/routes.md) | Express router modules implementing RESTful API endpoints — currently `pcs.js` (PC CRUD) and `services.js` (embedded service CRUD with validation middleware). |

---

## 📄 Direct files


#### How to run

```bash
node backend/seed.js
```

The script automatically loads `.env.development` from the `backend/` directory for the MongoDB connection string and terminates after completing (or on failure).

#### Idempotency behavior

**Destructive idempotency.** On every execution the script calls `PC.deleteMany({})` before `PC.insertMany(...)`, meaning it **always clears** the existing `pcs` collection and re-inserts fresh data from `data.json`. Running it multiple times produces identical results but any manually persisted data between runs will be lost.

#### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `fs` | `readFileSync` | External (Node.js built-in) |
| `url` | `fileURLToPath` | External (Node.js built-in) |
| `path` | `resolve`, `dirname` | External (Node.js built-in) |
| `mongoose` | `mongoose` (default) | External |
| `dotenv` | `dotenv` (default) | External |
| `./models/PC.js` | `PC` (default) | Internal |

#### Configuration

| Constant | Source / Default | Description |
|----------|------------------|-------------|
| `MONGODB_URI` | `process.env.MONGODB_URI` or `mongodb://localhost:27017/where-is-my-model` | MongoDB connection string; reads from `.env.development` via dotenv |

#### Functions

- **`loadData() → object`**
  Synchronously reads `data.json` (resolved relative to the project root, one level above `backend/`) and parses it as JSON.
  - **Returns:** The parsed raw data object containing a `pc` array of wrapped server objects.

- **`mapToMongooseDocuments(rawData) → PC[]`**
  Transforms the raw `data.json` structure into an array of plain objects compatible with the Mongoose `PC` schema. Performs two levels of unwrapping: (1) each PC wrapper object `{ "server-gpu-01": { ... } }` is flattened via `Object.values()[0]`; (2) each service wrapper `{ "slug": { ... } }` is likewise flattened, and hyphenated keys are mapped to camelCase Mongoose fields.
  - `rawData`: The parsed JSON object from `loadData()`, expected to have a `.pc` array property.
  - **Returns:** Array of plain objects matching the `PC` schema shape (`{ nombre, ip, vram, servicios: [{ nombre, puerto, gpu }] }`).

- **`seed() → Promise<void>`**
  Async orchestrator function. Connects to MongoDB, loads and maps data, clears the existing collection, inserts documents, logs a per-server summary (name, service count, GPU usage vs. VRAM capacity), and disconnects. Aborts with `process.exit(1)` on connection or insertion errors, with special handling for Mongoose `ValidationError` messages.
  - **Returns:** nothing (resolves when the database connection is closed)

#### Data mapping detail

The script bridges two data formats:

| `data.json` key (hyphenated, wrapped in slug) | Mongoose field (camelCase, unwrapped) | Example value |
|---------|---------------------------------------|---------------|
| `{ "<slug>": { "memoria-vram-en-gb": 48 } }` | `vram` (Number) | `48` |
| `"nombre"` (already camelCase in JSON) | `nombre` (String) | `"NVIDIA RTX 4090 — Cluster Alpha"` |
| `"ip"` | `ip` (String, IPv4) | `"192.168.1.101"` |
| `{ "<slug>": { "nombre-servicio": "..." } }` | `servicios[].nombre` (String) | `"TensorFlow Training Pipeline"` |
| `{ "<slug>": { "puerto": 8501 } }` | `servicios[].puerto` (Number) | `8501` |
| `{ "<slug>": { "tamaño-de-servicio-en-gpu": 16.8 } }` | `servicios[].gpu` (Number) | `16.8` |

---

### `server.js`

Express application entry point. Loads environment variables from `.env.development`, instantiates an Express app with CORS and JSON-parsing middleware, defines a health-check route, connects to MongoDB via Mongoose, and dynamically imports route modules (with graceful degradation) before listening on the configured port. The server no longer performs any automatic seeding on startup; database seeding is handled externally via `seed.js`. Includes a global error handler middleware that catches JSON parse errors, CastError exceptions, ValidationError exceptions, and unknown errors, returning appropriate HTTP status codes.

#### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `dotenv` | `dotenv` (default) | External |
| `cors` | `cors` (default) | External |
| `express` | `express` (default) | External |
| `mongoose` | `mongoose` (default) | External |
| `./routes/services.js` | `servicesModule.default` (dynamic default import) | Internal |
| `./routes/pcs.js` | `pcsModule.default` (dynamic default import) | Internal |

#### Configuration constants

| Constant | Source / Default | Description |
|----------|------------------|-------------|
| `PORT` | `process.env.PORT` or `8080` | HTTP listen port |
| `MONGODB_URI` | `process.env.MONGODB_URI` or `mongodb://localhost:27017/where-is-my-model` | MongoDB connection string |
| `CLIENT_URL` | `process.env.CLIENT_URL` or `http://localhost:3000` | Comma-separated frontend origins (default: `http://localhost:3000`); parsed into an array to allow multi-origin CORS access |

#### Middleware stack (registration order)

1. **`cors({ origin: allowedOrigins })`** — Restricts cross-origin responses to an array of permitted origins derived from `CLIENT_URL` (comma-separated string split and trimmed). Supports localhost (`http://localhost:3000`).
2. **`express.json()`** — Parses incoming `application/json` request bodies into `req.body`.

#### Functions

- **`registerRoutes() → Promise<void>`**
  Dynamically imports route modules using `await import(...)` inside try/catch blocks so that missing route files do not crash the server. Registers `services` router first, then `pcs` router — order is critical because `/api/pcs/:pcId/services` must be matched before `/api/pcs/:id`.
  - **Returns:** nothing (resolves when both imports have been attempted)

- **`start() → Promise<void>`**
  Main bootstrap function. Connects to MongoDB, aborts with `process.exit(1)` on failure; then calls `registerRoutes()`; finally registers the global error handler middleware and starts the Express listener on `PORT`. No automatic database seeding is performed.
  - **Returns:** nothing (resolves when the server is listening)

#### Global error handler

Registered after all routes via `app.use((err, req, res, _next) => { ... })`. Acts as a safety net for errors that escape route-level try/catch blocks. Handles three specific error types before falling through to a generic 500 handler:

1. **JSON parse errors** — `err.type === 'entity.parse.failed'` or `err instanceof SyntaxError`
   - **Status:** 400
   - **Response:** `{ success: false, message: 'Invalid JSON in request body.' }`
   - **Log:** `console.warn`

2. **Mongoose CastError** — `err.name === 'CastError'` (invalid ObjectId in URL parameters)
   - **Status:** 400
   - **Response:** `{ success: false, message: "Invalid value for parameter \"${err.path}\"." }`
   - **Log:** `console.warn`

3. **Mongoose ValidationError** — `err.name === 'ValidationError'` (schema-level validation failure)
   - **Status:** 400
   - **Response:** `{ success: false, errors: [string, ...] }` — array of validation messages
   - **Log:** `console.warn`

4. **Unknown errors** — Any other error type
   - **Status:** 500
   - **Response:** `{ success: false, message: 'Internal server error' }`
   - **Log:** `console.error` (full error object)

---

### `.env.development`

Environment configuration for local development. Loaded by `dotenv` at the top of `server.js` via `dotenv.config({ path: '.env.development' })`. In production (Docker Compose), environment variables are injected directly, making this file a no-op as noted in the server code.

#### Defined variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `NODE_ENV` | `development` | Node.js runtime mode; gates dev-only logging and hot-reload behavior |
| `PORT` | `8080` | HTTP port for the Express server |
| `MONGODB_URI` | `mongodb://mongo:27017/where-is-my-model` | Connection string pointing to the `mongo` Docker service container |
| `CLIENT_URL` | `http://localhost:3000` | Comma-separated frontend origins; parsed into an array and forwarded to the CORS middleware's `origin` option (supports localhost access) |

---

### `package.json`

npm project configuration file that serves as the backend's manifest. Declares the server framework, database driver, and runtime dependencies for an Express + MongoDB stack.

#### Content overview

| Field | Value |
|-------|-------|
| `name` | `where-is-my-model-backend` |
| `version` | `1.0.0` |
| `description` | Express + Mongoose API server for where-is-my-model GPU dashboard |
| `type` | `"module"` (ESM) |
| `main` | `server.js` (application entry point) |

#### Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `start` | `node server.js` | Launch the Express server directly with Node.js |

#### Dependencies

| Package | Version | Type | Role |
|---------|---------|------|------|
| `express` | ^4.21.0 | External | Web framework for REST API routing and middleware |
| `mongoose` | ^8.9.0 | External | MongoDB ODM for data modeling and persistence |
| `cors` | ^2.8.5 | External | Cross-Origin Resource Sharing middleware, enabling the frontend to call this API from a different origin |
| `dotenv` | ^16.4.0 | External | Environment variable loader (`.env` files) for configuration management |

---

---

### `Dockerfile`

Single-stage Dockerfile that produces a production-ready backend image for Docker Compose orchestration. Based on `node:20-alpine`, it uses an optimized two-step COPY strategy to maximize Docker layer caching: dependency installation is cached independently of source code changes, reducing rebuild times during active development.

#### Build stages

| Stage | Instruction | Purpose |
|-------|-------------|---------|
| Base image | `FROM node:20-alpine` | Lightweight Node.js 20 LTS runtime on Alpine Linux (~177 MB vs ~900 MB for Debian) |
| Working dir | `WORKDIR /app` | Sets `/app` as the container's working directory for all subsequent instructions |
| Layer 1 — deps | `COPY package*.json ./` then `RUN npm install --production` | Copies only manifest files first; installs production dependencies. This layer is cached unless `package.json` or `package-lock.json` change. |
| Layer 2 — source | `COPY . .` | Copies all remaining application source files (`.js`, config, etc.) into the image. In dev-mode with Docker Compose volume mounts, this layer is overlaid with live host source for hot-reload. |
| Network | `EXPOSE 8080` | Documents the port Express listens on; enables port mapping in `docker-compose.yml` |
| Entrypoint | `CMD ["node", "server.js"]` | Default process: launches the Express API server via `server.js` (the same entry point used natively with `npm start`) |

#### Layer caching strategy

```
package*.json changed? ──No──→  Layers 1 & 2 cached → fast rebuild (~seconds)
       │
      Yes
       ▼
  Reinstall deps (Layer 1) → check source → rebuild Layer 2 if needed
```

This means typical code edits (changing a route handler, modifying middleware) do not trigger `npm install`, keeping iterative build times minimal even with a large dependency tree.

#### Runtime considerations

- **No devDependencies** — `npm install --production` skips test tooling, linters, and TypeScript compilers. Development debugging must be done via Docker Compose exec or by attaching a debugger to the running container.
- **Volume mount for hot-reload** — In `docker-compose.yml`, the backend service mounts the host's `./backend/` directory over `/app`, invalidating Layer 2. This allows source changes to reflect immediately without rebuilding the image.
- **Env injection** — `.env.development` is excluded by `.dockerignore`. Environment variables are injected at runtime via Docker Compose's `environment:` or `env_file:` directives, preventing credential baked-in images.

---

### `test-gpu-cap.sh`

Integration verification script (Bash) that end-to-end tests the GPU VRAM capacity validation rule: `sum(services[].gpu) <= pc.vram`. Uses `curl` for HTTP requests and `jq` for JSON parsing.

#### How to run

```bash
./backend/test-gpu-cap.sh [BASE_URL]
```

- `BASE_URL` is optional; defaults to `http://localhost:8080/api`.
- Requires: `curl`, `jq`.
- Requires a running backend server connected to MongoDB.

#### Tests performed

| # | Description | Expected | Verifies |
|---|-------------|----------|----------|
| 1 | Create a PC with 24 GB VRAM | HTTP 201 | PC creation works |
| 2 | Add 16 GB GPU service | HTTP 201 (16 ≤ 24) | Service added within VRAM cap |
| 3 | Add 12 GB GPU service | HTTP 400 (16+12=28 > 24) | Over-capacity rejected |
| 4 | Verify PC has exactly 1 service | 1 service | Rejection did not mutate state |
| 5 | Add 8 GB GPU service | HTTP 201 (16+8=24 = cap) | Exact-cap boundary accepted |
| 6 | Add 1 GB GPU service | HTTP 400 (24+1=25 > 24) | Post-cap rejected |
| 7 | Final state check | 2 services, totalGpu=24 | State is consistent |

#### Cleanup

The script registers a `trap cleanup EXIT` handler that deletes the test PC (`DELETE /api/pcs/:id`) on exit, regardless of pass/fail outcome.

---

### `test-gpu-cap.js`

Integration verification script (Node.js) that performs the same GPU VRAM capacity validation tests as `test-gpu-cap.sh`, but uses Node.js built-in `fetch` (requires Node.js 18+).

#### How to run

```bash
node backend/test-gpu-cap.js [BASE_URL]
```

- `BASE_URL` is optional; defaults to `http://localhost:8080/api`.
- Requires: Node.js 18+ (for native `fetch`).
- Requires a running backend server connected to MongoDB.

#### Tests performed

Identical to `test-gpu-cap.sh` — 7 test steps covering: PC creation, within-cap service addition, over-capacity rejection, state mutation check after rejection, exact-cap boundary acceptance, post-cap rejection, and final state verification.

#### Cleanup

Uses a `finally` block to always call `cleanup()`, which issues `DELETE /api/pcs/:pcId` before the script exits.

#### Implementation notes

- Uses an `api(method, path, body)` helper that wraps `fetch` and returns `{ status, body }`.
- Uses a custom `assert(condition, description)` function for pass/fail tracking with colored terminal output.

---

### `.dockerignore`

File that controls which host files and directories are excluded from the Docker build context sent to the Docker daemon. Prevents unnecessary data transfer, reduces image size, and protects sensitive material from being baked into container layers.

#### Exclusion rules

| Pattern | Category | Rationale |
|---------|----------|-----------|
| `node_modules` | Dependency artifacts | Dependencies are installed fresh inside the image via `npm install --production`. Copying host `node_modules` would introduce platform-incorrect binaries (e.g., macOS/Darwin `.node` builds) and increase build context size. |
| `.env*` | Environment files | Prevents credentials, MongoDB URIs, and secrets from being baked into the image. These are injected at runtime via Docker Compose configuration (`environment:` or `env_file:`). |
| `.DS_Store` | macOS metadata | OS artifact that adds no value to the container. |
| `*.swp`, `*.swo`, `*~` | Editor swap/temp files | Vim-style swap and backup files left by editors; transient and irrelevant inside a container. |
| `.vscode/` | IDE configuration | Visual Studio Code workspace settings are host-specific and not needed during runtime. |
| `.idea/` | IDE configuration | JetBrains IDE project metadata; host-specific preferences excluded from the build context. |

#### What is intentionally included

- **`seed.js`** — The database seeding script is intentionally **not excluded**. If database initialization must occur inside the container, it can be invoked via `docker compose exec backend node seed.js`. The `.dockerignore` file includes an inline comment documenting this usage pattern.
- **`package-lock.json`** — Included to guarantee deterministic dependency resolution during `npm install --production`, ensuring reproducible builds across environments.

## 🔄 Changes in this update

- **Updated `server.js` middleware section** — CORS origin is now an array derived from comma-separated `CLIENT_URL` instead of a single string. This allows multiple frontend origins to connect (localhost + LAN IP). See "Middleware stack" table.
- **Updated `.env.development` — `CLIENT_URL` value** — Changed from `http://localhost:3000` to `http://localhost:3000,http://192.168.57.10:3000` to include the LAN IP for multi-device testing.
- **Updated `server.js` — `CLIENT_URL` constant description** — Noted that it now accepts comma-separated origins with default fallback.
- **Updated `server.js` — Middleware stack entry 1** — Changed from single-origin `cors({ origin: CLIENT_URL })` to multi-origin `cors({ origin: allowedOrigins })` with explanation of LAN + localhost support.
- Updated `> Last updated:` to 2026-06-04.
- Previous updates retained: `Dockerfile`, `.dockerignore`, `routes/` and `models/` subfolder documentation, `seed.js`, `package.json`, and `server.js` structural documentation. — including base image (`node:20-alpine`), two-stage layer caching strategy (dependency install isolated from source copy), build stage table, runtime considerations (volume mount hot-reload, env injection via Docker Compose, no devDependencies).
- **Added `.dockerignore`** as a direct file with full documentation — including exclusion rules table (`node_modules`, `.env*`, editor artifacts, IDE directories), rationale for each rule, and intentional inclusions (`seed.js` with exec usage pattern, `package-lock.json` for reproducible builds).
- **Updated folder description** to mention Docker containerization and Docker Compose orchestration design.
- Updated `> Last updated:` to 2026-06-04.
- Previous updates retained: `routes/` and `models/` subfolder documentation, `server.js`, `.env.development`, `package.json`, and `seed.js` direct file entries.
- **Verified multi-origin CORS support** — Confirmed that `server.js` parses `CLIENT_URL` into an array via `.split(',').map(u => u.trim())` and passes it as the `origin` option to `cors()`, and that `.env.development` defines `CLIENT_URL` as `http://localhost:3000,http://192.168.57.10:3000` to support both localhost and LAN frontend access.

## 🔄 Changes in this update

- **Task 5 — Added `test-gpu-cap.sh`**: Bash integration test script that verifies GPU VRAM capacity validation (`sum(services[].gpu) <= pc.vram`) end-to-end using `curl` and `jq`. Runs 7 tests covering PC creation, within-cap service addition, over-capacity rejection, state mutation check after rejection, exact-cap boundary acceptance, post-cap rejection, and final state verification. Includes cleanup trap that deletes the test PC on exit.
- **Task 5 — Added `test-gpu-cap.js`**: Node.js integration test script performing the same GPU VRAM capacity validation tests as `test-gpu-cap.sh` using native `fetch` (Node.js 18+). Same 7-test sequence with `assert` helper and `api` wrapper for HTTP requests. Cleanup via `finally` block.
- Documented both test scripts in the backend.md "Direct files" section with: purpose, usage, test matrix, cleanup behavior, and implementation notes.

## 🔄 Changes in this update

- **Task 5 — `server.js` — Added `autoSeedOnEmpty()` function**: New async function that checks if the `pcs` collection is empty via `PC.countDocuments()`. If empty, reads `data.json` from the project root, maps hyphenated/wrapped keys to camelCase (same transformation logic as `seed.js`), and inserts documents via `PC.insertMany()`. No `deleteMany()` or `disconnect()` — only bootstraps an empty database. Wrapped in try/catch with `console.warn` so the server starts regardless of seeding outcome. Called in `start()` between `mongoose.connect()` and `registerRoutes()`.
- **Task 5 — `server.js` — Added new imports**: `fs` (`existsSync`, `readFileSync`), `url` (`fileURLToPath`), and `path` (`resolve`, `dirname`) for ESM `__dirname` helpers and project-root-relative `data.json` path resolution.
- **Task 5 — `server.js` — Added ESM `__dirname` helpers**: `__filename` and `__dirname` computed via `fileURLToPath`/`dirname` so `autoSeedOnEmpty()` can resolve `data.json` relative to the project root.
- **Task 5 — `server.js` — Updated `start()` function**: Now calls `autoSeedOnEmpty()` between MongoDB connection and route registration.
- **Task 6 — `.env.development` — Removed hardcoded LAN IP from `CLIENT_URL`**: Changed from `http://localhost:3000,http://192.168.57.10:3000` to `http://localhost:3000` only, removing the machine-specific IP.
- **Task 6 — `server.js` — Updated `CLIENT_URL` constant description**: Removed "(localhost + LAN)" qualifier.
- **Task 6 — `server.js` — Updated middleware stack**: CORS origin description no longer references LAN IP (`192.168.57.10`), now lists only `http://localhost:3000`.

## 🔄 Changes in this update

- **Task 4 — `server.js` — Added global error handler middleware**: Registered after all routes via `app.use((err, req, res, _next) => { ... })`. Handles JSON parse errors (400), CastError exceptions (400), ValidationError exceptions (400), and unknown errors (500 with logging). Updated server.js description to mention global error handler.
- **Task 4 — `routes/pcs.js` — Added CastError handling in catch blocks**: `GET /:id`, `PUT /:id`, and `DELETE /:id` routes now check for `err.name === 'CastError'` and return 400 with message 'Invalid PC ID format.' for invalid ObjectId strings.
- **Task 4 — `routes/services.js` — Added CastError handling in catch blocks**: `GET /`, `POST /`, `PUT /:serviceIndex`, and `DELETE /:serviceIndex` routes now check for `err.name === 'CastError'` and return 400 with message 'Invalid PC ID format.' for invalid ObjectId strings.
- Updated routes.md to document CastError handling for all affected endpoints (pcs.js: GET /:id, PUT /:id, DELETE /:id; services.js: GET /, POST /, PUT /:serviceIndex, DELETE /:serviceIndex).
- Updated backend.md to document global error handler middleware in server.js section.

## 🔄 Changes in this update

- **`server.js` — Removed `autoSeedOnEmpty()` function**: The auto-seeding function that checked whether the `pcs` collection was empty and bootstrapped it from `data.json` has been entirely removed. The server no longer performs any automatic database seeding on startup.
- **`server.js` — Removed file-system and path-related imports**: The following imports have been removed as they were exclusively used by `autoSeedOnEmpty()`:
  - `fs` (`existsSync`, `readFileSync`)
  - `url` (`fileURLToPath`)
  - `path` (`resolve`, `dirname`)
- **`server.js` — Removed ESM `__dirname` helpers**: The `__filename` and `__dirname` variables computed via `fileURLToPath`/`dirname` have been removed. The server no longer needs to resolve `data.json` relative to the project root.
- **`server.js` — Simplified `start()` function**: The `start()` function no longer calls `autoSeedOnEmpty()`. It now follows a simpler sequence: (1) connect to MongoDB, (2) register routes, (3) register global error handler, (4) start listening on the configured port.
- **Folder description updated**: Removed references to `autoSeedOnEmpty()` and automatic seed-on-startup behavior. Clarified that database seeding is now handled exclusively by the standalone `seed.js` script.
- Updated `> Last updated:` to 2026-06-04.
