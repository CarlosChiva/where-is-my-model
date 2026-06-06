# Project Documentation Index

> Auto-generated — last updated: 2026-06-04
>
> ## 🔄 Changes in this update
>
> - Updated `css` entry: marked as **REMOVED** — legacy CSS partials deleted in commit `9724cfb` (Task T15). Documentation preserved as historical reference.
> - Updated `js` entry: marked as **REMOVED** — legacy vanilla JS modules deleted in commit `9724cfb` (Task T15). Documentation preserved as historical reference.
> - Updated `where-is-my-model` entry: removed references to legacy `index.html`; clarified that the active frontend is React + Vite in `frontend/`.
> - Updated Quick usage guide: removed all references to deleted legacy files (`index.html`, `css/*`, `js/*`); redirected business logic and entry point references to the React frontend.
> - Added entry for `frontend-components-phase4.md` (7 React components: Header, GPUBar, GPUDetails, ServiceRow, PCCard, PCGrid, App.jsx) to the Module Map table.
> - Updated backend entry description to mention global error handler middleware that catches JSON parse errors, CastError exceptions, ValidationError exceptions, and unknown errors.
> - Updated backend entry description to mention integration test scripts (`test-gpu-cap.sh`, `test-gpu-cap.js`) for GPU VRAM capacity validation.
> - Updated backend entry description: removed references to `autoSeedOnEmpty()` on-startup auto-seeding; clarified that database initialization is handled exclusively by `seed.js`. The server no longer imports `fs`, `url`, or `path` modules and no longer computes `__dirname`/`__filename` ESM helpers.

---

## 🗺️ Module Map

| Module | Path | Description |
|--------|------|-------------|
| [css](./css.md) | `css/` | **REMOVED** — Legacy CSS partials for the flat HTML prototype. Previously: `styles.css` (master entry), `base.css` (reset, theme, typography), `layout.css` (page structure, responsive grid), `components.css` (widgets, dialogs, forms), `animations.css` (card entrance, GPU bar fill, warning pulse). All deleted in commit `9724cfb`. |
| [backend](./backend.md) | `backend/` | Express API server for the GPU dashboard. `server.js` bootstraps the app with CORS and JSON middleware, connects to MongoDB via Mongoose (failing fast on error), exposes a `/api/health` endpoint, and lazily registers route modules (`services`, then `pcs`) after DB connectivity is confirmed. No automatic seeding on startup; database initialization is handled exclusively by `seed.js`. Includes a global error handler middleware that catches JSON parse errors, CastError exceptions, ValidationError exceptions, and unknown errors. `.env.development` provides local configuration. Subfolder `models/` contains the Mongoose `PC` schema with embedded service subdocuments, VRAM-capacity validators, and automatic timestamps. `seed.js` populates MongoDB from `data.json` with destructive idempotency (drops then re-seeds). Two integration test scripts (`test-gpu-cap.sh` for Bash/curl, `test-gpu-cap.js` for Node.js/fetch) verify GPU VRAM capacity validation end-to-end. Containerized via a single-stage Dockerfile (`node:20-alpine`, two-layer caching strategy) with `.dockerignore` that excludes `node_modules`, `.env*`, and editor artifacts — designed for Docker Compose orchestration alongside frontend and MongoDB services. |
| [js](./js.md) | `js/` | **REMOVED** — Legacy vanilla JavaScript modules for the flat HTML prototype. Previously: `models.js` (Service, PC classes), `data.js` (loading, normalization, persistence), `views.js` (rendering layer, 13 functions), `editors.js` (dialog management, CRUD, event wiring), `app.js` (bootstrap). All deleted in commit `9724cfb`. |
| [where-is-my-model](./where-is-my-model.md) | `/` | Repository root containing `data.json` (GPU infrastructure schema with 3 servers / 8 services) and `docker-compose.yml` (orchestration for frontend + backend + mongo). Legacy `index.html`, `css/`, and `js/` removed in commit `9724cfb`. Active frontend is the React + Vite application in `frontend/`. |
| [docker](./docker.md) | `docker-compose.yml` | Docker Compose orchestration defining three services (frontend, backend, mongo) on a shared bridge network `app-network` with health checks, named volume `mongo-data` for persistence, and dependency-ordered startup (mongo → backend → frontend). Frontend runs Vite on host port 3000 with env var `VITE_API_PROXY_TARGET=http://backend:8080` to route `/api` requests internally to the backend container. Backend maps host port 9003 to container port 8080 and loads `backend/.env.development` via `env_file`. Mongo uses `mongo:7` image with `mongosh` health check, no host port exposed. |
| [frontend](./frontend.md) | `frontend/` | React + Vite frontend for the GPU dashboard: `vite.config.js` configures dev server on port 3000 with `/api` proxy targeting `process.env.VITE_API_PROXY_TARGET` (fallback `http://backend:8080`); `.env` and `.env.development` provide runtime-configurable proxy targets for Docker Compose and local development environments respectively (12-factor principle); `index.html` serves as the HTML entry point with branded title "Where is My Model — GPU Dashboard" and Google Fonts preconnect/preload (Spectral, JetBrains Mono); `nginx.conf` configures production nginx server serving static SPA assets with security headers (`X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, `X-XSS-Protection`), gzip compression, 1-year immutable cache for versioned files, `index.html` no-cache policy, SPA fallback via `try_files`, and reverse proxy for `/api` to backend with WebSocket upgrade support (`map $http_upgrade $connection_upgrade`); `Dockerfile` is multi-stage (development `node:20-alpine`, build `node:20-alpine`, production `nginx:alpine`) with volume mount integration and `--host` binding; `.dockerignore` excludes build artifacts, `.env*`, and IDE files; `build.sourcemap: false` disables production source maps; subfolder `src/` holds React source files (`main.jsx`, `App.jsx`, `index.css`). |
| [frontend-components-phase4](./frontend-components-phase4.md) | `frontend/src/components/` + `frontend/src/App.jsx` | Seven React components (Header, GPUBar, GPUDetails, ServiceRow, PCCard, PCGrid, App.jsx) constituting Phase 4 of the GPU dashboard migration to React + Vite + Tailwind CSS — presentational pattern with unidirectional data flow, callback bubbling, and modal state routing. |

---

## 📋 Quick usage guide for agents

> Section designed for LLM agents to quickly locate the part of the code
> they need without reading all the documentation.

### What does this repository do?
Full-stack dashboard for visualizing and editing distributed GPU server infrastructure. The active frontend is a React + Vite application with Tailwind CSS in `frontend/`. The backend is an Express + MongoDB API server in `backend/`. The application loads infrastructure data from `data.json`, renders interactive server cards, and allows CRUD operations via accessible modal dialogs. Docker Compose orchestrates frontend, backend, and MongoDB containers.

### How to navigate this documentation
Start here. Each entry in the Module Map is a top-level folder. Follow its link to see its direct files and subfolders. The root module documents `data.json` (the infrastructure data schema). The `frontend/` module documents the React application. The `backend/` module documents the Express API server. Legacy `css/` and `js/` entries are marked as **REMOVED** (historical reference only).

### Where is the business logic?
- **[frontend — React components](./frontend-components-phase4.md)** — Seven React components (Header, GPUBar, GPUDetails, ServiceRow, PCCard, PCGrid, App.jsx) implementing the dashboard UI with unidirectional data flow, callback bubbling, and modal state routing.
- **[backend — routes and models](./backend.md)** — Express API with MongoDB backend. Mongoose `PC` schema with embedded service subdocuments, VRAM-capacity validators. REST routes for CRUD operations.
- **[frontend — hooks](./frontend/src/hooks.md)** — Custom React hooks for data fetching and state management.
- **[frontend — utils](./frontend/src/utils.md)** — Shared utility functions.
- **Legacy JS (REMOVED)** — The `js/` folder previously contained vanilla JS business logic (`models.js`, `data.js`, `views.js`, `editors.js`, `app.js`). Deleted in commit `9724cfb`. See [js.md](./js.md) for historical reference.

### Where are the models or data structures?
- **[where-is-my-model — `data.json`](./where-is-my-model.md)** defines the JSON schema with server identifiers, IPs, services, ports, and GPU consumption percentages.
- **[backend — `models/PC.js`](./backend/models.md)** defines the Mongoose `PC` schema (MongoDB ODM) with embedded service subdocuments, VRAM-capacity validation, and automatic timestamps.
- **[frontend — React components](./frontend-components-phase4.md)** contain TypeScript/JavaScript interfaces and prop types for the dashboard data model.
- **Legacy `js/models.js` (REMOVED)** — Previously defined `Service` and `PC` ES6 classes. Deleted in commit `9724cfb`. See [js.md](./js.md) for historical reference.

### Where are the entry points?
- **[frontend — `frontend/index.html`](./frontend.md)** is the React application HTML entry point. Serves the root element for React hydration. Loads Google Fonts (Spectral, JetBrains Mono).
- **[frontend — `src/main.jsx`](./frontend/src.md)** is the React bootstrap file. Renders the `<App />` component into the DOM.
- **[frontend — `src/App.jsx`](./frontend-components-phase4.md)** is the root React component, orchestrating the dashboard layout (Header, PCGrid, modals).
- **[backend — `server.js`](./backend.md)** is the Node.js/Express server entry point. Loads `.env.development`, configures CORS and JSON middleware, registers health check at `/api/health`, connects to MongoDB via Mongoose, dynamically imports route modules, and listens on port 8080.
- **[backend — `seed.js`](./backend.md)** is the database seeding entry point. Run `node backend/seed.js` to populate MongoDB from `data.json`.
- **[backend — `test-gpu-cap.sh`](./backend.md)** and [`test-gpu-cap.js`](./backend.md) are GPU VRAM capacity validation integration tests.
- **Legacy `index.html` (REMOVED)** — The root `index.html` was the HTML entry point for the flat prototype. Deleted in commit `9724cfb`. See [where-is-my-model.md](./where-is-my-model.md) for context.

### Where are the external integrations?
- **[backend](./backend.md)** implements a full Express + MongoDB API server (Mongoose ODM, CORS middleware, dotenv). The server is operational with `server.js` as entry point, environment configuration in `.env.development`, Mongoose models in `models/`, and REST routes in `routes/`. Health endpoint available at `/api/health`. Seed the database via `seed.js`.
- **[docker](./docker.md)** — Docker Compose orchestration for the full stack (frontend, backend, mongo) with health checks, named volumes, and dependency-ordered startup.
- **[frontend](./frontend.md)** — Vite dev server with `/api` proxy to the backend. Production build served by nginx with security headers, gzip compression, and reverse proxy for `/api`.
- Google Fonts (JetBrains Mono + Spectral) loaded via `fonts.googleapis.com` with preconnect optimization for faster font delivery.
