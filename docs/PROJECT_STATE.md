# PROJECT_STATE.md — Security Audit Implementation

**Project:** where-is-my-model
**Type:** Cybersecurity audit & hardening
**Date:** 2026-07-16
**Status:** Phase 1 COMPLETE, Phase 2 IN PROGRESS (12/25 tasks done)

This document tracks all 25 security hardening tasks identified during the cybersecurity audit of the `where-is-my-model` full-stack application (React 19 + Vite 8 frontend, Express 4 + Mongoose 8 backend, MongoDB 7, Docker Compose orchestration). Tasks are organized into four phases ordered by criticality and dependency chains.

---

## Phase 1: Foundation (Crítico)

These tasks address the most severe vulnerabilities that must be resolved before any other hardening work. They form the critical path's beginning.

```
Task 2 → Task 5 → Task 1    (secrets chain — sequential)
Task 4 → Task 3              (HTTP hardening chain — sequential)
```

- [x] **Task 2: Remove JWT_SECRET from repository**
  - Description: Generate a cryptographically strong JWT signing secret (minimum 64 characters, using `openssl rand -base64 48` or equivalent). Remove the hardcoded value `dev-secret-x7k9m2p4q8w1v5n3b6t0f-yJzRcAsDgHjKmL` from `backend/.env.development`. Add `JWT_SECRET` to a new `.env.example` template file with a placeholder value. Update all references to use `process.env.JWT_SECRET` with a startup-time validation that rejects empty or default values.
  - Files: `backend/.env.development`, `backend/.env.example` (new), `backend/server.js`
  - Dependencies: None
  - Priority: Crítico

- [x] **Task 5: Move .env files out of Git tracking**
  - Description: Add `.env.development` to `.gitignore` alongside the existing `.env` pattern. Create `backend/.env.example` with all required environment variable names (PORT, MONGODB_URI, CLIENT_URL, JWT_SECRET, JWT_EXPIRES_IN) using placeholder values and inline comments explaining each variable's purpose and format. Verify that no secrets remain in git history by checking `git log -p -- backend/.env.development`.
  - Files: `.gitignore`, `backend/.env.development`, `backend/.env.example` (new)
  - Dependencies: Task 2

- [x] **Task 1: Add MongoDB authentication**
  - Description: Enable MongoDB authentication by adding `MONGO_INITDB_ROOT_USERNAME` and `MONGO_INITDB_ROOT_PASSWORD` environment variables to the Compose mongo service. Update `MONGODB_URI` format from `mongodb://mongo:27017/where-is-my-model` to `mongodb://<username>:<password>@mongo:27017/where-is-my-model?authSource=admin`. Update `server.js` to construct the connection string from env vars. Add these new variables to `.env.example`. The mongo healthcheck must still work with auth enabled (use the credentials in the mongosh command).
  - Files: `docker-compose.yml`, `backend/.env.example`, `backend/server.js`
  - Dependencies: Task 5

- [x] **Task 4: Add Helmet.js security headers**
  - Description: Install `helmet@^8.0.0` as a backend dependency. Import and register `helmet()` middleware in `server.js` BEFORE `cors()` and `express.json()` middleware. This provides default security headers: Content-Security-Policy, X-Download-Options, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, and Strict-Transport-Security. Configure helmet with `crossOriginOpenerPolicy({ policy: 'same-origin' })` and disable the default X-XSS-Protection directive (deprecated in modern browsers, conflicts with CSP).
  - Files: `backend/server.js`, `backend/package.json`
  - Dependencies: None (parallel with Task 2→5→1 chain)

- [x] **Task 3: Add rate limiting** ✅ Verificado — ya implementado completamente
  - Description: Install `express-rate-limit@^7.5.0` as a backend dependency. Apply three separate rate limiters: (1) Global limiter: 100 requests/15 minutes per IP for all `/api/*` routes. (2) Auth-specific limiter: 5 login attempts per 15 minutes per IP on `POST /api/auth/login` and `POST /api/auth/register` to prevent brute-force attacks. (3) Health-check limiter: 10 requests per minute on `/api/check-health/*` to prevent abuse of outbound connections. Configure all limiters to return 429 status with a JSON error response matching the existing `{ success: false, message }` envelope. Register the global limiter in `server.js` after helmet and CORS but before route registration.
  - Files: `backend/server.js`, `backend/package.json`, `backend/middleware/rateLimit.js` (new)
  - Dependencies: Task 4
  - Verified: 2026-07-16 por coder-proposal — los 3 limiters activos, respuestas 429 correctas, pipeline middleware ordenado.

---

## Phase 2: Authentication Hardening (Alto)

These tasks strengthen the authentication layer, container security, input validation, and observability. They are organized into parallel groups that can be worked on simultaneously.

```
Group A: Task 6 → Task 14 → Task 21    (token security — sequential)
Group B: Task 13 → Task 11              (Docker security — sequential)
Group C: Task 9 → Task 12               (input/network — sequential)
Group D: Task 10+18 → Task 17           (observability — sequential)
Group E: Task 7 → Task 8                (infrastructure — sequential)
```

### Group A: Token Security

- [x] **Task 6: Switch JWT to httpOnly cookies** ✅ Verificado — misma política sameSite ambiente-aware, 'Strict' en producción y 'Lax' en desarrollo, AuthContext limpio sin token: null.
  - Description: Install `cookie-parser@^1.4.7` and register it in `server.js` before route handlers. Modify `routes/auth.js` login and register endpoints to set the JWT in an `httpOnly`, `secure`, `SameSite=Strict` cookie named `accessToken` instead of returning it in the JSON body. Set cookie domain to the backend host and path to `/api`. Update `middleware/auth.js` to check for the Bearer token in the Authorization header OR the `accessToken` cookie (support both during migration). Update `frontend/src/context/AuthContext.jsx` to stop reading/writing `localStorage['token']` and instead rely on cookie-based auth. Update `frontend/src/services/apiClient.js` to remove the `Authorization: Bearer` header injection from localStorage and add `credentials: 'include'` to all fetch calls. Configure the Vite dev server proxy to forward cookies.
  - Files: `backend/routes/auth.js`, `backend/routes/twoFactor.js`, `frontend/src/context/AuthContext.jsx`
  - Dependencies: None (starts Group A chain)
  - Verified: 2026-07-16 por coder-reviewer — mismaSite hardcoded 'strict' corregido a isProd ? 'Strict' : 'Lax' en auth.js y twoFactor.js (5 ubicaciones totales), AuthContext.Provider limpio sin token: null relic, compatibilidad confirmada con Task 14 (refresh tokens) y Task 21 (2FA), flujos de login/logout/refresh intactos.

- [x] **Task 14: Implement refresh token rotation** ✅ Verificado — arquitectura de dos tokens, rotación en login y /refresh, interceptor con circuit breaker, X-Session-Expired header.
  - Description: Implement a two-token architecture: short-lived access token (15 minutes) and long-lived refresh token (7 days). Generate a separate `JWT_REFRESH_SECRET` environment variable. On login/register, set both `accessToken` and `refreshToken` as httpOnly cookies. Create `POST /api/auth/refresh` endpoint that validates the refresh token cookie, checks it hasn't been revoked, issues a new access token, and rotates the refresh token (delete old, issue new). Add a `refreshTokens` MongoDB collection (or embedded array in User) to track active refresh tokens for revocation. Update `apiClient.js` with an interceptor: on 401 responses, automatically call `/api/auth/refresh` and retry the original request. If refresh also returns 401, trigger full logout. Update `middleware/auth.js` to return a custom `401` with `X-Session-Expired: true` header to distinguish expired tokens from invalid ones.
  - Files: `backend/routes/auth.js`, `backend/middleware/auth.js`, `backend/models/RefreshToken.js` (new), `backend/.env.example`, `frontend/src/services/apiClient.js`, `frontend/src/context/AuthContext.jsx`
  - Dependencies: Task 6
  - Verified: 2026-07-16 por coder-reviewer — dos tokens con secretos separados, rotación en login y /refresh, colección dedicada RefreshToken con índice compuesto, interceptor apiClient con circuit breaker y retry queue, header X-Session-Expired para distinguir expirado vs inválido, parseDurationToMs para consistencia JWT↔DB.

- [x] **Task 21: Add TOTP-based 2FA**
  - Description: Install `speakeasy@^2.0.0` for TOTP generation and verification. Add optional 2FA fields to the User model: `totpSecret` (String, sparse, select: false), `totpEnabled` (Boolean, default: false). Create endpoints: `POST /api/auth/2fa/setup` (generates secret, returns QR code data URI and manual entry code), `POST /api/auth/2fa/verify` (verifies a TOTP code against the stored secret, enables 2FA on success), `POST /api/auth/2fa/disable` (requires current password + valid TOTP code to disable). Modify login flow: if user has `totpEnabled: true`, return a `2FA_REQUIRED` status with a temporary session token; client then calls `/api/auth/2fa/verify` with the TOTP code to complete authentication and receive the full JWT. Add `GET /api/auth/2fa/status` to check if 2FA is enabled for the current user.
  - Files: `backend/models/User.js`, `backend/routes/auth.js`, `backend/routes/twoFactor.js` (new), `backend/server.js`, `backend/package.json`
  - Dependencies: Task 14

### Group B: Docker Security

- [x] **Task 13: Run containers as non-root user** ✅ Verificado — appgroup/appuser en backend y frontend dev stage, USER nginx en producción, chown/chmod para volumen mounts.
  - Description: Update both Dockerfiles to create and use a non-root user. Backend: add `RUN addgroup -S appgroup && adduser -S appuser -G appgroup` after dependency installation, then `USER appuser` before `CMD`. Ensure `/app` and all runtime directories are readable by the non-root user. Frontend: in the development stage, add the same non-root user pattern. In the production nginx stage, the nginx image already runs as `nginx` user by default — verify this is the case and add explicit `USER nginx` if needed. Update volume mount permissions so the non-root user can read source files. Test that both containers start successfully without root privileges.
  - Files: `backend/Dockerfile`, `frontend/Dockerfile`
  - Dependencies: None (starts Group B chain)

- [x] **Task 11: Add HEALTHCHECK instructions** ✅ Verificado — backend Node.js http probe en /api/health, frontend dev wget en :3000 y prod wget en :80, docker-compose depends_on con condition: service_healthy.
  - Description: Add `HEALTHCHECK` instructions to both Dockerfiles. Backend: `HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "require('http').get('http://localhost:8080/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"`. Frontend (development stage): `HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1` (using wget since Alpine includes it). Frontend (production stage): `HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1`. Update `docker-compose.yml` to add healthcheck dependencies: frontend depends on backend being healthy (not just started).
  - Files: `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml`
  - Dependencies: Task 13
  - Verified: 2026-07-18 por coder-reviewer — tres HEALTHCHECK con parámetros correctos (interval/timeout/start-period/retries), forma shell para wget con ||, backend probe usa Node.js http nativo, USER antes de HEALTHCHECK en las 3 etapas, docker-compose depends_on con condition: service_healthy consistente con patrón mongo→backend existente.

### Group C: Input/Network Security

- [x] **Task 9: Enforce password strength policy** ✅ Verificado — regex validator en 3 capas, minlength 8→12, indicador visual del lado cliente.
  - Description: Add server-side password strength validation in `routes/auth.js` for both `/register` and `/login` (password change if added later). Requirements: minimum 12 characters (increase from current 8), at least one uppercase letter, one lowercase letter, one digit, and one special character. Use a regex validator: `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{12,}$/`. Return specific, non-leaking error messages (e.g., "Password does not meet complexity requirements" rather than listing which rule failed). Add the same validation to the User model schema with a custom validator that runs before the pre-save bcrypt hook. Add a client-side password strength indicator in the registration form using the same regex rules.
  - Files: `backend/routes/auth.js`, `backend/models/User.js`, `frontend/src/components/RegisterModal.jsx` (or relevant registration form component)
  - Dependencies: None (starts Group C chain)

- [x] **Task 12: Add SSRF protection to health checker** ✅ Verificado — middleware ssrfProtection.js con denylist de 16 rangos CIDR, allowlist opcional vía env var, protección contra DNS rebinding, logging estructurado.
  - Description: Implement Server-Side Request Forgery protection in `services/healthChecker.js`. Before making any outbound TCP connection or HTTP fetch, validate the target host against an allowlist. Steps: (1) Resolve the hostname to an IP address using `dns.lookup()`. (2) Check if the resolved IP is in a blocked range: loopback (127.0.0.0/8), private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), link-local (169.254.0.0/16), and any other non-routable addresses. (3) Add an optional `HEALTH_CHECK_ALLOWED_NETWORKS` environment variable (comma-separated CIDR notation) that defines an explicit allowlist — if set, only IPs in these ranges are permitted. (4) Add DNS rebinding protection: resolve the IP immediately before connecting and re-verify it. (5) Log all blocked connection attempts with the target host, resolved IP, and reason. Wrap the validation in a reusable `middleware/ssrfProtection.js` module.
  - Files: `backend/services/healthChecker.js`, `backend/middleware/ssrfProtection.js` (new), `backend/.env.example`, `backend/package.json`
  - Dependencies: Task 9
  - Verified: 2026-07-16 por coder-reviewer — denylist correcto, allowlist opcional, DNS rebinding mitigated, logging completo, contract preservado.

### Group D: Observability

- [x] **Task 10: Replace console.log with structured logger (pino)** ✅ Verificado — todos los console.* migrados a pino en twoFactor.js (4×) y ssrfProtection.js (4×), archivo test-gpu-cap.js excluido correctamente, cero console.* restantes en código de aplicación.
  - Description: Install `pino@^9.5.0` as a backend dependency. Create a centralized logger configuration in `backend/utils/logger.js` using pino with: (1) Pretty print format in development (`NODE_ENV !== 'production'`), JSON format in production. (2) Minimum log level `info` in production, `debug` in development. (3) Redact sensitive fields: `password`, `token`, `accessToken`, `refreshToken`, `authorization`, `cookie`. (4) Include service name `where-is-my-model` and environment in every log line. Export a configured pino instance as the default export. Replace all `console.log`, `console.warn`, and `console.error` calls in `server.js`, `routes/auth.js`, `routes/health.js`, `routes/pcs.js`, `routes/services.js`, `routes/users.js`, and `services/healthChecker.js` with the structured logger (`logger.info`, `logger.warn`, `logger.error`).
  - Files: `backend/utils/logger.js` (new), `backend/server.js`, `backend/routes/auth.js`, `backend/routes/health.js`, `backend/routes/pcs.js`, `backend/routes/services.js`, `backend/routes/users.js`, `backend/services/healthChecker.js`, `backend/package.json`
  - Dependencies: None (starts Group D chain, parallel with Task 18)

- [x] **Task 18: Add HTTP request/response logging middleware** ✅ Verificado — pino-http con logger compartido, sanitizeUrl filtrando query params sensibles, route path en customSuccessObject/customErrorObject, middleware orden correcto.
  - Description: Install `pino-http@^10.0.0` as a backend dependency. Register pino-http as Express middleware in `server.js` after helmet and CORS but before routes. Configure it to: (1) Use the same pino instance from `utils/logger.js` for consistent log format. (2) Log request method, URL, status code, response time, and remote address. (3) Exclude sensitive query parameters from logged URLs. (4) Add a custom log formatter that includes the Express route path. (5) Set `autoCustomSerializers: true` to automatically serialize `req` and `res` objects. (6) In development, use `prettyPrint` transport for human-readable output. This replaces the need for manual `console.log` of request details in route handlers.
  - Files: `backend/server.js`, `backend/utils/logger.js`, `backend/package.json`
  - Dependencies: Task 10

- [x] **Task 17: Add Request ID tracking** ✅ Verificado — pino-http genReqId como única fuente de generación UUID, VALID_UUID_RE regex RFC 4122 en logger.js, middleware requestId.js echo del response header, fallback crypto.randomUUID(), requestId incluido en las 4 ramas del error handler.
  - Description: Implement unique request ID generation and propagation for distributed tracing. Create `middleware/requestId.js` that: (1) Generates a UUID v4 for each incoming request using the built-in `crypto.randomUUID()` API (Node 19.10+). (2) Checks for an existing `X-Request-ID` header first (for client-initiated IDs or upstream proxies). (3) Sets `req.id` on the request object for downstream middleware access. (4) Adds `X-Request-ID` to the response headers so clients can reference it in support requests. (5) Integrates with pino by adding the request ID to the logger's child bindings so every log line for that request includes the ID. Register this middleware in `server.js` after pino-http but before routes. Update all error handler responses to include the request ID in the JSON body.
  - Files: `backend/middleware/requestId.js` (new), `backend/server.js`, `backend/utils/logger.js`
  - Dependencies: Task 10, Task 18
  - Verified: 2026-07-18 por coder-reviewer — genReqId única fuente de ID, pino child bindings automáticos, middleware orden correcto post pino-http, fallback defensivo en requestId.js, todas 4 ramas error handler con requestId.

### Group E: Infrastructure

- [x] **Task 7: Add HTTPS/TLS termination** ✅ Verificado — nginx alpine service en docker-compose con TLS :443 + redirect HTTP→HTTPS :80, volúmenes :ro para nginx.conf y certs, depende de frontend/backend healthy, CORS con ambos orígenes https/http://localhost.
  - Description: Add an nginx reverse proxy service to `docker-compose.yml` that terminates TLS for both frontend and backend traffic. Create a new `nginx` service using `nginx:alpine` with a custom configuration that: (1) Listens on ports 443 (HTTPS) and 80 (HTTP→HTTPS redirect). (2) Uses self-signed certificates for development (generated via `openssl` in a build script) or accepts mounted certificate files for production. (3) Proxies `/` to the frontend service and `/api/*` to the backend service. (4) Adds `X-Forwarded-Proto: https` header so the backend knows the original protocol. Update the backend CORS configuration to accept the nginx proxy origin. Update the frontend Vite proxy target to point to the internal backend service. For production deployment, document the process of replacing self-signed certs with Let's Encrypt certificates.
  - Files: `docker-compose.yml`, `backend/.env.development`, `backend/.env.example`, `.gitignore`
  - Dependencies: None (starts Group E chain)
  - Verified: 2026-07-18 por coder-reviewer — nginx service correcta con image alpine, puertos 80/443, volúmenes :ro, depends_on con condition: service_healthy para frontend y backend, red app-network preservada, CLIENT_URL con ambos orígenes CORS, nginx/certs/ en .gitignore.

- [x] **Task 8: Add CSP and HSTS to nginx configuration** ✅ Verificado — 6 headers en nginx/nginx.conf (HSTS 1año+preload, CSP con Google Fonts, X-Frame, X-Content-Type, Referrer-Policy, Permissions-Policy), todos con `always`, frontend/nginx.conf sin HSTS (puerto 80 plano), X-XSS-Protection obsoleto eliminado, ubicación-level blocks repiten headers correctamente.
  - Description: Update the nginx reverse proxy configuration (from Task 7) to include strict security headers. Add: (1) `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` (HSTS with 1-year max-age). (2) `Content-Security-Policy` with a restrictive default: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' http://backend:8080; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`. (3) `X-Frame-Options: DENY`. (4) `X-Content-Type-Options: nosniff`. (5) `Referrer-Policy: strict-origin-when-cross-origin`. (6) `Permissions-Policy` header (see Task 25 for coordination). Ensure these headers are set at the nginx level so they apply to all responses, not just API responses. Update the frontend's inline nginx.conf (`frontend/nginx.conf`) with matching headers for consistency in standalone production deployments.
  - Files: `nginx/nginx.conf`, `frontend/nginx.conf`
  - Dependencies: Task 7

---

## Phase 3: Data Integrity (Medio)

These tasks ensure data consistency, recovery capabilities, and proper access control initialization. They must be executed sequentially.

```
Task 20 → Task 19 → Task 16 → Task 15
```

- [ ] **Task 20: Admin user seeding via environment variables**
  - Description: Create a startup seed script `backend/scripts/seedAdmin.js` that runs once on server startup. The script checks if any users exist in the database; if none exist, it creates an admin user using `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables. If users already exist, the script is a no-op. This replaces the "first-user-is-admin" pattern in `routes/auth.js` which is a security risk (anyone can register first and become admin). Add `ADMIN_USERNAME` and `ADMIN_PASSWORD` to `.env.example` with strong warnings that these must be set in production. The seed script should use bcryptjs directly (not the User model pre-save hook) to ensure the password is hashed even if the model hook is bypassed. Add the seed script as a pre-listen step in `server.js` before routes are registered.
  - Files: `backend/scripts/seedAdmin.js` (new), `backend/server.js`, `backend/routes/auth.js`, `backend/.env.example`
  - Dependencies: None (starts Phase 3 chain)

- [ ] **Task 19: Add Mongoose transactions for atomic operations**
  - Description: Wrap multi-step database operations in Mongoose transactions to ensure atomicity. Specifically: (1) PC creation with initial services: wrap `PC.create()` and any associated operations in a session. (2) Service addition to a PC: when adding a service that might trigger validation across multiple documents, use a transaction. (3) User role changes: when an admin changes a user's role, wrap the update in a transaction alongside any audit log entries (Task 22). (4) Bulk health check results: if storing health check results in the database, use transactions. Update `routes/pcs.js`, `routes/services.js`, and `routes/users.js` to use `mongoose.startSession()`, `session.withTransaction()`, and proper session cleanup. Add error handling that rolls back transactions on failure and returns appropriate error responses.
  - Files: `backend/routes/pcs.js`, `backend/routes/services.js`, `backend/routes/users.js`
  - Dependencies: Task 20

- [ ] **Task 16: Automated MongoDB backup script**
  - Description: Create a backup utility script `backend/scripts/backup.js` that uses `mongodump` to create timestamped backups of the MongoDB database. The script should: (1) Accept a backup directory path as a command-line argument or environment variable (`BACKUP_DIR`). (2) Create compressed (gzip) backups with timestamps in the filename format: `where-is-my-model-backup-YYYY-MM-DD-HHMMDD.gz`. (3) Retain only the last 7 daily backups (configurable via `BACKUP_RETENTION_DAYS`). (4) Log backup start, completion, and any errors using the structured logger (pino). (5) Return exit code 0 on success, 1 on failure. Add a `backup` npm script to `package.json`. Document how to set up a cron job or Docker Compose scheduled task to run backups daily. For production, recommend mounting a persistent volume for the backup directory.
  - Files: `backend/scripts/backup.js` (new), `backend/package.json`
  - Dependencies: Task 19

- [ ] **Task 15: Add email verification for user registration**
  - Description: Install `nodemailer@^6.9.0` for email delivery. Add an `email` field (String, sparse, unique) to the User model. Create a verification token system: when a user registers, generate a cryptographically random verification token (using `crypto.randomBytes(32).toString('hex')`) with a 24-hour expiry, stored in the User document as `emailVerificationToken` and `emailVerificationExpires`. Send a verification email containing a link to `GET /api/auth/verify-email?token=<token>`. The verification endpoint validates the token, marks `emailVerified: true`, and clears the token. Pending users with unverified emails should be auto-deleted after 7 days (add a cleanup cron or check on server startup). Add SMTP configuration environment variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`. Add a `POST /api/auth/resend-verification` endpoint with rate limiting (max 3 per hour per email).
  - Files: `backend/models/User.js`, `backend/routes/auth.js`, `backend/services/emailService.js` (new), `backend/.env.example`, `backend/package.json`
  - Dependencies: Task 16

---

## Phase 4: Compliance (Largo plazo)

These tasks address compliance, maintainability, and defense-in-depth. Most can be worked on in parallel once their dependencies are met.

```
Task 22 (depends on Task 17, Task 10/18)
Task 23 (independent)
Task 24 (depends on Task 10/18)
Task 25 (depends on Task 4)
```

- [ ] **Task 22: Implement audit logging**
  - Description: Create a comprehensive audit logging system that records all security-relevant events. Create an `AuditLog` Mongoose model with fields: `action` (enum: USER_LOGIN, USER_LOGOUT, USER_REGISTER, USER_ROLE_CHANGE, USER_DELETE, PC_CREATE, PC_UPDATE, PC_DELETE, SERVICE_CREATE, SERVICE_UPDATE, SERVICE_DELETE, HEALTH_CHECK, FAILED_LOGIN, TOKEN_REFRESH, TWO_FACTOR_ENABLE, TWO_FACTOR_DISABLE), `userId` (ObjectId, ref: User), `username` (String, denormalized for readability), `ipAddress` (String), `userAgent` (String), `requestId` (String), `timestamp` (Date, default: now), `metadata` (Mixed, for action-specific details like old/new role values, PC name, service name). Create `middleware/auditLogger.js` that wraps route handlers to automatically log actions. Manually add audit log entries in auth routes for login/logout/registration events. Create `GET /api/audit-logs` endpoint (admin-only) with pagination, date range filtering, and action filtering. Index the `AuditLog` collection on `timestamp` and `userId` for query performance.
  - Files: `backend/models/AuditLog.js` (new), `backend/middleware/auditLogger.js` (new), `backend/routes/auth.js`, `backend/routes/auditLogs.js` (new), `backend/server.js`
  - Dependencies: Task 17, Task 10, Task 18

- [ ] **Task 23: Add API versioning**
  - Description: Implement API versioning using URL path prefixes to ensure backward compatibility during future breaking changes. Update all route registrations in `server.js` to use `/api/v1/` prefix (e.g., `/api/v1/auth`, `/api/v1/pcs`, `/api/v1/users`, `/api/v1/check-health`). Update `frontend/src/services/apiClient.js` to prefix all requests with `/api/v1`. Create a deprecation policy: when a new version is released, the old version remains available for at least 6 months. Add a `X-API-Version` response header to all API responses indicating the version served. Add a middleware that returns a 410 Gone response for deprecated versions after their sunset date. Document the versioning strategy in `docs/API_VERSIONING.md`.
  - Files: `backend/server.js`, `backend/routes/auth.js`, `backend/routes/pcs.js`, `backend/routes/services.js`, `backend/routes/users.js`, `backend/routes/health.js`, `frontend/src/services/apiClient.js`
  - Dependencies: None

- [ ] **Task 24: Add input sanitization**
  - Description: Implement input sanitization across all user-facing inputs to prevent XSS, NoSQL injection, and prototype pollution attacks. (1) Install a sanitization utility (use built-in approaches or `validator` package) to trim, escape, and validate all string inputs. (2) Sanitize PC names, service names, and user input fields by stripping HTML tags and escaping special characters. (3) Protect against NoSQL injection by validating that object keys don't contain prototype pollution patterns (`__proto__`, `constructor`, `prototype`) and don't use MongoDB query operators (`$gt`, `$lt`, `$ne`, `$regex`, etc.) in user-controlled fields. (4) Create a `middleware/sanitization.js` module with reusable sanitization functions. (5) Apply sanitization in all route handlers that accept user input: `routes/auth.js`, `routes/pcs.js`, `routes/services.js`, `routes/users.js`. (6) Log all sanitization events (stripped characters, blocked patterns) using the structured logger for security monitoring.
  - Files: `backend/middleware/sanitization.js` (new), `backend/routes/auth.js`, `backend/routes/pcs.js`, `backend/routes/services.js`, `backend/routes/users.js`
  - Dependencies: Task 10, Task 18

- [ ] **Task 25: Add Permissions-Policy header**
  - Description: Configure the `Permissions-Policy` (formerly Feature-Policy) header to restrict browser features that the application doesn't use, reducing the attack surface if XSS were to occur. In the backend, configure Helmet.js (installed in Task 4) with the `permissionsPolicy` directive. Set restrictive defaults: `camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()`. Allow only features that are actually used: `fullscreen=(self)`, `picture-in-picture=()`. In the frontend nginx configuration (`frontend/nginx.conf`), add the same `Permissions-Policy` header. The policy should be: `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), fullscreen=(self)`.
  - Files: `backend/server.js`, `frontend/nginx.conf`
  - Dependencies: Task 4

---

## Dependencies Summary

### Critical Path
```
Task 2 → Task 5 → Task 1 → Task 4 → Task 6 → Task 14 → Task 13 → Task 11 → Task 10+18 → Task 17 → Task 22
```

### Parallel Execution Groups

| Group | Tasks | Can start after |
|-------|-------|-----------------|
| A — Token security | 6 → 14 → 21 | Task 4 complete |
| B — Docker security | 13 → 11 | Task 14 complete |
| C — Input/Network | 9 → 12 | Any time (independent) |
| D — Observability | 10+18 → 17 | Task 11 complete |
| E — Infrastructure | 7 → 8 | Any time (independent) |
| Phase 3 — Data | 20 → 19 → 16 → 15 | Phase 2 complete |
| Phase 4 — Compliance | 22, 23, 24, 25 | Respective dependencies met |

### Independent Tasks (no blockers)
- Task 7 (HTTPS/TLS) and Task 8 (CSP/HSTS) can start immediately
- Task 9 (Password strength) can start immediately
- Task 23 (API versioning) can start at any time

### Cross-Phase Dependencies
- Task 22 (Audit logging) requires Task 17 (Request ID) and Task 10/18 (Logger)
- Task 24 (Input sanitization) requires Task 10/18 (Logger)
- Task 25 (Permissions-Policy) requires Task 4 (Helmet.js)