# AGENTS.md — where-is-my-model

## Repo layout
- `frontend/` — React 19 + Vite 8 + Tailwind CSS 3.4 (ESM)
- `backend/` — Express 4 + Mongoose 8 + MongoDB 7 (ESM)
- No TypeScript, no test suite, no CI.

## How to run
```bash
docker compose up --build
```
Three services on `app-network`:
| Service   | Container port | Host port | Notes                          |
|-----------|---------------|-----------|--------------------------------|
| frontend  | 3000          | 3000      | Vite dev, HMR via volume mount |
| backend   | 8080          | 9003      | Express API                    |
| mongo     | 27017         | (none)    | Internal only                  |

Frontend proxy target differs by environment:
- In Docker: `VITE_API_PROXY_TARGET=http://backend:8080` -> resolves via Compose DNS.
- Local dev: `.env.development` sets `http://localhost:9003` (the host-mapped backend port).

## Commands per package
```bash
# Frontend
cd frontend && npm run dev       # Vite dev server (--host required inside container)
cd frontend && npm run build     # Production build -> dist/
cd frontend && npm run lint      # ESLint (flat config, eslint.config.js)
cd frontend && npm run preview   # Serve production dist locally

# Backend
cd backend && npm start          # node server.js
cd backend && npm run seed       # Load sample data from seed.js
```
No test or typecheck commands exist. Lint is frontend only (`npm run lint`).

## Architecture notes
- **Entry points**: `frontend/src/main.jsx` -> `App.jsx`; `backend/server.js`.
- **Route order matters**: `/api/pcs/:pcId/services` is registered BEFORE `/api/pcs` to avoid Express matching `:id` against a real `pcId`. See `backend/server.js:42`.
- **API proxy**: Frontend requests hit `/api/*`, Vite proxies to backend at runtime via env var. No hardcoded URLs in fetch calls — all go through `frontend/src/services/apiClient.js` which prefixes with `/api`.
- **Response shape**: `apiClient._request()` returns `{ data, error }`. Hooks and components must check `result.error` not catch exceptions.

## Data model (changed for multi-GPU)
PC schema has changed from a single `vram: Number` to:
```js
gpus: [{ name: String, vram: Number }]    // at least 1 required
servicios: [Service]                      // embedded subdocs, no _id
```
Each service has `assignedGpu` (0-based index into `pc.gpus`). Per-GPU cap validator ensures `sum(svc.gpu where assignedGpu===i) <= gpus[i].vram`. Virtual field `gpuUsage` returns utilization breakdown per GPU. See `backend/models/PC.js:81-147`.

## env files
- `backend/.env.development` — loaded explicitly in `server.js`. Contains `MONGODB_URI=mongodb://mongo:27017/...` (works only inside Docker Compose where `mongo` host resolves).
- `.gitignore` excludes `.env`, `node_modules/`, `dist/`, and `.agents/`.

## Gotchas
1. Running `npm start` locally without MongoDB will crash — the server exits on connection failure.
2. `backend/.env.development` points `MONGODB_URI` at `mongo:27017` which only resolves inside Compose. For native local dev you need a separate `.env` with `localhost`.
3. Frontend Dockerfile CMD appends `--host` to the Vite dev command — required so Vite binds 0.0.0.0 instead of localhost inside containers.
4. `frontend/src/utils/calculatorEngine.js` and `gpuHelpers.js` are pure functions reused by both the dashboard GPU bars and the calculator page.

## Context

To get context about code of this repo, read mainly index and follow the markdown files to search about context of each service, folders and components about this project [Index documentation](docs/documentation/index.md)