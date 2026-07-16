# `middleware`

> Path: `backend/middleware/`
> Last updated: 2026-07-16
> Type: Leaf folder

Request validation middleware for the Express backend. Provides middleware functions used as route handlers on PC creation/update and service creation/update endpoints. All validators follow a collect-all-errors pattern (rather than fail-fast) and return a single 400 response with an `errors` array when validation fails. A legacy fallback auto-transforms a scalar `vram` field into the new `gpus` array format for backward compatibility. Also includes rate-limiting middleware via `express-rate-limit` v7 to protect against abuse — three distinct limiters target the global API surface, authentication endpoints, and health-check probes respectively.

---

## 📄 `validation.js`

Contains request-body validation middleware functions for PC and Service routes, plus helpers for extracting route parameters from nested Express routers.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `../models/PC.js` | `PC` (default) | Internal |

### Functions

- **`fieldError(field: string, detail: string) → string`**
  Helper that formats a single validation error message as `"{field}: {detail}"`.
  - `field`: The name of the field that failed validation (e.g., `'nombre'`, `'gpus[0].name'`).
  - `detail`: A human-readable explanation of what went wrong.
  - **Returns:** A formatted error string combining the field and detail, separated by a colon.

- **`validatePcBody(req: Request, res: Response, next: NextFunction) → void | Response`**
  Validation middleware used on `POST /api/pcs` and `PUT /api/pcs/:id`. Collects all validation errors across fields and returns them in a single 400 response. Validates three groups of fields:
  - **`nombre`**: Must be a non-empty string.
  - **`ip`**: Must be a valid IPv4 address (each octet between 0–255).
  - **`gpus`**: Must be a non-empty array of GPU objects, each with a non-empty string `name` and a positive number `vram`. All errors across all GPU entries are collected (not just the first failure).
  - **Legacy fallback**: If the request body contains a scalar `vram` instead of a `gpus` array, it is automatically transformed to `[{ name: "GPU 1", vram: <value> }]` before validation. This supports backward compatibility with older clients.
  - **Returns:** nothing; calls `next()` on success or returns `res.status(400).json({ success: false, errors })` with a collected array of error strings on failure.

- **`extractPcId(req: Request) → string | null`**
  Internal helper for routes mounted under `/api/pcs/:pcId` using sub-routers. When Express uses `app.use('/path/:id', router)`, the mount-point parameters (`:pcId`) are stripped from `req.params` inside the sub-router. This function extracts `pcId` by matching against `req.baseUrl`. Falls back to checking `req.params.pciId` and `req.params[':pciId']` for edge cases.
  - `req`: The Express request object.
  - **Returns:** The parsed `pcId` string, or `null` if not found.

- **`validateServiceBody(req: Request, res: Response, next: NextFunction) → void | Response`** *(async)*
  Validation middleware used on `POST /api/pcs/:pcId/services`. Validates four fields and enforces a **per-GPU VRAM-cap** by performing an asynchronous MongoDB lookup of the parent PC. Supports Multi-GPU architecture: each service is assigned to one of the PC's GPUs via the `assignedGpu` index, and only that GPU's individual VRAM is checked against capacity.
  - **`nombre`**: Must be a non-empty string.
  - **`puerto`**: Must be an integer between 1 and 65535.
  - **`gpu`**: Must be a number >= 0. If it passes basic validation, checks that adding this `gpu` value to the **target GPU's** existing allocation does not exceed the target GPU's individual VRAM (i.e., `pc.gpus[assignedGpu].vram`). Uses `pc.servicios.filter(svc => svc.assignedGpu === assignedGpu)` to sum only services on the same GPU.
  - **`assignedGpu`**: New field for Multi-GPU support. Must be a non-negative integer that is a valid index into `pc.gpus[]`. If omitted: defaults to `0` when the PC has exactly one GPU; required (returns error) when the PC has multiple GPUs. Resolved value is stored back on `req.body.assignedGpu` for downstream route handlers.
  - If the parent PC is not found in the database, returns 404. If the database lookup throws, returns 500.
  - **Returns:** nothing; calls `next()` on success or returns an appropriate HTTP response (400/404/500) on failure.

- **`validateServiceUpdate(req: Request, res: Response, next: NextFunction) → void | Response`** *(async)*
  Validation middleware used on `PUT /api/pcs/:pcId/services/:serviceIndex`. Performs partial-update-aware validation (each field is only validated if present in the request body). Fully rewritten to support **Multi-GPU architecture**: performs per-GPU capacity accounting that subtracts the existing service's allocation from its current GPU, adds the new allocation to the target GPU, and handles cross-GPU reassignment by independently verifying both source and target GPU capacities.
  - **Lookup**: Fetches the parent PC via `extractPcId(req)`. Parses `req.params.serviceIndex` to locate the specific service within `pc.servicios[ index ]`. Returns 404 if either lookup fails. Stores `existingService.assignedGpu` as `currentGpuIndex` for use in capacity projections.
  - **`nombre`** (only if present in body): Must be a non-empty string.
  - **`puerto`** (only if present in body): Must be an integer between 1 and 65535.
  - **`assignedGpu`** (only if present in body): Must be a non-negative integer that is a valid index into `pc.gpus[]`. If the index is out of range, validation fails with an error listing the valid range (`0–<n-1>`).
  - **`gpu`** (only if present in body): Must be a number >= 0. Enforces **per-GPU VRAM-cap** through a three-step projection:
    1. **Source GPU (old assignment)**: Computes `sourceProjected = sourceGpuUsed - existingService.gpu`. Verifies this is non-negative (consistency guard) and does not exceed the source GPU's individual VRAM cap (`pc.gpus[currentGpuIndex].vram`). The latter catches concurrent-update races where another service pushed the source over its limit.
    2. **Target GPU (new assignment)**: If `targetGpuIndex === currentGpuIndex` (same GPU), computes `targetProjected = sourceProjected + newGpu`. If cross-GPU (`targetGpuIndex !== currentGpuIndex`), queries `pc.servicios.filter(svc => svc.assignedGpu === targetGpuIndex)` to get the target's existing usage, then computes `targetProjected = targetGpuUsed + newGpu`. Verifies against `pc.gpus[targetGpuIndex].vram`.
    3. All three checks (source non-negative, target cap, source cap) are collected into the errors array rather than failing fast.
  - **`assignedGpu`-only change** (body contains `assignedGpu` but not `gpu`): Performs a VRAM-cap check on the target GPU using the service's *existing* `gpu` value. If the projected usage would exceed the target GPU's VRAM, returns an error with a breakdown of free space vs. needed space.
  - **Resolved `assignedGpu`**: When present in the body, the validated `rawAssignedGpu` value is stored on `req.body.assignedGpu` for downstream route handlers.
  - If the parent PC is not found in the database, returns 404. If the database lookup throws, returns 500.
  - **Returns:** nothing; calls `next()` on success or returns an appropriate HTTP response (400/404/500) on failure.

---

## 📄 `auth.js`

JWT-based authentication and authorization middleware. Provides two functions: `authMiddleware`, a generic Bearer-token verifier that decodes the JWT and attaches the payload to `req.user`; and `requireAdmin`, an optional role-gate that enforces `role === 'admin'`. Both return appropriate 4xx status codes on failure (401 for authentication errors, 403 for authorization errors). Neither function reads from or writes to MongoDB — they operate entirely on the token payload.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `jsonwebtoken` | `jwt` (default) | External |

### Functions

- **`authMiddleware(req: Request, res: Response, next: NextFunction) → void | Response`**
  Verifies a Bearer token in the `Authorization` header, decodes it, and attaches the payload to `req.user`. Returns 401 on any authentication failure. The function proceeds through three validation stages:
  - **Header presence**: If `req.headers.authorization` is absent or falsy, returns 401 with `'Access denied. No token provided.'`
  - **Bearer format**: Splits the header by space and verifies it has exactly two parts with the first part equal to `'Bearer'`. Returns 401 with `'Access denied. Invalid token format.'` on mismatch.
  - **Token verification**: Calls `jwt.verify(token, process.env.JWT_SECRET)` inside a try/catch. On success, assigns `req.user = decoded` (the payload contains `userId`, `username`, and `role`) and calls `next()`. Catches three distinct error types:
    - `jwt.JsonWebTokenError` → 401 with `'Access denied. Invalid token.'`
    - `jwt.TokenExpiredError` → 401 with `'Access denied. Token expired.'`
    - Any other error → 401 with `'Access denied. Token verification failed.'`

- **`requireAdmin(req: Request, res: Response, next: NextFunction) → void | Response`**
  Role-based authorization middleware intended to be chained *after* `authMiddleware`. Assumes `req.user` is already populated by upstream auth middleware. Checks that `req.user.role === 'admin'`. If the check passes, calls `next()`. Otherwise returns 403 with `'Admin access required.'`.

## 🔄 Changes in this update

- **T03 — Multi-GPU architecture support in `validateServiceBody`:** The middleware was completely rewritten to validate a new `assignedGpu` field. It accepts a non-negative integer representing a valid index into the parent PC's `gpus[]` array. When omitted and the PC has exactly one GPU, it defaults to index 0. When the PC has multiple GPUs and `assignedGpu` is omitted, validation fails with an error. VRAM capacity enforcement now checks **per-GPU** limits (`pc.gpus[assignedGpu].vram`) instead of a global cap (`pc.vram`). The resolved `assignedGpu` value is stored on `req.body` for downstream route handlers to use.
- **T04 — Multi-GPU architecture support in `validateServiceUpdate`:** The `validateServiceUpdate` function was completely rewritten to mirror the Multi-GPU capabilities of `validateServiceBody`. New behavior includes: (1) validates optional `assignedGpu` field for type (non-negative integer) and range against `pc.gpus`; (2) tracks `currentGpuIndex` from the existing service record; (3) performs per-GPU capacity accounting — subtracts old allocation from source GPU, adds new allocation to target GPU; (4) handles cross-GPU reassignment by independently verifying both source GPU (freed capacity must remain non-negative and under cap to detect concurrent-update races) and target GPU (projected usage must not exceed VRAM); (5) handles `assignedGpu`-only changes with VRAM capacity check on the target GPU using the service's existing `gpu` allocation; (6) stores resolved `assignedGpu` on `req.body` for downstream route handlers.
- **T004 — Auth middleware (`auth.js`) added:** New file providing two named exports: `authMiddleware` validates a Bearer JWT from the `Authorization` header, decodes it with `jwt.verify()`, and attaches the `{ userId, username, role }` payload to `req.user`. Returns 401 on missing header, malformed format, invalid token, or expired token (each with distinct error messages). `requireAdmin` is a downstream authorization gate that enforces `role === 'admin'` and returns 403 on failure. Neither function touches MongoDB.

---

## 📄 `rateLimit.js`

Rate-limiting middleware using `express-rate-limit` v7. Exports three named rate limiter configurations, each backed by a shared error handler that returns HTTP 429 with the standard `{ success: false, message }` envelope. Designed to protect against brute-force login attempts, API spam, and health-check abuse.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `express-rate-limit` | `rateLimit` (default) | External |

### Functions

- **`tooManyRequestsHandler(req: Request, res: Response) → void`**
  Shared handler invoked when any rate limiter exceeds its configured threshold. Returns HTTP 429 with a standardized JSON body. Parameters are intentionally unused (prefixed with `_`) since this is a generic callback that does not inspect request contents.
  - **Returns:** nothing — calls `res.status(429).json({ success: false, message: 'Too many requests, please try again later.' })`

### Exports

| Export | Type | Window | Max requests | Scope |
|--------|------|--------|-------------|-------|
| `globalLimiter` | `rateLimit` middleware instance | 15 minutes | 100 requests | Applied at the Express app level on all `/api/*` routes in `server.js` |
| `authLimiter` | `rateLimit` middleware instance | 15 minutes | 5 requests | Applied directly on `POST /register` and `POST /login` in `routes/auth.js` to prevent credential-brute-forcing |
| `healthLimiter` | `rateLimit` middleware instance | 1 minute | 10 requests | Applied via `router.use()` at the top of `routes/health.js` to cover all `/check-health/*` sub-routes |

## 🔄 Changes in this update

- **Task 3 — Rate limiting (`rateLimit.js`) added:** New middleware file providing three named rate-limit configurations using `express-rate-limit@^7.5.0`. `globalLimiter` (100 req / 15 min) is mounted at the Express app level on all `/api/*` routes. `authLimiter` (5 req / 15 min) is applied directly on auth endpoints to prevent brute-force password guessing. `healthLimiter` (10 req / min) protects health-check probes from abuse. All three share a common 429 handler that returns `{ success: false, message: 'Too many requests, please try again later.' }`. The new dependency `express-rate-limit@^7.5.0` was added to `package.json`.

---

## 📄 `ssrfProtection.js`

Server-Side Request Forgery (SSRF) protection module. Resolves hostnames to IP addresses and validates them against a hard-coded denylist of unsafe ranges (loopback, RFC 1918 private, link-local, documentation, reserved, carrier-grade NAT, and broadcast). Optionally enforces an allowlist via the `HEALTH_CHECK_ALLOWED_NETWORKS` environment variable so that only explicitly permitted CIDR ranges are reachable. Includes DNS rebinding mitigation: resolution happens fresh on every call (no caching of resolved addresses), and the resolved IP — not the original hostname — is used for actual TCP connections. Uses Node.js built-in `dns/promises` and `ipaddr.js` for CIDR arithmetic. No external HTTP dependencies.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `node:dns/promises` | `dns` (namespace) | External (Node.js built-in) |
| `ipaddr.js` | `ipaddr` (default) | External |

### Constants

| Constant | Type | Description |
|----------|------|-------------|
| `BLOCKED_RANGES` | `string[]` | Hard-coded array of CIDR strings representing IP ranges that are always denied: `127.0.0.0/8` (loopback), `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC 1918 private), `169.254.0.0/16` (link-local), `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24` (documentation), `192.0.0.0/29` (IETF protocol assignments), `100.64.0.0/10` (carrier-grade NAT), `0.0.0.0/8`, `240.0.0.0/4` (reserved/Class E), `255.255.255.255/32` (broadcast) |

### Functions

- **`parseAllowlist() → Array<[string, number]> | null`**
  Parses the `HEALTH_CHECK_ALLOWED_NETWORKS` environment variable into a list of `[ipAddress, prefixLength]` tuples managed by `ipaddr.js`. Returns `null` when the env var is empty or unset (meaning allowlist is inactive and only the denylist applies). Results are memoized on `parseAllowlist._cached` at module scope after first parse. Invalid CIDR entries are skipped with a console warning.
  - **Returns:** An array of `[string, number]` tuples for each valid CIDR range, or `null` if allowlist is disabled.

- **`validateIp(ip: string) → { allowed: boolean, reason?: string }`** *(exported)*
  Validates a single IP address string against both the hard denylist and the optional allowlist. Normalizes IPv6-mapped IPv4 addresses before checking. Three-stage validation: (1) normalize to IPv4 when safe, (2) check against `BLOCKED_RANGES`, (3) check against parsed allowlist (if active). Returns `{ allowed: true }` on success; `{ allowed: false, reason: string }` on failure.
  - `ip`: Dotted-decimal IPv4 or colon-separated IPv6 address string.
  - **Returns:** Object with `allowed` boolean and an optional `reason` string explaining the denial.

- **`resolveAndValidate(host: string) → Promise<{ allowed: boolean, ip?: string, reason?: string }>`** *(exported)*
  Resolves a hostname to its IP address using Node.js `dns.lookup()` and immediately validates that IP. This is the primary public entry point intended to be called by `healthChecker.js` before opening any socket or fetch connection. DNS resolution results are not cached, so re-resolution happens fresh every time (DNS rebinding mitigation). Logs warnings for blocked hosts and debug output in non-production environments.
  - `host`: A hostname or literal IP address string. Returns `{ allowed: false }` if empty or falsy.
  - **Returns:** Promise resolving to `{ allowed: boolean, ip?: string, reason?: string }`. On success, includes the resolved `ip`. On DNS failure, returns `{ allowed: false, reason: "dns resolution failed: <code>" }`.

## 🔄 Changes in this update

- **Task 12 — SSRF protection (`ssrfProtection.js`) added:** New module providing two exported functions for outbound connection safety. `validateIp()` checks an IP address against a hard denylist of 14 CIDR ranges covering loopback, private, link-local, documentation, and reserved addresses. Optionally enforces a whitelist via the `HEALTH_CHECK_ALLOWED_NETWORKS` env var (parsed by `parseAllowlist()` with memoization). `resolveAndValidate()` resolves a hostname to its IP via Node.js built-in `dns/promises`, validates it through `validateIp()`, and returns the resolved IP so callers can connect to the IP directly (preventing DNS rebinding attacks where the hostname resolves differently between validation and connection time). New dependency `ipaddr.js@^2.2.0` added to `package.json` for CIDR matching arithmetic.
