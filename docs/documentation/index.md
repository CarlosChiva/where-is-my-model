# Root — Where Is My Model

> Path: `/`
> Last updated: 2026-07-11
> Type: Composite folder (project root)

**Where Is My Model** is a full-stack web application that serves as a GPU infrastructure dashboard for catalogueing multi-GPU compute servers running AI inference services. The frontend lets operators see real-time VRAM occupancy via colour-coded progress bars, manage server and service inventories through CRUD operations in modal dialogs, and estimate VRAM budgets for loading large language models using an interactive calculator with seven attention-architecture variants. The backend enforces per-GPU VRAM capacity constraints at three levels (schema validator, request-body middleware, route error handling) and persists all state to MongoDB. The entire stack is containerised and orchestrated by a single `docker-compose.yml` file that brings up three services on a shared Docker bridge network: Vite dev server (frontend), Express API (backend), and MongoDB (data store).

---

## 📁 Subfolders

| Folder | Documentation | Description |
|--------|--------------|-------------|
| `backend/` | [see docs](./backend/Backend.md) | Express + Mongoose REST API with per-GPU VRAM capacity enforcement, multi-GPU schema support, request-body validation middleware, and integration tests. |
| `frontend/` | [see docs](./frontend.md) | React 19 + Vite 8 SPA project root: Tailwind theme configuration, PostCSS/ESLint pipeline config, package manifest, three-stage Dockerfile, nginx production server config, SPA entry HTML, and environment files. |

---

## 📄 Direct files

### `docker-compose.yml`

Single-file Docker Compose orchestration that brings up the entire three-service stack on a shared `app-network` bridge network. Defines explicit startup ordering with health-check dependencies so that the backend does not start until MongoDB is healthy, and the frontend waits for the backend to be available.

### Composition overview

| Service | Image / Build context | Host port | Container port | Depends on | Key configuration |
|---------|----------------------|-----------|----------------|------------|-------------------|
| `frontend` | `./frontend` (multi-stage, `development` target) | `3000` → `3000` | Vite dev server + HMR | `backend` (service ready) | Volume mount `./frontend:/app` for live-reload; named volume `/app/node_modules` to avoid host-node-modules conflict; `VITE_API_PROXY_TARGET=http://backend:8080` env var for API proxy |
| `backend` | `./backend` (Node 20 Alpine) | `9003` → `8080` | Express on port 8080 | `mongo` (`service_healthy`) | Loads `./backend/.env.development`; volume mount `./backend:/app` for live-reload; named volume `/app/node_modules` |
| `mongo` | `mongo:7` (official) | — (internal only, not exposed to host) | 27017 | — | Health check via `mongosh --eval "db.adminCommand('ping')"` with 10 s interval, 5 s timeout, 5 retries, 10 s start period; persistent volume `mongo-data:/data/db` |

### Startup ordering guarantee

```
Host runs: docker compose up
         │
         ├── mongo starts → healthcheck polls every 10s until ping succeeds
         │
         └── backend starts once mongo is healthy → loads .env.development → connects to mongodb://mongo:27017/where-is-my-model
             │
             └── frontend starts once backend is up → Vite dev server on :3000 with API proxy pointing to http://backend:8080
```

### Named volumes

| Volume | Mount path | Purpose |
|--------|-----------|---------|
| `mongo-data` | `/data/db` (inside mongo container) | Persistent MongoDB data across container restarts and recompositions |

---

### `.gitignore`

Repository-level version-control exclusion list. Prevents sensitive environment files, generated build artifacts, dependency directories, and agent tooling configuration from being tracked by Git.

### Excluded paths

| Pattern | Rationale |
|---------|-----------|
| `.agents/` | Local AI agent tooling configuration — contains skills and agent definitions that should not be versioned |
| `.env` | Environment variables / secrets that must remain local to each deployment |
| `dist/` | Vite production build output (regenerated on every `npm run build`) |
| `node_modules/` | Node.js dependencies (installed fresh via `npm install`; not portable across platforms) |
| `skills-lock.json` | Auto-generated lockfile for agent skill versions — tracked per-environment, not in source control |

---

### `skills-lock.json`

Lockfile that records which external agent skills are installed in this project and their content hashes. Used by the agent framework to determine whether a skill needs re-downloading or updating. Not version-controlled (see `.gitignore`).

### Installed skills

| Skill name | Source repository | Hash |
|------------|------------------|------|
| `frontend-design` | `anthropics/skills` (GitHub) | `063a0e…42bd2ffbca67` |
| `vercel-react-best-practices` | `vercel-labs/agent-skills` (GitHub) | `ca7b0c…2506212` |

---

## Project architecture — the big picture

### Technology stack summary

| Layer | Technology | Role |
|-------|-----------|------|
| **Frontend framework** | React 18 (functional components + Hooks) | User interface for server dashboard and GPU calculator |
| **Build tool** | Vite 5+ (ESM, HMR) | Fast dev server, production bundler |
| **Styling** | Tailwind CSS | Utility-first classes applied directly in JSX templates |
| **Backend framework** | Express 4.x | RESTful HTTP API, routing, middleware pipelines |
| **ODM** | Mongoose 8.x | Schema definitions, validation MongoDB queries |
| **Database** | MongoDB 7 | Persistent document storage for PC inventory and nested services |
| **Container orchestration** | Docker Compose v3.9 | Three-service stack on a bridge network |

### Full client–server data flow

```
Browser (port 3000)
    │
    ▼
┌─────────────────────────────────────────────┐
│  frontend/ (Vite dev server, React SPA)     │
│                                             │
│  main.jsx → App.jsx                         │
│       │                                     │
│       ├── Header.jsx  (page tabs, nav)      │
│       │                                     │
│       ├── PCGrid.jsx → PCCard.jsx           │
│       │         → ServiceRow / GPUBar        │
│       │         ← data from usePcs() hook    │
│       │                                     │
│       ├── Modals (Add/Edit/Delete)          │
│       │     ← controlled by modalState router│
│       │     ← call mutation hooks            │
│       │                                     │
│       └── GPUCalculatorPage.jsx             │
│             ← uses calculatorEngine utils    │
│                                             │
│  services/apiClient.js                      │
│       → fetch() → Vite proxy (/api/*)        │
│                                             │
└──────────────┬──────────────────────────────┘
                │  /api/* → Vite proxy → backend:8080
                ▼
┌─────────────────────────────────────────────┐
│  backend/ (Express on port 8080)            │
│                                             │
│  server.js                                  │
│       ├── CORS middleware (CLIENT_URL list) │
│       ├── express.json() body parser        │
│       ├── GET /api/health (inline)           │
│       ├── Route registration:               │
│       │     /api/check-health FIRST          │
│       │     /api/pcs/:pcId/services SECOND   │
│       │     /api/pcs THIRD                   │
│       └── Global error handler              │
│                                             │
│  middleware/validation.js                   │
│       ├── validatePcBody                    │
│       ├── validateServiceBody               │
│       └── validateServiceUpdate             │
│                                             │
│  models/PC.js                               │
│       → Mongoose schema with embedded        │
│         servicios subdocuments, per-GPU      │
│         virtual fields, VRAM-cap validators  │
│                                             │
│  routes/ (Express Routers)                  │
│       → MongoDB CRUD via PC model            │
│                                             │
└──────────────┬──────────────────────────────┘
               │  Mongoose connection string:
               │  mongodb://mongo:27017/where-is-my-model
               ▼
┌─────────────────────────────────────────────┐
│  mongo/ (MongoDB 7 on internal port 27017)   │
│                                             │
│  Collection: "pcs"                          │
│       ├── nombre        (string, server     │
│       │                 label)               │
│       ├── ip            (IPv4 address)      │
│       ├── gpus          [{ name, vram }]    │
│       └── servicios     [{ nombre, puerto,  │
│                           gpu, assignedGpu}] │
│                                             │
│  Volume: mongo-data:/data/db (persistent)   │
└─────────────────────────────────────────────┘
```

### How the pieces fit together

1. **Infrastructure layer** — Docker Compose starts MongoDB first with a health check. Once it pings clean, the backend container launches and connects via `mongodb://mongo:27017/where-is-my-model`. Finally, the frontend Vite dev server starts, configured to proxy all `/api/*` requests to `http://backend:8080`.

2. **Data persistence** — Every PC (compute server) is a single MongoDB document in the `pcs` collection. Services running on that server are embedded subdocuments within the parent PC record. No separate services collection exists. The Mongoose `PC` model defines per-GPU VRAM capacity validators that fire both at the schema level and during `.save()`.

3. **API contract** — The backend exposes two REST resources: `POST/GET/PUT/DELETE /api/pcs` for server management, and nested `POST/GET/PUT/DELETE /api/pcs/:pcId/services` for service lifecycle. All responses use a standard envelope (`{ data?, error?, success }`). Validation middleware intercepts request bodies before they reach route handlers, collecting all field errors into a single aggregated response.

4. **Frontend orchestration** — The React SPA's `App.jsx` is the sole orchestrator: it owns all data-fetching hooks and mutation hooks, manages a modal-state router object to decide which dialog renders, and switches between dashboard and calculator views via a single `currentPage` state variable. Modals receive mutable callbacks; on success they trigger `refetch` through each hook's `onSuccess` callback, keeping the UI in sync with server state without manual refresh logic.

5. **GPU calculator** — Independent of the CRUD flow, the calculator page (`GPUCalculatorPage.jsx`) imports the same utility functions from `utils/` that power dashboard visuals (`gpuHelpers.js` for colour coding/clamping, `calculatorEngine.js` for VRAM estimation across seven attention architectures). This ensures the numbers shown in the calculator match the visualisation on the dashboard.

6. **Data seeding and testing** — `seed.js` in the backend reads a flat `data.json` from the repository root, transforms it into Mongoose-compatible documents, and populates the `pcs` collection. Two integration tests (`test-gpu-cap.js` and `target: test-gpu-cap.sh`) exercise the VRAM capacity enforcement end-to-end with auto-cleanup.

---

## Entry points for development

| What to run | Command | Effect |
|-------------|---------|--------|
| Start the whole stack | `docker compose up` | Launches mongo → backend → frontend in sequence; frontend reachable at `http://localhost:3000`, API at `http://localhost:9003` |
| Seed the database | `docker compose exec backend node seed.js` | Reads `data.json` and populates MongoDB via the PC model |
| Run integration tests (Node) | `node backend/test-gpu-cap.js http://localhost:9003/api` | Exercises VRAM-cap enforcement, auto-cleans test data |
| Run integration tests (Shell) | `./backend/test-gpu-cap.sh http://localhost:9003/api` | Same coverage as the Node variant, uses `curl` + `jq` |
| Build for production | In frontend container: `npm run build` → `dist/` | Vite bundles a static SPA ready to serve behind any HTTP server |

---

## Quick reference — who does what?

| Concern | Where to look |
|---------|--------------|
| REST API routes, middleware, models | `backend/` (see [Backend.md](./backend/Backend.md)) |
| React components, hooks, API client | `frontend/src/` (see [Src.md](./frontend/src/Src.md)) |
| Startup ordering, networking, volumes | `docker-compose.yml` (above) |
| VRAM calculator algorithm details | `frontend/src/utils/calculatorEngine.js` (documented in [Src.md](./frontend/src/Src.md) under `utils/`) |
| Per-GPU capacity enforcement chain | Spans `backend/middleware/`, `backend/models/`, and `backend/routes/` (all documented in [Backend.md](./backend/Backend.md)) |
