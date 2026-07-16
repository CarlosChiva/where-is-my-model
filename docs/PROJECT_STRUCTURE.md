# Project Structure — where-is-my-model

## Architecture

```
where-is-my-model/
├── backend/                          # Express + Mongoose API
│   ├── .dockerignore
│   ├── .env.example                  # [NEW] Template with descriptions (no secrets)
│   ├── .env.development              # [MODIFIED] No secrets; loaded from external source
│   ├── Dockerfile                    # [MODIFIED] Non-root user, healthcheck
│   ├── config/                       # [NEW] Configuration directory
│   │   └── logger.js                 # [NEW] Pino logger configuration
│   ├── middleware/
│   │   ├── auth.js                   # [MODIFIED] Cookie-based token, refresh support
│   │   ├── auditLog.js               # [NEW] Critical action audit logging
│   │   ├── passwordValidator.js      # [NEW] Password strength validation
│   │   ├── rateLimit.js              # [NEW] Rate limiter configuration
│   │   ├── requestId.js              # [NEW] UUID request ID generation
│   │   ├── ssrfProtection.js         # [NEW] SSRF whitelist validation
│   │   ├── twoFactor.js              # [NEW] 2FA verification middleware
│   │   └── validation.js             # [MODIFIED] Input sanitization, transaction-aware GPU cap
│   ├── models/
│   │   ├── AuditLog.js               # [NEW] Audit trail model
│   │   ├── PC.js                     # [UNCHANGED] Multi-GPU schema
│   │   └── User.js                   # [MODIFIED] Email, 2FA fields, password complexity
│   ├── routes/
│   │   ├── auth.js                   # [MODIFIED] Cookie JWT, refresh tokens, 2FA endpoints
│   │   ├── health.js                 # [MODIFIED] SSRF-protected health checks
│   │   ├── pcs.js                    # [MODIFIED] Audit logging, transaction support
│   │   ├── services.js               # [MODIFIED] Audit logging, transaction support
│   │   └── verify.js                 # [NEW] Email verification routes
│   ├── seed-admin.js                 # [NEW] Initial admin seed from env vars
│   ├── server.js                     # [MODIFIED] Helmet, logger, request ID, cookie-parser, CORS credentials
│   ├── services/
│   │   ├── emailService.js           # [NEW] Nodemailer email sending
│   │   └── healthChecker.js          # [MODIFIED] SSRF protection, structured logging
│   ├── utils/
│   │   └── sanitize.js               # [NEW] Input sanitization utilities
│   ├── package.json                  # [MODIFIED] New security dependencies
│   └── package-lock.json
│
├── frontend/                         # React + Vite + Tailwind
│   ├── .dockerignore
│   ├── .env                          # [UNCHANGED] VITE_API_PROXY_TARGET=http://backend:8080
│   ├── .env.development              # [UNCHANGED] VITE_API_PROXY_TARGET=http://localhost:9003
│   ├── Dockerfile                    # [MODIFIED] Non-root user, healthcheck
│   ├── eslint.config.js              # [UNCHANGED]
│   ├── index.html                    # [UNCHANGED]
│   ├── nginx.conf                    # [MODIFIED] CSP, HSTS, Permissions-Policy, full security headers
│   ├── postcss.config.js             # [UNCHANGED]
│   ├── tailwind.config.js            # [UNCHANGED]
│   ├── vite.config.js                # [MODIFIED] Cookie credentials in proxy
│   ├── package.json                  # [UNCHANGED]
│   ├── package-lock.json
│   ├── public/icons.svg
│   └── src/
│       ├── main.jsx                  # [UNCHANGED]
│       ├── App.jsx                   # [UNCHANGED]
│       ├── index.css                 # [UNCHANGED]
│       ├── components/
│       │   ├── Header.jsx            # [UNCHANGED]
│       │   ├── PCGrid.jsx            # [UNCHANGED]
│       │   ├── PCCard.jsx            # [UNCHANGED]
│       │   ├── ServiceRow.jsx        # [UNCHANGED]
│       │   ├── GPUBar.jsx            # [UNCHANGED]
│       │   ├── GPUDetails.jsx        # [UNCHANGED]
│       │   ├── LoginPage.jsx         # [MODIFIED] Password strength indicator
│       │   ├── TwoFactorSetup.jsx    # [NEW] 2FA QR code setup
│       │   ├── TwoFactorVerify.jsx   # [NEW] TOTP code input
│       │   └── Modals/               # [UNCHANGED]
│       │   └── GpuCalculator/        # [UNCHANGED]
│       ├── context/
│       │   └── AuthContext.jsx       # [MODIFIED] Cookie-based auth, auto token refresh
│       ├── hooks/                    # [UNCHANGED]
│       ├── services/
│       │   ├── apiClient.js          # [MODIFIED] credentials: include, 401 refresh interceptor
│       │   ├── authApi.js            # [MODIFIED] Add refresh, 2FA endpoints
│       │   └── (rest unchanged)
│       └── utils/
│           ├── validators.js         # [MODIFIED] Password strength validator
│           └── (rest unchanged)
│
├── nginx/                            # [NEW] Production reverse proxy
│   ├── default.conf                  # [NEW] TLS termination, security headers, API routing
│   └── ssl/                          # [NEW] Certificate directory
│
├── backup/                           # [NEW] MongoDB backup automation
│   ├── Dockerfile                    # [NEW] mongodump container
│   └── backup.sh                     # [NEW] Backup script with rotation
│
├── docker-compose.yml                # [MODIFIED] Auth, healthchecks, secrets, nginx proxy, backup
├── docker-compose.backup.yml         # [NEW] Optional backup compose
├── data.json                         # [UNCHANGED]
├── .gitignore                        # [MODIFIED] Add backend/.env.*, .env.local
├── docs/                             # [UNCHANGED]
│   ├── REQUIREMENTS.md
│   ├── PROJECT_STRUCTURE.md
│   ├── FRAMEWORKS.md
│   ├── PROJECT_STATE.md
│   └── documentation/
│
└── LEGACY (unused by React build):
    ├── index.html
    ├── css/
    └── js/
```

## Data Flow
```
React UI (port 3000) → Vite proxy /api → Backend (port 8080, host 9003) → MongoDB (port 27017 internal)
```

## Data Model
- **PC**: `{ _id: ObjectId, nombre: String, ip: String, gpus: [{name, vram}], servicios: [Service] }`
- **Service** (embedded): `{ nombre: String, puerto: Number, gpu: Number, assignedGpu: Number }` (no `_id`)
- **Virtual field**: `gpuUsage` returns per-GPU utilization array
- **Validator**: Per-GPU capacity: `sum(services where assignedGpu===i).gpu <= gpus[i].vram`

## Security Architecture (Post-Implementation)

### Middleware Order (server.js)
```
CORS → Helmet → Rate Limit → cookie-parser → Request ID → Auth → Routes
```

### Token Flow
```
Login → access token (15min, cookie) + refresh token (7d, httpOnly cookie)
API call → 401 → auto-refresh → retry original request
```

### MongoDB
- Authentication enabled via `MONGO_INITDB_ROOT_USERNAME` / `MONGO_INITDB_ROOT_PASSWORD`
- Replica set for transactions (Task 19)
- Automated backups via mongodump (Task 16)

### Docker
- Non-root users in all containers
- Healthchecks on frontend, backend, MongoDB
- Nginx reverse proxy with TLS termination (production)

## High-Risk Files

| File | Risk | Reason |
|------|------|--------|
| `frontend/src/context/AuthContext.jsx` | **HIGH** | localStorage→cookie rewrite, StrictMode guard changes |
| `frontend/src/services/apiClient.js` | **HIGH** | credentials: include, 401 refresh interceptor |
| `backend/routes/auth.js` | **HIGH** | Cookie JWT, password validation, refresh, email, admin seed, 2FA |
| `backend/server.js` | **MEDIUM** | Multiple middleware additions, order-critical |
| `backend/middleware/validation.js` | **MEDIUM** | Transaction scope, input sanitization |
| `docker-compose.yml` | **MEDIUM** | New services, env vars, healthchecks, secrets |

## Architectural Risks

1. **MongoDB single-node → replica set** (Task 19): Breaking change for Docker Compose
2. **CORS + credentials conflict** (Task 6): `origin` cannot be `*` with `credentials: 'include'`
3. **Volume permissions** (Task 13): Non-root user conflicts with host-mounted volumes
4. **Git history contamination** (Task 2): JWT_SECRET in git history — requires `git filter-repo`
5. **API versioning blast radius** (Task 23): `/api/*` → `/api/v1/*` breaks all frontend calls