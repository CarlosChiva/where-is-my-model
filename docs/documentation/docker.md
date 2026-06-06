# Docker Compose Orchestration

> Path: `/home/boreal/Downloads/where-is-my-model/docker-compose.yml`
> Last updated: 2026-06-04
> Type: Leaf file

Docker Compose configuration that orchestrates the three services of the GPU Infrastructure Dashboard: a Vite-based React frontend, an Express + Mongoose backend API, and a MongoDB 7 database. All services share a dedicated bridge network (`app-network`) with health-check-gated dependency ordering and named volumes for persistent data.

---

## 📐 Overall Structure

| Key | Value |
|-----|-------|
| Docker Compose version | `"3.9"` |
| Services | `frontend`, `backend`, `mongo` |
| Network | `app-network` (bridge driver) |
| Volumes | `mongo-data` (named, for MongoDB persistence) |
| Environment config | `backend/.env.development` loaded via `env_file` |

---

## 🐳 Services

### `frontend` — Vite Development Server

- **Build context:** `./frontend`
- **Build target:** `development` (multi-stage Dockerfile selects the development stage)
- **Port mapping:** `3000:3000` — dev server exposed on host port 3000
- **Environment variables:**
  - `VITE_API_PROXY_TARGET=http://backend:8080` — tells the Vite dev server to proxy `/api` requests to the backend container (resolves conflicts with local `.env.development` proxy settings when running inside Docker)
- **Volumes:**
  - `./frontend:/app` — host source mounted into the container for live HMR reload
  - `/app/node_modules` — anonymous volume to prevent host `node_modules` from shadowing container ones
- **Dependencies:** `backend` (waits for backend container to be running)
- **Network:** `app-network`

> **Purpose:** Serves the React application built with Vite. Hot Module Replacement (HMR) enables instant reflection of code changes without full page reloads.

---

### `backend` — Express + Mongoose API Server

- **Build context:** `./backend`
- **Build target:** default (uses the final stage of the Dockerfile)
- **Port mapping:** `9003:8080` — API exposed on host port 9003 (internal container port 8080)
- **Environment file:** `./backend/.env.development`
- **Volumes:**
  - `./backend:/app` — host source mounted for live reload during development
  - `/app/node_modules` — anonymous volume for node_modules isolation
- **Dependencies:** `mongo` with `condition: service_healthy` — does not start until MongoDB passes its health check
- **Network:** `app-network`

> **Purpose:** Provides the REST API (`/api/pcs`, `/api/services`, `/api/health`) that the frontend proxies to via Vite's `/api` dev-server proxy rule.

---

### `mongo` — MongoDB 7 Database

- **Image:** `mongo:7`
- **Port mapping:** none (container only, accessed internally via `app-network`)
- **Volumes:**
  - `mongo-data:/data/db` — named volume persisting MongoDB data across container restarts
- **Health check:**
  - **Test:** `mongosh --eval db.adminCommand('ping')`
  - **Interval:** 10 seconds
  - **Timeout:** 5 seconds
  - **Retries:** 5
  - **Start period:** 10 seconds
- **Network:** `app-network`

> **Purpose:** Persistent document store for GPU server and service metadata. No host port is exposed — all access occurs through the backend service on the internal bridge network.

---

## 🌐 Networking

All services are attached to a single bridge network named **`app-network`**.

| Property | Value |
|----------|-------|
| Name | `app-network` |
| Driver | `bridge` |

### DNS Resolution on the Network

- `frontend` resolves `backend` → reaches the Express API
- `backend` resolves `mongo` → connects to MongoDB via `mongodb://mongo:27017` (or equivalent connection string from `.env.development`)
- `frontend` resolves `backend` → the Vite dev proxy (`/api`) forwards requests to `http://backend:8080`

No service ports are exposed to the host except `frontend:3000` and `backend:9003`. MongoDB (`27017`) is accessible only internally.

---

## 💾 Volumes

| Volume Name | Mount Point | Purpose |
|-------------|-------------|---------|
| `mongo-data` | `/data/db` (inside `mongo` container) | Persistent MongoDB storage. Survives container recreation. |

### Anonymous Volumes

The `/app/node_modules` mounts in `frontend` and `backend` are anonymous Docker volumes. They prevent the host's `node_modules` directory from being mounted over the container's `node_modules`, which can cause permission issues and prevent `npm install` from working correctly inside the container.

---

## 🏥 Dependency Chain

```
mongo (health check)
  ↑ depends_on [condition: service_healthy]
backend
  ↑ depends_on [simple]
frontend
```

1. **mongo** starts first. Its health check runs every 10s until `mongosh ping` succeeds.
2. **backend** waits for mongo to be healthy, then starts, loading `.env.development` and connecting to MongoDB.
3. **frontend** waits for backend to be running, then starts the Vite dev server on port 3000.

---

## 🚀 Usage

### Start all services

```bash
docker compose up
```

### Start with detached mode and rebuild

```bash
docker compose up --build -d
```

### Stop all services

```bash
docker compose down
```

### Stop and remove volumes (⚠️ destroys MongoDB data)

```bash
docker compose down -v
```

### View logs

```bash
docker compose logs -f
```

### View logs for a specific service

```bash
docker compose logs -f backend
```

---

## 🔄 Changes in this update

- **Added** `VITE_API_PROXY_TARGET=http://backend:8080` environment variable to the `frontend` service — ensures the Vite proxy running inside the container correctly points to the backend service by hostname, avoiding conflicts with the host's `.env.development` proxy configuration.
- **Updated** backend service port mapping from `8080:8080` to `9003:8080` — resolves "address already in use" conflict on host port 8080. Internal container port remains 8080; all inter-service communication (frontend → backend via Vite proxy, backend → mongo via Mongoose) uses the internal Docker bridge network `app-network` and is unaffected.
- **Updated** networking section to reflect `backend:9003` as the external host port.
- **Added** `docker.md` — full documentation of `docker-compose.yml`: the three services (frontend, backend, mongo), shared bridge network `app-network`, health checks, named volume `mongo-data`, dependency ordering, and usage commands.
