# `backend`

> Path: `backend/`
> Last updated: 2026-07-11
> Type: Composite folder

Express + Mongoose REST API server that manages GPU compute servers and their assigned network services. The backend enforces per-GPU VRAM capacity constraints at the schema level (Mongoose validators), middleware level (request-body validation), and route level (error handling). Deployed as a Node.js 20 Alpine container via Docker Compose, backed by MongoDB for persistent storage. Multi-GPU servers are fully supported — each GPU is individually tracked with its own VRAM allocation pool, and services can be reassigned between GPUs on the same server via partial-update routes.

---

## 📁 Subfolders

| Folder | Documentation | Description |
|--------|--------------|-------------|
| `models/` | [see docs](./models.md) | Mongoose schema definitions for the PC model (multi-GPU servers with embedded service subdocuments, per-GPU virtual fields, and document-level VRAM-cap validators). |
| `routes/` | [see docs](./routes.md) | Express Router modules providing CRUD REST endpoints for PCs (`/api/pcs`) and nested Services (`/api/pcs/:pcId/services`), with standardized response envelopes and CastError handling. |
| `middleware/` | [see docs](./middleware.md) | Request-body validation middleware (collect-all-errors pattern) that enforces per-GPU VRAM limits, IPv4 format checks, and backward-compatible scalar-vram-to-gpus-array transformation. |
| `services/` | [see docs](./services.md) | Application-level services — TCP health-check utility (`healthChecker.js`) for probing the reachability of network services hosted on GPU compute servers, using only Node.js built-in `net`. |

---

## 📄 Direct files

### `server.js`

Application entry point. Loads environment configuration, establishes the MongoDB connection via Mongoose, registers Express middleware (CORS with origin allowlist, JSON body parsing), serves a simple inline health check (`GET /api/health`), mounts three route modules in dependency-safe order (health router at `/api/check-health` first, then services router before PCs router to avoid parameter collision), installs a global error handler, and starts listening on the configured port.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `dotenv` | `default` (namespace) | External |
| `cors` | `default` (namespace) | External |
| `express` | `default` (namespace) | External |
| `mongoose` | `default` (namespace) | External |

### Configuration

| Variable | Default value | Purpose |
|----------|--------------|---------|
| `PORT` | `8080` | HTTP listening port |
| `MONGODB_URI` | `mongodb://localhost:27017/where-is-my-model` | MongoDB connection string |
| `CLIENT_URL` | `http://localhost:3000` | Comma-separated list of allowed CORS origins |

### Functions

- **`registerRoutes() → void`** (async)
  Dynamically imports and mounts three route modules in order: health router at `/api/check-health` first, services router second at `/api/pcs/:pcId/services`, and PCs router last at `/api/pcs`. The ordering prevents Express from matching `:pcId` against the literal path segments `"services"` or `"check-health"`. Each import is wrapped in try/catch so that a missing route module degrades gracefully (warns to console rather than crashing).
  - **Returns:** nothing — side-effect only (calls `app.use()` for each router)

- **`start() → void`** (async)
  Top-level startup orchestrator. Connects to MongoDB, calls `registerRoutes()`, installs the global Express error handler (catches JSON parse errors, Mongoose CastErrors, Mongoose ValidationErrors, and unhandled exceptions), then calls `app.listen(PORT)`. Exits with code 1 if MongoDB connection fails.
  - **Returns:** nothing — side-effect only (starts HTTP server)

### Global Error Handler (Express middleware — `(err, req, res, next)`)

Registered after all routes; catches any error that escapes route-level try/catch blocks:

| Error type | HTTP status | Response envelope |
|-----------|-------------|-------------------|
| `SyntaxError` / `entity.parse.failed` | 400 | `{ success: false, message: 'Invalid JSON in request body.' }` |
| Mongoose `CastError` | 400 | `{ success: false, message: 'Invalid value for parameter "{err.path}".' }` |
| Mongoose `ValidationError` | 400 | `{ success: false, errors: [string, ...] }` — extracted from `err.errors` |
| Unhandled (default) | 500 | `{ success: false, message: 'Internal server error' }` |

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
| Dependencies | `COPY package*.json ./` → `RUN npm install --production` | Cached unless `package.json` or `package-lock.json` change |
| Application | `COPY . .` | Rebuilt on every Docker build (overridden by volume mount in dev) |

### Runtime configuration

| Directive | Value |
|-----------|-------|
| Working directory | `/app` |
| Exposed port | `8080` |
| Default command | `node server.js` |

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

### Dependencies

| Package | Version | Role |
|---------|---------|------|
| `express` | `^4.21.0` | Web framework — routing, middleware, request/response handling |
| `mongoose` | `^8.9.0` | MongoDB ODM — schema definition, validation, model queries |
| `cors` | ^2.8.5` | Cross-Origin Resource Sharing — origin-restricted preflight support |
| `dotenv` | `^16.4.0` | Environment variable loading from `.env.development` |

---

### `.env.development`

Environment configuration file loaded by `server.js` (via `dotenv.config({ path: '.env.development' })`) during development and via Docker Compose at runtime for production.

| Variable | Value | Purpose |
|----------|-------|---------|
| `NODE_ENV` | `development` | Tells Node.js frameworks to enable verbose debug output and hot-reload modes |
| `PORT` | `8080` | HTTP listening port |
| `MONGODB_URI` | `mongodb://mongo:27017/where-is-my-model` | MongoDB URI — uses Docker Compose service name `mongo` for container-to-container networking |
| `CLIENT_URL` | `http://localhost:3000` | Frontend origin for CORS allowlist |

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
    ├─→ CORS middleware (origin whitelist from CLIENT_URL)
    │
    ├─→ express.json() (body parsing; errors → global 400 handler)
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
| `test-gpu-cap.js` | `node test-gpu-cap.js [BASE_URL]` | Node.js integration test for VRAM-cap enforcement |
| `test-gpu-cap.sh` | `./test-gpu-cap.sh [BASE_URL]` | Shell-based integration test (same coverage as .js variant)

---

## 🔄 Changes in this update

- **`server.js`** — Added health router registration inside `registerRoutes()`. A new dynamic import block loads `./routes/health.js` and mounts it at `/api/check-health`, wrapped in try/catch for graceful degradation. The health router is now the *first* registered route, preceding services and PCs routers (order: health → services → pcs). Updated code comments to document all three routers and their ordering rationale. Current documentation now reflects all three dynamically imported route modules instead of the previous two.
