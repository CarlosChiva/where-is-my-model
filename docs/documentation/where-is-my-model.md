# `where-is-my-model`

> Path: `/home/boreal/Downloads/where-is-my-model/`
> Last updated: 2026-06-04
> Type: Composite folder

Root directory of the project. Contains the primary data file (`data.json`) that stores the distributed GPU infrastructure configuration, Docker Compose orchestration (`docker-compose.yml`), and project documentation. The legacy flat HTML/CSS/JS prototype (`index.html`, `css/`, `js/`) was removed in commit `9724cfb` (Task T15). The active frontend is the React + Vite application in `frontend/`.

---

## 📁 Subfolders

| Folder | Documentation | Description |
|--------|--------------|-------------|
| `.agents/` | — | Agent skill configurations and tooling metadata. |
| `css/` | [see docs](./where-is-my-model/css.md) | **REMOVED** — Legacy CSS partials for the flat HTML prototype. No longer present in the repository. |
| `js/` | [see docs](./where-is-my-model/js.md) | **REMOVED** — Legacy vanilla JavaScript modules. No longer present in the repository. |
| `docs/` | — | Project documentation (requirements, project structure, frameworks, state). |
| `backend/` | [see docs](./where-is-my-model/backend.md) | Express API server with MongoDB backend. |
| `frontend/` | [see docs](./where-is-my-model/frontend.md) | React + Vite frontend application (active). |

---

## 📄 Direct files

### `docker-compose.yml`

[see docs](./docker.md) — Docker Compose orchestration defining three services (frontend on port 3000, backend on port 9003 externally / 8080 internally, mongo), shared bridge network `app-network`, health checks, and named volume `mongo-data` for persistence.

### `data.json`

Sample infrastructure data file defining the distributed GPU server fleet and the AI/ML services running on each. Consumed by the backend seed script and, historically, by the legacy frontend prototype.

#### Schema

The file uses a dictionary-keyed nested structure rather than flat property arrays. Dynamic string keys serve as identifiers for servers and services.

**Top-level structure:**

| Key | Type | Description |
|-----|------|-------------|
| `pc` | `Array[Object]` | Array of server objects. Each element is a dictionary with exactly one key-value pair. |

**Server object (each element of `pc`):**

The key is the server identifier (e.g., `"server-gpu-01"`). The value contains:

| Field | Type | Description |
|-------|------|-------------|
| `nombre` | `string` | Human-readable server name including GPU model and cluster designation. |
| `ip` | `string` | IPv4 address of the server. |
| `servicios` | `Array[Object]` | Array of service objects running on this server. Each element is a dictionary with exactly one key-value pair. |

**Service object (each element of `servicios`):**

The key is the service identifier (e.g., `"tensorflow-training"`). The value contains:

| Field | Type | Description |
|-------|------|-------------|
| `nombre-servicio` | `string` | Human-readable service name. |
| `puerto` | `number` | Network port the service listens on. |
| `tamaño-de-servicio-en-gpu` | `number` | GPU VRAM consumption percentage used by this service. |

#### Data Inventory

Contains 3 GPU servers with a total of 8 services:

| Server ID | nombre | IP | Services |
|-----------|--------|----|----------|
| `server-gpu-01` | NVIDIA RTX 4090 — Cluster Alpha | `192.168.1.101` | tensorflow-training (35%), pytorch-inference (28%), tensorboard-monitor (3%) — **total: 66%** |
| `server-gpu-02` | NVIDIA A100 — Cluster Beta | `10.0.30.55` | llm-finetuning (60%), vram-dashboard (12%) — **total: 72%** |
| `server-gpu-03` | NVIDIA T4 — Edge Node | `172.16.10.200` | stable-diffusion-api (40%), whisper-asr (25%), ngrok-tunnel (2%) — **total: 67%** |

#### Usage in Application

1. **Backend seeding:** `backend/seed.js` reads `data.json` to populate MongoDB on first run.
2. **Legacy frontend (removed):** The deleted `js/data.js` used to attempt `fetch('data.json')` on application startup. On failure, fell back to inline bundled data.

---

## 🔄 Changes in this update

- **Removed** `index.html` documentation — the legacy flat HTML prototype entry point was deleted (Task T15, commit `9724cfb`). The complete structural breakdown (header, main, three dialogs, resource loading, accessibility features) is no longer applicable.
- **Updated** `css/` and `js/` subfolder references — both marked as **REMOVED** with links to their historical documentation stubs.
- **Updated** general description to clarify that the active frontend is the React + Vite application in `frontend/`.
- **Updated** `data.json` usage section — removed references to the legacy frontend loading mechanism; retained backend seed script reference.
- **Added** `backend/` and `frontend/` to the subfolder table for completeness.
