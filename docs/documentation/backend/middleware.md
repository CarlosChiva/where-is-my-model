# `middleware`

> Path: `backend/middleware/`
> Last updated: 2026-07-20 (Bugfix — services sub-router pcId extraction regex)
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
  Internal helper for routes mounted under `/api/pcs/:pcId/services` using sub-routers. When Express uses `app.use('/path/:id', router)`, the mount-point parameters (`:pcId`) are stripped from `req.params` inside the sub-router — `req.params` is always empty. This function extracts `pcId` by matching `req.baseUrl` against the regex `/\/api\/v\d+\/pcs\/([^/]+)/`. The pattern accounts for any API version segment (`v1`, `v2`, etc.) between `/api` and `/pcs`. There are no fallbacks to `req.params` because those are always empty in sub-routers (the old `req.params.pciId` fallback was removed as part of this fix — it never worked and only masked the root cause).
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

- **2026-07-20 — Bugfix: pcId extraction regex in `extractPcId`:** The regex inside `extractPcId()` was updated from `/\/api\/pcs\/([^/]+)/` to `/\/api\/v\d+\/pcs\/([^/]+)/`. The old pattern did not match the actual API versioned mount path (`/api/v1/pcs/<id>/services`) and therefore always returned `null`, causing service validation middleware to fail with 404 "PC not found" even when the target PC existed. The new regex accounts for any version segment (`v1`, `v2`, etc.) between `/api` and `/pcs`. The broken fallback chain (`req.params.pciId || req.params[':pciId']`) was removed — Express does not pass mount-path parameters to sub-routers, so `req.params` is always empty inside the services sub-router. Updated the function description accordingly.

## 🔄 Changes in this update (prior)

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
| `../utils/logger.js` | `logger` (default) | Internal |

### Constants

| Constant | Type | Description |
|----------|------|-------------|
| `BLOCKED_RANGES` | `string[]` | Hard-coded array of CIDR strings representing IP ranges that are always denied: `127.0.0.0/8` (loopback), `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC 1918 private), `169.254.0.0/16` (link-local), `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24` (documentation), `192.0.0.0/29` (IETF protocol assignments), `100.64.0.0/10` (carrier-grade NAT), `0.0.0.0/8`, `240.0.0.0/4` (reserved/Class E), `255.255.255.255/32` (broadcast) |

### Functions

- **`parseAllowlist() → Array<[string, number]> | null`**
  Parses the `HEALTH_CHECK_ALLOWED_NETWORKS` environment variable into a list of `[ipAddress, prefixLength]` tuples managed by `ipaddr.js`. Returns `null` when the env var is empty or unset (meaning allowlist is inactive and only the denylist applies). Results are memoized on `parseAllowlist._cached` at module scope after first parse. Invalid CIDR entries are skipped with a `logger.warn('[ssrf] invalid CIDR in allowlist: "%s" — skipping', cidr)`.
  - **Returns:** An array of `[string, number]` tuples for each valid CIDR range, or `null` if allowlist is disabled.

- **`validateIp(ip: string) → { allowed: boolean, reason?: string }`** *(exported)*
  Validates a single IP address string against both the hard denylist and the optional allowlist. Normalizes IPv6-mapped IPv4 addresses before checking. Three-stage validation: (1) normalize to IPv4 when safe, (2) check against `BLOCKED_RANGES`, (3) check against parsed allowlist (if active). Returns `{ allowed: true }` on success; `{ allowed: false, reason: string }` on failure.
  - `ip`: Dotted-decimal IPv4 or colon-separated IPv6 address string.
  - **Returns:** Object with `allowed` boolean and an optional `reason` string explaining the denial.

- **`resolveAndValidate(host: string) → Promise<{ allowed: boolean, ip?: string, reason?: string }>`** *(exported)*
  Resolves a hostname to its IP address using Node.js `dns.lookup()` and immediately validates that IP. This is the primary public entry point intended to be called by `healthChecker.js` before opening any socket or fetch connection. DNS resolution results are not cached, so re-resolution happens fresh every time (DNS rebinding mitigation). When a host is blocked, logs via `logger.warn('[ssrf] BLOCKED host="%s" resolved_ip="%s" reason="%s"', ...)`. On DNS failure, logs `logger.warn('[ssrf] DNS FAIL host="%s" error="%s — %s"', ...)`. Successful resolutions are logged at debug level: `logger.debug('[ssrf] OK     host="%s" → "%s"', ...)` — these appear only when pino's log level is set to debug or lower (controlled by pino's built-in level system, no manual `NODE_ENV` guard needed).
  - `host`: A hostname or literal IP address string. Returns `{ allowed: false }` if empty or falsy.
  - **Returns:** Promise resolving to `{ allowed: boolean, ip?: string, reason?: string }`. On success, includes the resolved `ip`. On DNS failure, returns `{ allowed: false, reason: "dns resolution failed: <code>" }`.

## 🔄 Changes in this update

- **Task 12 — SSRF protection (`ssrfProtection.js`) added:** New module providing two exported functions for outbound connection safety. `validateIp()` checks an IP address against a hard denylist of 14 CIDR ranges covering loopback, private, link-local, documentation, and reserved addresses. Optionally enforces a whitelist via the `HEALTH_CHECK_ALLOWED_NETWORKS` env var (parsed by `parseAllowlist()` with memoization). `resolveAndValidate()` resolves a hostname to its IP via Node.js built-in `dns/promises`, validates it through `validateIp()`, and returns the resolved IP so callers can connect to the IP directly (preventing DNS rebinding attacks where the hostname resolves differently between validation and connection time). New dependency `ipaddr.js@^2.2.0` added to `package.json` for CIDR matching arithmetic.

---

## 🔄 Changes in this update

- **Task 10 — Replaced console.log with structured logger pino:** Added import for `../utils/logger.js` (`logger`). Three `console.warn()` calls and one `console.log()` call have been replaced with pino's sprintf-style format strings:
  - `parseAllowlist()`: Invalid CIDR entries now log via `logger.warn('[ssrf] invalid CIDR in allowlist: "%s" — skipping', cidr)` instead of `console.warn()`.
  - `resolveAndValidate()`: Blocked hosts log via `logger.warn('[ssrf] BLOCKED host="%s" resolved_ip="%s" reason="%s"', ...)` instead of `console.warn()`. DNS failures log via `logger.warn('[ssrf] DNS FAIL host="%s" error="%s — %s"', ...)` instead of `console.warn()`. Successful resolutions log via `logger.debug('[ssrf] OK     host="%s" → "%s"', ...)` instead of the previous `console.log()` guarded by a manual `NODE_ENV !== 'production'` check. The explicit `NODE_ENV` guard is removed since pino's built-in log level system handles environment-aware output automatically.

---

## 📄 `sanitization.js`

Input sanitization middleware for Express routes. Provides two layers of defense: (1) a fail-fast guard against NoSQL injection and prototype pollution in `req.body`, rejecting suspect requests with HTTP 400; and (2) in-place string sanitization that strips HTML tags, trims whitespace, and escapes dangerous characters (`<`, `>`, `&`). Skips credential fields (`password`, `totpSecret`) so they pass through untouched. Skips numeric fields (`puerto`, `gpu`, `assignedGpu`, `vram`) to avoid type coercion. All blocked requests are logged via pino for security monitoring.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `../utils/logger.js` | `logger` (default) | Internal |

### Constants

| Constant | Type | Description |
|----------|------|-------------|
| `SKIP_SANITIZE_FIELDS` | `Set<string>` | Field names that bypass all string sanitization: `'password'`, `'totpSecret'` |
| `NUMERIC_FIELDS` | `Set<string>` | Field names that skip string treatment when their value is a number: `'puerto'`, `'gpu'`, `'assignedGpu'`, `'vram'` |
| `NOSQL_OPERATORS` | `Set<string>` | MongoDB query operators that trigger injection detection: `$gt`, `$gte`, `$lt`, `$lte`, `$ne`, `$eq`, `$regex`, `$exists`, `$type`, `$where`, `$set`, `$unset`, `$push`, `$pull`, `$inc`, `$rename`, `$currentDate`, `$addFields`, `$and`, `$or`, `$nor`, `$not` |
| `PROTOTYPE_POLLUTION_KEYS` | `Set<string>` | Keys that trigger prototype pollution detection: `'__proto__'`, `'constructor'`, `'prototype'` |

### Functions

- **`escapeHtmlChars(str: string) → string`** *(private)*
  Replaces `<`, `>`, and `&` with their HTML entity equivalents (`&lt;`, `&gt;`, `&amp;`). Used internally by `sanitizeString()`.
  - `str`: Raw string input.
  - **Returns:** String with dangerous characters HTML-escaped.

- **`sanitizeString(str: string, fieldName: string) → { clean: string, changed: boolean }`** *(exported)*
  Three-step string sanitization pipeline: (1) trims leading/trailing whitespace, (2) strips all HTML tags via regex, (3) escapes remaining `<`, `>`, `&` characters. If `fieldName` is in `SKIP_SANITIZE_FIELDS` (e.g., `'password'`, `'totpSecret'`), returns input unchanged. Returns a descriptor object indicating whether any mutation occurred.
  - `str`: Raw string value to sanitize.
  - `fieldName`: The requesting field's name — used as a lookup key against `SKIP_SANITIZE_FIELDS`.
  - **Returns:** `{ clean: string, changed: boolean }`

- **`hasNoSqlInjection(value: any) → { found: boolean, details: string[] }`** *(exported)*
  Recursively walks an object or array tree. At each key, checks against `NOSQL_OPERATORS` and `PROTOTYPE_POLLUTION_KEYS`. Collects hit descriptions into a `details` array with dot-path notation (e.g., `"NoSQL operator detected: \"body.$gt\""`, `"Prototype pollution attempt detected: \"__proto__\""`)`. If no threats are found, returns `{ found: false, details: [] }`.
  - `value`: Any request body value (object, array, or primitive).
  - **Returns:** `{ found: boolean, details: string[] }`

- **`sanitizeBodyDeep(value: object, fieldName: string) → void`** *(private)*
  Mutates an object tree in-place. For each string leaf that is not a secret or numeric field, applies `sanitizeString()` and assigns the clean value back. Recurses into nested objects and arrays. Non-object array items (numbers, booleans, etc.) are skipped.
  - `value`: Request body object to mutate.
  - `fieldName`: Dot-path prefix for child key resolution (e.g., `'body.service.puerto'`).
  - **Returns:** nothing — side-effect only.

- **`sanitizeMiddleware(req: Request, res: Response, next: NextFunction) → void | Response`** *(exported)*
  Express middleware applied on POST/PUT mutation routes before body validation. Two-step operation: (1) calls `hasNoSqlInjection(req.body)` — if threats are found the request is rejected with `400 { success: false, message: 'Request contains forbidden patterns.' }` and a `logger.warn()` entry detailing the blocked patterns; (2) if clean, calls `sanitizeBodyDeep(req.body, '')` to sanitize all string fields in-place. GET/HEAD requests with no body pass through silently via `next()`.
  - **Returns:** nothing — calls `next()` on success or returns a 400 JSON response on threat detection.

### Routing

Applied per-route (not globally) before validation middleware on mutation endpoints:

| Route file | Method(s) | Wiring position |
|------------|-----------|-----------------|
| `routes/auth.js` | All 4 POST handlers (`/register`, `/login`, `/change-password`, etc.) | Before body parsing / validation logic |
| `routes/pcs.js` | POST, PUT `/api/pcs` | Before `validatePcBody` middleware |
| `routes/services.js` | POST, PUT `/api/pcs/:pcId/services` | Before route-specific validators |
| `routes/users.js` | PUT `/api/users/:userId/role` | After `requireAdmin`, before role handler logic |

## 🔄 Changes in this update

- **Task 24 — Input sanitization (`sanitization.js`) added:** New middleware providing defense-in-depth for all mutation routes. Two exported utilities: `hasNoSqlInjection()` — recursive walker that detects MongoDB query operators (`$gt`, `$lt`, `$ne`, `$regex`, etc.) and prototype pollution keys (`__proto__`, `constructor`, `prototype`) in any nested object; and `sanitizeString()` — three-step pipeline that trims, strips HTML tags via regex, and escapes `<>&` entities. Both are wired into `sanitizeMiddleware()`, which acts as a fail-fast guard: on threat detection, rejects with 400 and logs via pino. A private helper `sanitizeBodyDeep()` mutates `req.body` in-place to clean string fields, while respecting `SKIP_SANITIZE_FIELDS` (password, totpSecret) and `NUMERIC_FIELDS` (puerto, gpu, assignedGpu, vram). Applied selectively on POST/PUT routes in auth.js (4 endpoints), pcs.js (POST/PUT pre validatePcBody), services.js (POST/PUT pre validator), and users.js (PUT role post requireAdmin). No external dependencies — uses only built-in approaches plus the shared pino logger.

---

## 📄 `requestId.js`

Express middleware that ensures every request carries a unique tracing identifier (`req.id`) and echoes it back in the `X-Request-ID` response header. The actual UUID generation/reuse logic lives upstream in `utils/logger.js` (via pino-http's `genReqId` callback). This middleware runs after pino-http, so `req.id` is already populated for every normal HTTP request. A fallback UUID is generated here only if `req.id` is somehow missing (e.g., a non-HTTP entry point invoking the handler directly). Supports distributed-tracing scenarios where a client sends an `X-Request-ID` header that pino-http validates and reuses.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `node:crypto` | `crypto` (namespace) | External (Node.js built-in) |

### Functions

- **`requestId(req: Request, res: Response, next: NextFunction) → void`** (default export)
  Middleware function applied via `app.use(requestId)` in the Express chain. Two-step operation:
  - **Fallback guard**: If `req.id` is falsy or not a string (should not occur under normal pino-http flow), generates a new UUID via `crypto.randomUUID()` and assigns it to `req.id`.
  - **Header echo**: Sets the `X-Request-ID` response header to the value of `req.id`, enabling clients and downstream proxies to correlate request logs end-to-end.
  - Passes control to `next()`.
  - **Returns:** nothing — calls `next()` (side-effect only: mutates `req.id` if missing, sets response header).

## 🔄 Changes in this update

- **Task 17 — Request ID tracking (`requestId.js`) added:** New middleware file exported as default. When registered in `server.js` after pino-http, it guarantees every request has a UUID on `req.id` (with crypto fallback) and responds with the `X-Request-ID` header for correlation across logs and client-side debugging. Uses `node:crypto.randomUUID()` from the built-in Node.js crypto module. No external dependencies.
