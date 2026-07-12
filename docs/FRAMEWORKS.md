# Frameworks — where-is-my-model

## Technologies

| Category | Technology | Version | Status |
|----------|-----------|---------|--------|
| Frontend Framework | React | 19.2.6 | ✅ In use |
| Frontend DOM | React DOM | 19.2.6 | ✅ In use |
| Build Tool | Vite | 8.0.12 | ✅ In use |
| Vite Plugin | @vitejs/plugin-react | 6.0.1 | ✅ In use |
| CSS Framework | Tailwind CSS | 3.4.19 | ✅ In use |
| PostCSS | postcss | 8.5.15 | ✅ In use |
| Autoprefixer | autoprefixer | 10.5.0 | ✅ In use |
| Linter | ESLint | 10.3.0 (flat config) | ✅ In use |
| ESLint Plugin | eslint-plugin-react-hooks | 7.1.1 | ✅ In use |
| ESLint Plugin | eslint-plugin-react-refresh | 0.5.2 | ✅ In use |
| Backend Framework | Express.js | 4.21.0 | ✅ In use |
| ODM | Mongoose | 8.9.0 | ✅ In use |
| CORS Middleware | cors | 2.8.5 | ✅ In use |
| Env Loader | dotenv | 16.4.0 | ✅ In use |
| Database | MongoDB | 7.x | ✅ In use |
| Containerization | Docker + Docker Compose | v3.9 | ✅ In use |
| Production Web Server | Nginx Alpine | — | ✅ Configured |
| Fonts | Google Fonts | Spectral + JetBrains Mono | ✅ Loaded |

## API Endpoints

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| `GET` | `/api/health` | Health check | ✅ |
| `POST` | `/api/auth/register` | Register new user (1st = admin) | ✅ |
| `POST` | `/api/auth/login` | Login → returns JWT | ✅ |
| `GET` | `/api/auth/me` | Current user profile (JWT decoded) | ✅ |
| `GET` | `/api/pcs` | List all PCs | ✅ |
| `GET` | `/api/pcs/:id` | Get single PC | ✅ |
| `POST` | `/api/pcs` | Create PC | ✅ |
| `PUT` | `/api/pcs/:id` | Update PC | ✅ |
| `DELETE` | `/api/pcs/:id` | Delete PC | ✅ |
| `GET` | `/api/pcs/:pcId/services` | List PC services | ✅ |
| `POST` | `/api/pcs/:pcId/services` | Add service to PC | ✅ |
| `PUT` | `/api/pcs/:pcId/services/:index` | Update service | ✅ |
| `DELETE` | `/api/pcs/:pcId/services/:index` | Delete service | ✅ |
| `POST` | `/api/check-health/pcs/:pcId` | Check all services health for a single PC (TCP) | 🔄 In progress |
| `POST` | `/api/check-health/all` | Check all services health across all PCs (TCP) | 🔄 In progress |
| `GET` | `/api/auth/users` | List all users (admin-only, no passwords) | ✅ Implemented |
| `PUT` | `/api/auth/users/:userId/role` | Update user role (admin↔user↔pending, admin-only) | 🔄 In progress |
| `DELETE` | `/api/auth/users/:userId` | Delete user with last-admin safeguard (admin-only) | 🔜 Planned |

## Auth Infrastructure

### JWT Structure
```js
{ userId: String, username: String, role: 'admin'|'user'|'pending' }
```
Signed with `JWT_SECRET`. Stored in `localStorage['token']` on frontend. Pending users never receive a JWT token.

### Middleware (`backend/middleware/auth.js`)
- **`authMiddleware`**: Verifies Bearer token, sets `req.user = decoded_payload`
- **`requireAdmin`**: Checks `req.user.role === 'admin'`, returns 403 if not admin

### Token Storage (Frontend)
- JWT stored in `localStorage` under key `'token'`
- `AuthContext.jsx` wraps `<App />` providing: `user`, `token`, `isAuthenticated`, `isLoading`, `login()`, `register()`, `logout()`
- On mount: checks localStorage token → calls `GET /auth/me` to validate

### Route Protection Pattern
| Operation type | Middleware |
|---|---|
| Read (GET) | `authMiddleware` only |
| Write (POST/PUT/DELETE) | `authMiddleware, requireAdmin` |

## GPU Color Thresholds

| Tier | Percentage | Tailwind Class | Hex Color |
|------|-----------|---------------|-----------|
| Low | ≤ 35% | `bg-gpu-green` | `#3fb950` |
| Mid | 36–70% | `bg-gpu-yellow` | `#d29922` |
| High | > 70% | `bg-gpu-red` | `#f85149` |
| Warning pulse | > 80% | `animate-gpu-warning` | Red box-shadow pulse |

## Docker Services

| Service | Container Port | Host Port | Purpose |
|---------|---------------|-----------|---------|
| Frontend | 3000 | 3000 | Vite dev server with HMR |
| Backend | 8080 | 9003 | Express API |
| MongoDB | 27017 | (internal) | Document store |

## Data Model Changes (Multi-GPU Feature)

### Current → New

| Field | Old Shape | New Shape |
|-------|-----------|-----------|
| PC.vram | `Number` (single scalar) | REMOVED — replaced by `gpus[]` |
| PC.gpus | (doesn't exist) | `[ { name: String, vram: Number } ]` |
| Service.gpu | `Number` (VRAM consumption) | `Number` (unchanged) |
| Service.assignedGpu | (doesn't exist) | `Number` (0-based index into PC.gpus array) |

### Virtual Fields

| Virtual | Old Behavior | New Behavior |
|---------|-------------|--------------|
| totalGpu | `sum(servicios[].gpu)` → single number | REMOVED |
| gpuUsage | (doesn't exist) | Returns array: `[{gpuIndex, name, totalVram, usedVram}]` |

### Validators

| Validator | Old Logic | New Logic |
|-----------|-----------|-----------|
| GPU capacity | `sum(all services.gpu) <= pc.vram` | Per-GPU: `sum(services where assignedGpu===i).gpu <= gpus[i].vram` |

## Environment Variables

**Backend** (`.env.development`):
- `NODE_ENV=development`
- `PORT=8080`
- `MONGODB_URI=mongodb://mongo:27017/where-is-my-model`
- `CLIENT_URL=http://localhost:3000`

**Frontend** (`.env` for Docker):
- `VITE_API_PROXY_TARGET=http://backend:8080`

**Frontend** (`.env.development` for local):
- `VITE_API_PROXY_TARGET=http://localhost:9003`
