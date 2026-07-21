# `routes`

> Path: `backend/routes/`
> Last updated: 2026-07-20 (Bugfix — services sub-router pcId extraction regex)
> Type: Leaf folder

Express route modules for the API server. Each file exports a single `express.Router()` instance with RESTful endpoints, unified error handling, and standardized `{ success, data? }` response envelopes. Authentication routes now use a cookie-based two-token architecture (short-lived access tokens + long-lived refresh tokens) and include TOTP-based 2FA intercept in the login flow.

---

## 📄 `pcs.js`

REST router for PC CRUD operations against MongoDB. Default-exports an Express `Router` with five endpoints covering list, retrieve, create, update, and delete operations on GPU server entities. All endpoints are protected by `authMiddleware` (JWT-based authentication) — GET endpoints require any authenticated user, while mutation endpoints (POST, PUT, DELETE) additionally require the `admin` role via `requireAdmin`. Under the multi-GPU data model, each PC has a `gpus: [{ name, vram }]` array (at least one required) replacing the legacy single `vram` field. All responses follow a standard envelope: `{ success: boolean, data?: any, message?: string, errors?: string[] }`. Mongoose validation errors are caught and extracted into a human-readable array; CastError exceptions (invalid ObjectId format) return 400 with a descriptive message; generic errors are logged to console and returned as 500 with a safe message.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `express` | `express` (default) | External |
| `../models/PC.js` | `PC` (default) | Internal |
| `../middleware/validation.js` | `validatePcBody` (named) | Internal |
| `../middleware/auth.js` | `authMiddleware`, `requireAdmin` (named) | Internal |

### Router endpoints

#### `GET /` — List all PCs

Returns every PC document from the `pcs` collection as a lean (plain-object) array. Protected by `authMiddleware` — requires any authenticated user.

- **Middleware:** `authMiddleware` — verifies Bearer JWT; returns 401 on authentication failure.
- **Handler:** `async (req, res) => { ... }`
- **Success response (200):** `{ success: true, data: [...] }` — array of PC plain objects with all schema fields (virtual fields like `totalGpu` are not included).
- **Unauthorized (401):** Various messages depending on auth failure type (missing token, invalid format, expired token) — handled by upstream `authMiddleware`.
- **Error response (500):** `{ success: false, message: 'Internal server error' }`

#### `GET /:id` — Get single PC by ID

Retrieves a single PC document by MongoDB `_id`. Uses `PC.findById()` followed by `.lean()` to return a plain JavaScript object instead of a full Mongoose Document. This is consistent with the `GET /` endpoint, which also uses `.lean()`. As a result, virtual fields (including `totalGpu`) are **not** included in the response. Protected by `authMiddleware` — requires any authenticated user.

- **Middleware:** `authMiddleware` — verifies Bearer JWT; returns 401 on authentication failure.
- **Handler:** `async (req, res) => { ... }`
- **Parameters:**
  - `params.id`: MongoDB ObjectId string.
- **Success response (200):** `{ success: true, data: { <PC plain object — no virtual fields> } }`
- **Unauthorized (401):** Various messages depending on auth failure type — handled by upstream `authMiddleware`.
- **Bad request (400):** `{ success: false, message: 'Invalid PC ID format.' }` — CastError from invalid ObjectId string
- **Not found (404):** `{ success: false, message: 'PC not found' }`
- **Error response (500):** `{ success: false, message: 'Internal server error' }`

#### `POST /` — Create new PC

Creates a new PC document. Accepts `nombre`, `ip`, and `gpus` from the request body. The `servicios` field defaults to an empty array via the Mongoose schema definition. The multi-GPU `gpus` array must contain at least one GPU object `{ name, vram }`. **Admin-only route** — requires both authentication and admin role.

- **Middleware chain (in order):**
  1. `authMiddleware` — verifies Bearer JWT; returns 401 on authentication failure.
  2. `requireAdmin` — enforces `role === 'admin'`; returns 403 for non-admin users.
  3. `validatePcBody` — validates request body (checks `nombre` non-empty string, `ip` valid IPv4 format with octet range 0-255, `gpus` array with at least one GPU object `{ name, vram }`).
- **Handler:** `async (req, res) => { ... }`
- **Request body:**
  - `nombre`: Server name (`string`, required by model).
  - `ip`: IPv4 address (`string`, required, validated by schema regex).
  - `gpus`: Array of GPU objects `{ name: string, vram: number }` (at least one required by model schema).
- **Success response (201):** `{ success: true, data: { <saved PC document> } }`
- **Unauthorized (401):** Returned by upstream `authMiddleware` if no/present/invalid/expired token.
- **Forbidden (403):** `{ success: false, message: 'Admin access required.' }` — returned by `requireAdmin` when the authenticated user's role is not `'admin'`.
- **Validation error (400):** `{ success: false, errors: [string, ...] }` — array of validation messages from `validatePcBody` middleware or Mongoose validation errors.
- **Error response (500):** `{ success: false, message: 'Internal server error' }`

#### `PUT /:id` — Update existing PC

Updates metadata fields (`nombre`, `ip`, `gpus`) of an existing PC. Runs Mongoose validators on the updated fields via `{ runValidators: true }`. Returns the updated document with `{ new: true }`. **Admin-only route** — requires both authentication and admin role.

- **Middleware chain (in order):**
  1. `authMiddleware` — verifies Bearer JWT; returns 401 on authentication failure.
  2. `requireAdmin` — enforces `role === 'admin'`; returns 403 for non-admin users.
  3. `validatePcBody` — validates request body (checks `nombre` non-empty string, `ip` valid IPv4 format with octet range 0-255, `gpus` array with at least one GPU object `{ name, vram }`).
- **Handler:** `async (req, res) => { ... }`
- **Parameters:**
  - `params.id`: MongoDB ObjectId string.
- **Request body:**
  - `nombre`: Updated server name (`string`).
  - `ip`: Updated IPv4 address (`string`).
  - `gpus`: Updated array of GPU objects `{ name: string, vram: number }`.
- **Success response (200):** `{ success: true, data: { <updated PC document> } }`
- **Unauthorized (401):** Returned by upstream `authMiddleware` if no/invalid/expired token.
- **Forbidden (403):** `{ success: false, message: 'Admin access required.' }` — returned by `requireAdmin` when the authenticated user's role is not `'admin'`.
- **Bad request (400):** `{ success: false, message: 'Invalid PC ID format.' }` — CastError from invalid ObjectId string
- **Not found (404):** `{ success: false, message: 'PC not found' }`
- **Validation error (400):** `{ success: false, errors: [string, ...] }` — array of validation messages from `validatePcBody` middleware or Mongoose validation errors.
- **Error response (500):** `{ success: false, message: 'Internal server error' }`

#### `DELETE /:id` — Remove PC

Deletes a PC document by `_id`. Embedded `servicios` subdocuments are removed automatically as part of the parent document deletion (MongoDB cascade for embedded documents).

- **Handler:** `async (req, res) => { ... }`
- **Parameters:**
  - `params.id`: MongoDB ObjectId string.
- **Success response (200):** `{ success: true, data: { <deleted PC document> }, message: 'PC deleted successfully' }`
- **Bad request (400):** `{ success: false, message: 'Invalid PC ID format.' }` — CastError from invalid ObjectId string
- **Not found (404):** `{ success: false, message: 'PC not found' }`
- **Error response (500):** `{ success: false, message: 'Internal server error' }`

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `default` | `express.Router()` | Router instance with 5 PC CRUD endpoints mounted at `/api/pcs` via `server.js` |

---

## 📄 `services.js`

REST router for embedded Service CRUD operations within a given PC. Default-exports an Express `Router` with four endpoints covering list, create, update, and delete operations on the `pc.servicios[]` subdocument array. Services are identified by **array index** (not ObjectId) because they are defined with `_id: false` in the Mongoose schema. All mutations use live Mongoose documents (non-lean) so that `.save()` triggers the document-level GPU-cap validator (`path('servicios')` validator enforcing per-GPU capacity: `sum(svc.gpu where assignedGpu===i) ≤ gpus[i].vram`). Responses follow the same envelope as `pcs.js`: `{ success: boolean, data?: ..., errors?: string[], message?: string }`. CastError exceptions (invalid ObjectId format) are caught and return 400 with a descriptive message.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `express` | `express` (default) | External |
| `../models/PC.js` | `PC` (default) | Internal |
| `../middleware/validation.js` | `validateServiceBody`, `validateServiceUpdate` (named) | Internal |
| `../middleware/auth.js` | `authMiddleware`, `requireAdmin` (named) | Internal |
| `../utils/logger.js` | `logger` (default) | Internal |
| `../middleware/sanitization.js` | `sanitizeMiddleware` (named) | Internal |

### Helper functions

- **`getPcId(req: Request) → string | null`**
  Extracts the parent PC's MongoDB `_id` from `req.baseUrl` using a regex. This is necessary because the services router is mounted as a sub-router at `/api/v1/pcs/:pcId/services` in `server.js`. When Express mounts a sub-router with path parameters (like `:pcId`), those mount-path parameters are **not** passed to `req.params` inside the sub-router — `req.params` is always empty. Instead, `req.baseUrl` contains the fully-resolved mount path at runtime (e.g., `/api/v1/pcs/64a1b2c3d4e5f6/services`). The regex pattern `/\/api\/v\d+\/pcs\/([^/]+)/` matches any API version segment (`v1`, `v2`, etc.), captures the ObjectId after `/pcs/`, and returns it. Returns `null` if no match is found (should never occur in normal operation, but prevents crashing on malformed requests).
  - `req`: The Express request object.
  - **Returns:** The parsed `pcId` string (MongoDB ObjectId), or `null`.

### Router endpoints

#### `GET /` — List all services for a PC

Returns the `pc.servicios` array for the PC identified by `getPcId(req)`, which extracts the `_id` from `req.baseUrl` via regex (see helper functions section). Returns 404 if the PC does not exist.

- **Handler:** `async (req, res) => { ... }`
- **Parameters:**
  - Parent PC `_id`: Extracted from `req.baseUrl` by `getPcId(req)` — MongoDB ObjectId string embedded in the mount path `/api/v1/pcs/<id>/services`.
- **Success response (200):** `{ success: true, data: [servicios] }` — array of service subdocuments (`{ nombre, puerto, gpu, assignedGpu }`).
- **Bad request (400):** `{ success: false, message: 'Invalid PC ID format.' }` — CastError from invalid ObjectId string
- **Not found (404):** `{ success: false, message: 'PC not found' }`
- **Error response (500):** `{ success: false, message: 'Internal server error' }`

#### `POST /` — Add a service to a PC

Pushes a new service subdocument (`nombre`, `puerto`, `gpu`, `assignedGpu`) onto the PC's `servicios` array, then calls `pc.save()` which fires the document-level per-GPU validator: `sum(svc.gpu where assignedGpu===i) ≤ gpus[i].vram`. Returns 201 on success; returns 400 with an errors array if any GPU cap is exceeded (caught as `ValidationError`). The `assignedGpu` field identifies which of the PC's GPUs the service is bound to, enabling per-GPU capacity tracking. Logs whether the PC was found for debugging purposes.

- **Middleware:** `validateServiceBody` — validates request body before handler execution (checks required fields and types for `nombre`, `puerto`, `gpu`, `assignedGpu`; enforces per-GPU cap against `pc.gpus[assignedGpu].vram`). Also protected by `sanitizeMiddleware` and requires admin role via `requireAdmin`.
- **Handler:** `async (req, res) => { ... }`
- **Parameters:**
  - Parent PC `_id`: Extracted from `req.baseUrl` by `getPcId(req)` — MongoDB ObjectId string embedded in the mount path `/api/v1/pcs/<id>/services`.
- **Request body:**
  - `nombre`: Service name (`string`).
  - `puerto`: Port number (`number`).
  - `gpu`: GPU resource allocation in GB (`number`).
  - `assignedGpu`: Index into the PC's `gpus[]` array indicating which GPU hosts this service (`number`, non-negative integer). Defaults to `0` for single-GPU PCs when omitted; required on multi-GPU PCs. Resolved by `validateServiceBody` middleware and stored on `req.body`.
- **Success response (201):** `{ success: true, data: { <full PC document> } }`
- **Bad request (400):** `{ success: false, message: 'Invalid PC ID format.' }` — CastError from invalid ObjectId string
- **Validation error (400):** `{ success: false, errors: [string, ...] }` — validation messages from `validateServiceBody` middleware or Mongoose validation messages extracted from `err.errors`.
- **Not found (404):** `{ success: false, message: 'PC not found' }`
- **Error response (500):** `{ success: false, message: 'Internal server error' }`

#### `PUT /:serviceIndex` — Update a service by array index

Parses `req.params.serviceIndex` as an integer with radix 10. Validates bounds (`isNaN`, `<0`, or `≥ servicios.length`) → 404 if out of range. Performs a **partial update**: only fields present in the request body are modified on the live subdocument, preventing accidental zeroing of omitted fields. Calls `pc.save()` to trigger the GPU-cap validator. Supports updating the `assignedGpu` field to migrate a service to a different GPU on the same PC.

- **Middleware:** `validateServiceUpdate` — validates request body before handler execution (checks types and constraints for optional `nombre`, `puerto`, `gpu` fields). Also protected by `sanitizeMiddleware` and requires admin role via `requireAdmin`.
- **Handler:** `async (req, res) => { ... }`
- **Parameters:**
  - Parent PC `_id`: Extracted from `req.baseUrl` by `getPcId(req)` — MongoDB ObjectId string embedded in the mount path `/api/v1/pcs/<id>/services`.
  - `params.serviceIndex`: Array index (`string`, parsed as integer with base 10).
- **Request body** _(all fields optional — partial update):_
  - `nombre`: Updated service name (`string`).
  - `puerto`: Updated port number (`number`).
  - `gpu`: Updated GPU allocation in GB (`number`).
  - `assignedGpu`: Updated GPU index for the service (`number`, non-negative integer). Conditionally updated only if present in the request body.
- **Success response (200):** `{ success: true, data: { <full PC document> } }`
- **Bad request (400):** `{ success: false, message: 'Invalid PC ID format.' }` — CastError from invalid ObjectId string
- **Validation error (400):** `{ success: false, errors: [string, ...] }` — validation messages from `validateServiceUpdate` middleware or Mongoose validation messages.
- **Not found (404):** `{ success: false, message: 'PC not found' }` or `{ success: false, message: 'Service index out of bounds' }`
- **Error response (500):** `{ success: false, message: 'Internal server error' }`

#### `DELETE /:serviceIndex` — Remove a service by array index

Parses the integer index, validates bounds, then splices the service from the `servicios` array at that position. Calls `pc.save()` to persist. GPU cap cannot be violated on deletion (only reduces usage). Requires authentication and admin role.

- **Middleware chain:** `authMiddleware` → `requireAdmin`.
- **Handler:** `async (req, res) => { ... }`
- **Parameters:**
  - Parent PC `_id`: Extracted from `req.baseUrl` by `getPcId(req)` — MongoDB ObjectId string embedded in the mount path `/api/v1/pcs/<id>/services`.
  - `params.serviceIndex`: Array index (`string`, parsed as integer with base 10).
- **Success response (200):** `{ success: true, data: { <full PC document> }, message: 'Service deleted successfully' }`
- **Bad request (400):** `{ success: false, message: 'Invalid PC ID format.' }` — CastError from invalid ObjectId string
- **Not found (404):** `{ success: false, message: 'PC not found' }` or `{ success: false, message: 'Service index out of bounds' }`
- **Error response (500):** `{ success: false, message: 'Internal server error' }`

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `default` | `express.Router()` | Router instance with 4 Service CRUD endpoints mounted at `/api/pcs/:pcId/services` via `server.js` |

---

## 📄 `auth.js`

Express router for JWT-based user authentication. Default-exports an Express `Router` with five endpoints: registration, login, token refresh, profile retrieval, and logout. Multiple internal helper functions produce signed access/refresh JWTs, set httpOnly cookies, construct safe user-profile objects (excludes the hashed password), generate short-lived temporary 2FA session tokens, and parse JWT duration strings. The router now supports a cookie-based two-token architecture: access tokens (`accessToken` cookie, 15 min TTL) and refresh tokens (`refreshToken` cookie, 7 day TTL persisted in MongoDB). A new 2FA interceptor in the login flow detects users with `totpEnabled: true` and issues a short-lived `tempAuthSession` cookie (5 minutes) instead of full session cookies — the client must then verify via `POST /api/auth/2fa/verify`. The `/me` endpoint is protected by the `authMiddleware` from `../middleware/auth.js`. All error responses follow the `{ success: false, message? }` envelope shared across all route modules.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `express` | `express` (default) | External |
| `jsonwebtoken` | `jwt` (default) | External |
| `../models/User.js` | `User` (default) | Internal |
| `../models/RefreshToken.js` | `RefreshToken` (default) | Internal |
| `../middleware/auth.js` | `authMiddleware` (named) | Internal |
| `../middleware/rateLimit.js` | `authLimiter` (named) | Internal |

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `PASSWORD_REGEX` | `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{12,}$/` | Regex duplicated from the User model for synchronous, pre-DB password complexity checking in the `/register` handler |
| `TEMP_SESSION_TTL_MS` | `300_000` (5 minutes) | Maximum lifetime of the `tempAuthSession` cookie issued during 2FA-required login intercept. After this window expires, the user must re-authenticate via `POST /login`. |

### Helper functions

- **`createTempAuthToken(userId: string) → string`**
  Creates a short-lived JWT used as the value for the `tempAuthSession` cookie. The payload contains only `userId` and a Unix timestamp (`ts`). Signed with `JWT_SECRET` and expires after 5 minutes. Used exclusively by the login intercept flow when a 2FA-enabled user provides correct credentials but has not yet completed TOTP verification.
  - `userId`: MongoDB `_id` string of the authenticated-but-not-yet-verified user.
  - **Returns:** A signed JWT string suitable for storage in an httpOnly cookie.

- **`verifyTempAuthToken(token: string) → object | null`**
  Verifies and decodes a temp session JWT (the value stored in `tempAuthSession` cookie). In addition to standard `jwt.verify()`, performs an extra age check against the embedded `ts` field — if `Date.now() - decoded.ts > TEMP_SESSION_TTL_MS`, returns `null`. This double-check enforces the 5-minute window even if the JWT's own `exp` claim is slightly generous due to clock drift.
  - `token`: The raw JWT string from `req.cookies.tempAuthSession`.
  - **Returns:** Decoded payload object (`{ userId, ts }`) on success, or `null` on any failure (invalid signature, expired, exceeded TTL window).

- **`parseDurationToMs(duration: string) → number | null`**
  Parses a JWT duration string like `"7d"`, `"30m"`, `"1h"`, or `"60s"` into milliseconds. Matches via regex `^(\d+)([smhd])$` and multiplies the numeric value by unit-specific multipliers. Returns `null` if the format does not match.
  - `duration`: A duration string with a single-suffix unit character.
  - **Returns:** millisecond value or `null`.

- **`signAccessToken(user: User) → string`**
  Creates a short-lived access JWT for an authenticated user. The payload contains three fields: `userId` (stringified `_id`), `username`, and `role`. Signs with `process.env.JWT_SECRET` using `process.env.JWT_EXPIRES_IN` as the expiration claim. Used by both `/register` (first-user admin flow) and `/login` for non-2FA users.
  - `user`: A Mongoose User document instance.
  - **Returns:** The signed JWT string, set as the `accessToken` httpOnly cookie.

- **`signRefreshToken(user: User) → Promise<string>`** *(async)*
  Creates a long-lived refresh JWT bound to a specific user and persists it in the `RefreshToken` MongoDB collection. Signs with `process.env.JWT_REFRESH_SECRET` using `process.env.JWT_REFRESH_EXPIRES_IN`. The created record includes the raw token string, the associated `userId`, and an absolute `expiresAt` timestamp computed by parsing the expiry duration via `parseDurationToMs()`.
  - `user`: A Mongoose User document instance.
  - **Returns:** The signed refresh JWT string (stored in both MongoDB and set as the `refreshToken` httpOnly cookie).

- **`setAuthCookies(res: Response, accessTokenValue: string, refreshTokenValue: string) → void`**
  Sets two httpOnly cookies on the response:
  - `accessToken`: short-lived (15 min maxAge), available at path `/api`, secure in production.
  - `refreshToken`: long-lived (7 day maxAge), scoped to path `/api/auth/refresh` only (limiting exposure), secure in production.
  Both cookies use environment-aware `sameSite`: `'Strict'` when `NODE_ENV === 'production'`, `'Lax'` otherwise. This ensures strict CSRF protection in deployed environments while allowing cross-origin HMR/proxy workflows in development.

- **`userProfile(user: User) → object`**
  Builds a safe user-profile object that excludes the hashed password (which is marked `select: false` in the schema). Returns `userId`, `username`, and `role`.
  - `user`: A Mongoose User document instance.
  - **Returns:** `{ userId: string, username: string, role: string }`

### Router endpoints

#### `POST /register` — Create a new user account

Accepts `username` and `password` from the request body. Protected by `authLimiter` rate limiting (5 requests per 15 minutes per IP) to prevent brute-force registration abuse. Validates both fields are non-empty strings. **Then performs a synchronous password-complexity guard** using `PASSWORD_REGEX.test(password)` *before* any async database work — this is the first defense layer; if the regex fails, returns 400 immediately without touching MongoDB. Checks for duplicate usernames via `User.findOne()`. Uses `User.countDocuments()` to determine the role: the first registered user receives `'admin'`; all subsequent registrations receive `'pending'`. Upon success, persists the new user (which triggers the Mongoose schema-level validator as a second defense layer, then bcryptjs hashing in the pre-save hook). **Response differs by role:** admins receive full session cookies (`accessToken` + `refreshToken`) and a profile object; pending users receive a Spanish-language confirmation message and their role value — no session cookies are issued until an admin approves them via `PUT /api/users/:userId/role`.

- **Middleware:** `authLimiter` — rate limits registration attempts to 5 per 15-minute window per IP. Returns 429 if exceeded.
- **Handler:** `async (req, res) => { ... }`
- **Request body:**
  - `username`: Account name (`string`, required). Trimmed before persistence.
  - `password`: Plain-text password (`string`, required). Hashed by the User model's pre-save hook.
- **Success response — admin (first user, 201):** `{ success: true, user: { userId, username, role } }` with `accessToken` and `refreshToken` cookies set. The refresh token is persisted in MongoDB for rotation tracking.
- **Success response — pending (subsequent users, 201):** `{ success: true, message: 'Cuenta registrada exitosamente. Espera aprobación del administrador.', role: 'pending' }` — no cookies are set; the user must wait for an admin to change their role before they can log in and receive session tokens.
- **Validation error (400):** `{ success: false, message: 'Username is required.' }` or `{ success: false, message: 'Password is required.' }` — missing/invalid input. `{ success: false, message: 'Password does not meet complexity requirements.' }` — password fails the synchronous `PASSWORD_REGEX` guard (first defense layer) or Mongoose schema validator (second defense layer). Also `{ success: false, errors: [string, ...] }` from Mongoose `ValidationError`.
- **Conflict (409):** `{ success: false, message: 'Username already exists.' }` — username collision.
- **Too Many Requests (429):** `{ success: false, message: 'Too many requests, please try again later.' }` — returned by `authLimiter` when exceeding 5 requests per 15-minute window per IP.
- **Error response (500):** `{ success: false, message: 'Internal server error' }`

#### `POST /login` — Authenticate and receive session cookies (with 2FA intercept)

Protected by `authLimiter` rate limiting (5 requests per 15 minutes per IP) to prevent brute-force credential attacks. Looks up a user by trimmed username with `.select('+password +totpEnabled')` to include both the normally-excluded password field and the 2FA status flag. If the user exists, calls the instance method `user.comparePassword(password)` to verify the bcrypt hash. On mismatch or missing user, returns 401. Three post-authentication gates execute in sequence:

1. **Pending-user guard:** If `user.role === 'pending'`, rejects with HTTP 403 and a Spanish-language message — credentials were correct but admin approval is required.
2. **2FA intercept:** If `user.totpEnabled` is `true`, issues a short-lived `tempAuthSession` cookie (5-minute TTL, httpOnly, secure in production, `sameSite: 'Strict'` in production / `'Lax'` in development, scoped to `/api/auth/2fa/verify`) containing a temporary JWT with the user's ID. Returns HTTP 403 with `{ status: '2FA_REQUIRED' }` — **no access or refresh cookies are issued**. The client must call `POST /api/auth/2fa/verify` with a TOTP code to complete authentication.
3. **Normal login flow (non-2FA, non-pending):** Revokes all existing unrevoked refresh tokens for this user via `RefreshToken.updateMany()`, signs new access + refresh tokens, sets both cookies, and returns 200 with the user profile.

- **Middleware:** `authLimiter` — rate limits login attempts to 5 per 15-minute window per IP. Returns 429 if exceeded.
- **Handler:** `async (req, res) => { ... }`
- **Request body:**
  - `username`: Account name (`string`, required).
  - `password`: Plain-text password to compare against the stored hash (`string`, required).
- **Success response — no 2FA (200):** `{ success: true, user: { userId, username, role } }` with `accessToken` and `refreshToken` cookies set.
- **Success response — 2FA enabled (403 with redirect status):** `{ success: false, status: '2FA_REQUIRED', message: 'Two-factor authentication required.', userId: <string> }` with `tempAuthSession` cookie set. The client must proceed to `POST /api/auth/2fa/verify`.
- **Validation error (400):** `{ success: false, message: 'Username is required.' }` or `{ success: false, message: 'Password is required.' }` — missing/invalid input.
- **Unauthorized (401):** `{ success: false, message: 'Invalid credentials.' }` — wrong username or password.
- **Forbidden (403):** `{ success: false, message: 'Tu cuenta está pendiente de aprobación por un administrador.' }` — credentials are correct but the user's role is `'pending'`; no session tokens issued until an admin changes their role via `PUT /api/users/:userId/role`.
- **Too Many Requests (429):** `{ success: false, message: 'Too many requests, please try again later.' }` — returned by `authLimiter` when exceeding 5 requests per 15-minute window per IP.
- **Error response (500):** `{ success: false, message: 'Internal server error' }`

#### `POST /refresh` — Rotate access and refresh tokens

Reads the `refreshToken` cookie from the request, verifies its signature against `JWT_REFRESH_SECRET`, then looks up the raw token in MongoDB via `RefreshToken.findByToken()`. If found and valid (not revoked, not expired), it revokes that specific token record, generates fresh access + refresh tokens, sets new cookies, and returns 200. Handles three failure modes: expired JWT (`TokenExpiredError` → clear both cookies + 401), invalid signature/general JWT error (403), and revoked/not-found DB record (revokes all remaining valid tokens for that user, clears cookies, returns 401). Protected by `authLimiter`.

- **Middleware:** `authLimiter` — rate limits refresh attempts to 5 per 15-minute window per IP.
- **Handler:** `async (req, res) => { ... }`
- **No request body required.** Reads tokens exclusively from cookies.
- **Success response (200):** `{ success: true, message: 'Tokens rotated.' }` with new `accessToken` and `refreshToken` cookies set.
- **Unauthorized (401):** Various failure modes — expired JWT, revoked token, not-found token, or deleted user account. All clear both auth cookies.
- **Forbidden (403):** `{ success: false, message: 'Invalid refresh token.' }` — signature mismatch on the presented refresh JWT.
- **Too Many Requests (429):** Returned by `authLimiter`.
- **Error response (500):** `{ success: false, message: 'Internal server error' }`

#### `GET /me` — Return the authenticated user's profile

Protected endpoint that requires a valid access token cookie. The `authMiddleware` middleware verifies and decodes the JWT before this handler executes, populating `req.user`. The handler looks up the user document from MongoDB by `userId` (404 if not found) and returns the safe profile projection via `userProfile()`. Unlike the legacy in-memory-only version, this now performs a database lookup.

- **Middleware:** `authMiddleware` — verifies Bearer JWT; returns 401 on any authentication failure.
- **Handler:** `async (req, res) => { ... }` (async — performs a DB query).
- **Request headers:**
  - `Authorization: Bearer <JWT>` (required).
- **Success response (200):** `{ userId, username, role }` — safe user profile without password.
- **Not found (404):** `{ success: false, message: 'User not found.' }` — the account was deleted after token issuance.
- **Unauthorized (401):** Various messages depending on the auth failure type (handled by upstream `authMiddleware`).

#### `POST /logout` — Revoke all refresh tokens and clear session cookies

Protected endpoint that revokes all unrevoked refresh tokens for the authenticated user via `RefreshToken.updateMany()`, then clears both `accessToken` and `refreshToken` cookies. The database write is wrapped in a best-effort try/catch — logout succeeds even if the MongoDB write fails (cookies are always cleared).

- **Middleware:** `authMiddleware` — verifies Bearer JWT; returns 401 on any authentication failure.
- **Handler:** `async (req, res) => { ... }`
- **Success response (200):** `{ success: true, message: 'Logged out' }` with both auth cookies cleared.
- **Unauthorized (401):** Various messages depending on the auth failure type.

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `default` | `express.Router()` | Router instance with 5 authentication endpoints mounted at `/api/auth` via `server.js` |

---

## 📄 `twoFactor.js`

Express router for TOTP-based two-factor authentication (2FA). Default-exports an Express `Router` with four endpoints covering the complete 2FA lifecycle: setup, verification, status check, and disabling. Uses `speakeasy` for time-based OTP generation/verification and `qrcode` for QR code data URI generation. Implements a dual-mode verification endpoint that works both during post-login intercept (via `tempAuthSession` cookie from `auth.js`) and as a mid-session 2FA enablement flow (via standard `accessToken` cookie). On successful verification, the endpoint issues full session cookies (`accessToken` + `refreshToken`), revokes all existing refresh tokens for that user, and clears the temporary session. All endpoints are rate-limited via `authLimiter`. Mounted at `/api/auth/2fa` **before** the general auth router to prevent Express parameter collision.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `express` | `express` (default) | External |
| `jsonwebtoken` | `jwt` (default) | External |
| `qrcode` | `QRCode` (default) | External |
| `speakeasy` | `speakeasy` (default) | External |
| `../models/User.js` | `User` (default) | Internal |
| `../models/RefreshToken.js` | `RefreshToken` (default) | Internal |
| `../middleware/auth.js` | `authMiddleware` (named) | Internal |
| `../middleware/rateLimit.js` | `authLimiter` (named) | Internal |
| `../utils/logger.js` | `logger` (default) | Internal |

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `TEMP_SESSION_TTL_MS` | `300_000` (5 minutes) | Maximum lifetime of a temporary 2FA session. Used in the dual-mode `/verify` endpoint to detect expired post-login sessions. |
| `APP_NAME` | `'WhereIsMyModel'` | Application identifier embedded in the TOTP otpauth URI label (`'WhereIsMyModel:{username}'`). |

### Error logging

All four endpoints (`/setup`, `/verify`, `/disable`, `/status`) log catch-block errors via `logger.error('[2fa] <METHOD> <PATH> error:', err)` using the pino structured logger imported from `../utils/logger.js`.

### Helper functions

- **`parseDurationToMs(duration: string) → number | null`**
  Parses a JWT duration string (e.g., `"7d"`, `"30m"`) into milliseconds. Same implementation as in `auth.js` — shared logic for interpreting `JWT_REFRESH_EXPIRES_IN`.
  - `duration`: A duration string with numeric value and single-suffix unit (`s`, `m`, `h`, or `d`).
  - **Returns:** millisecond value or `null` on format mismatch.

- **`verifyTempAuthToken(token: string) → object | null`**
  Verifies and decodes a temporary session JWT (the value of the `tempAuthSession` cookie). Validates the signature against `JWT_SECRET`, then enforces the 5-minute TTL window via the embedded `ts` timestamp. Same dual-check strategy as `auth.js`.
  - `token`: The raw JWT string from `req.cookies.tempAuthSession`.
  - **Returns:** Decoded payload (`{ userId, ts }`) or `null`.

- **`signAccessToken(user: User) → string`**
  Creates a short-lived access JWT containing `userId`, `username`, and `role`. Same implementation as in `auth.js`. Used by the `/verify` endpoint to issue a full session upon successful TOTP confirmation.
  - `user`: A Mongoose User document instance.
  - **Returns:** The signed access JWT string.

- **`signRefreshToken(user: User) → Promise<string>`** *(async)*
  Creates and persists a refresh token in MongoDB via the `RefreshToken` model. Signs with `JWT_REFRESH_SECRET`, computes absolute expiration, and stores the raw token for later rotation lookups. Same implementation as in `auth.js`.
  - `user`: A Mongoose User document instance.
  - **Returns:** The signed refresh JWT string.

- **`setAuthCookies(res: Response, accessTokenValue: string, refreshTokenValue: string) → void`**
  Sets the `accessToken` (15 min, path `/api`) and `refreshToken` (7 day, path `/api/auth/refresh`) httpOnly cookies. Uses environment-aware `sameSite`: `'Strict'` in production, `'Lax'` in development. Mirrors the implementation in `auth.js`.

- **`userProfile(user: User) → object`**
  Builds a safe user-profile object `{ userId, username, role }`. Mirrors the implementation in `auth.js`.

### Router endpoints

#### `POST /setup` — Generate a TOTP secret and QR code

Authenticated endpoint (requires valid access token via `authMiddleware`). Generates a fresh TOTP secret using `speakeasy.generateSecret()` with the user's username as the label. Stores the base32-encoded secret on the user document (without enabling 2FA yet). Generates a QR code data URI from the otpauth URL for scanning by authenticator apps. Also returns the raw base32 secret for manual entry. Rate-limited via `authLimiter`.

- **Middleware chain:** `authLimiter` → `authMiddleware`.
- **Handler:** `async (req, res) => { ... }`
- **No request body required.** The user identity is determined from the authenticated JWT payload.
- **Success response (200):**
  ```json
  {
    "success": true,
    "message": "TOTP secret generated successfully.",
    "qrCode": "<data URI of QR code>",
    "manualEntry": "<base32 secret string>"
  }
  ```
- **Not found (404):** `{ success: false, message: 'User not found.' }` — user ID from JWT does not match any document.
- **Error response (500):** `{ success: false, message: 'Internal server error' }`

#### `POST /verify` — Verify a TOTP code and complete 2FA enrollment

Dual-mode endpoint that does **not** require standard authentication middleware. Instead, it checks for identity via two cookie-based modes:
- **Mode A (post-login flow):** Reads the `tempAuthSession` cookie set by `POST /login` when intercepting a 2FA-enabled user. Verifies the temp token via `verifyTempAuthToken()` to extract the `userId`.
- **Mode B (mid-session enablement):** If Mode A yields no valid session, attempts to decode the standard `accessToken` cookie via `jwt.verify()`.

Once a `userId` is established, loads the user with both `totpSecret` and `password` fields selected. Verifies the submitted TOTP code against the stored secret using `speakeasy.totp.verify()` with a timing-safe comparator and `window: 1` (allows one time-step drift). If verification passes and 2FA is not yet enabled (`totpEnabled: false`), sets it to `true`. Revokes all existing unrevoked refresh tokens for this user, signs fresh access + refresh cookies via the shared helpers, and clears the temporary session cookie. Rate-limited via `authLimiter`.

- **Middleware:** `authLimiter` (only — no `authMiddleware`).
- **Handler:** `async (req, res) => { ... }`
- **Request body:**
  - `code`: The 6-digit TOTP code from the user's authenticator app (`string`, required).
- **Success response (200):** `{ success: true, message: 'Two-factor authentication verified.', user: { userId, username, role } }` with full `accessToken` and `refreshToken` cookies set. Temp session cookie cleared.
- **Validation error (400):** `{ success: false, message: 'TOTP code is required.' }` — missing or empty `code`. Also `{ success: false, message: '2FA is not set up for this account.' }` — user has no stored `totpSecret`.
- **Unauthorized (401):** `{ success: false, message: 'No valid 2FA session. Please log in again.' }` — neither temp session nor access token could be verified. Also `{ success: false, message: 'Invalid TOTP code.' }` — timing-safe verification failed.
- **Error response (500):** `{ success: false, message: 'Internal server error' }`

#### `POST /disable` — Disable 2FA and clear all TOTP state

Authenticated endpoint (requires valid access token via `authMiddleware`). Requires the user to provide both their current password and a valid TOTP code in the request body. This dual-confirmation ensures that an attacker with a stolen session cookie cannot silently disable 2FA. Verifies the password first via `user.comparePassword()`, then verifies the TOTP code via `speakeasy.totp.verify()` (timing-safe, `window: 1`). On success, clears both `totpSecret` (set to `undefined`) and `totpEnabled` (set to `false`). Rate-limited via `authLimiter`.

- **Middleware chain:** `authLimiter` → `authMiddleware`.
- **Handler:** `async (req, res) => { ... }`
- **Request body:**
  - `password`: The user's current plain-text password (`string`, required). Computed against the stored bcrypt hash.
  - `code`: Current TOTP code from the authenticator app (`string`, required). Verified timing-safely.
- **Success response (200):** `{ success: true, message: 'Two-factor authentication has been disabled.' }`
- **Validation error (400):** `{ success: false, message: 'Current password is required to disable 2FA.' }` or `{ success: false, message: 'TOTP code is required to disable 2FA.' }` — missing input fields.
- **Unauthorized (401):** `{ success: false, message: 'Invalid password.' }` — bcrypt comparison failed. Also `{ success: false, message: 'Invalid TOTP code.' }` — timing-safe verification failed.
- **Not found (404):** `{ success: false, message: 'User not found.' }`
- **Error response (500):** `{ success: false, message: 'Internal server error' }`

#### `GET /status` — Check whether 2FA is enabled for the current user

Authenticated endpoint (requires valid access token via `authMiddleware`). Looks up the user's `totpEnabled` field and returns a Boolean. Lightweight — no password or secret fields are loaded.

- **Middleware:** `authMiddleware`.
- **Handler:** `async (req, res) => { ... }`
- **No request body required.**
- **Success response (200):** `{ success: true, totpEnabled: <boolean> }`
- **Not found (404):** `{ success: false, message: 'User not found.' }` — user was deleted after token issuance.
- **Unauthorized (401):** Handled by `authMiddleware`.
- **Error response (500):** `{ success: false, message: 'Internal server error' }`

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `default` | `express.Router()` | Router instance with 4 TOTP 2FA endpoints mounted at `/api/auth/2fa` via `server.js`. Registered **before** the general `/api/auth` router to prevent Express route collision. |

## 🔄 Changes in this update

- **Task 10 — Replaced console.log with structured logger pino:** Added import for `../utils/logger.js` (`logger`). All four catch blocks across `/setup`, `/verify`, `/disable`, and `/status` no longer call `console.error()` — they now log via `logger.error('[2fa] <METHOD> <PATH> error:', err)`.

---

## 📄 `health.js`

---

## 📄 `health.js`

Express router dedicated to TCP-based service health checks against GPU compute servers. Default-exports an Express `Router` with two POST endpoints that leverage the `healthChecker.js` utility (in `backend/services/`) to probe the reachability of long-running network services hosted on each PC's configured IP address and ports. Both endpoints are protected by `authMiddleware` (JWT-based authentication) — any authenticated user may invoke health checks. Also protected by `healthLimiter` rate limiting (10 requests per minute per IP) applied at the router level via `router.use()` to prevent excessive probing. Uses double ObjectId protection: a preemptive `isValidObjectId()` check before database access, plus a Mongoose `CastError` fallback in the catch block — consistent with conventions established in `pcs.js`. Error responses follow the `{ success: false, message }` envelope pattern shared across all route modules.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `express` | `express` (default) | External |
| `mongoose` | `isValidObjectId` (named) | External |
| `../models/PC.js` | `PC` (default) | Internal |
| `../services/healthChecker.js` | `checkPcServices`, `checkAllServices` (named) | Internal |
| `../middleware/auth.js` | `authMiddleware` (named) | Internal |
| `../middleware/rateLimit.js` | `healthLimiter` (named) | Internal |

### Router endpoints

#### `POST /pcs/:pcId` — Health-check services on a single PC

Validates the PC ObjectId parameter, looks up the PC document from MongoDB (404 if not found), then delegates to `checkPcServices()` which iterates the embedded `servicios` array performing per-port TCP probes. Returns structured status data for each service. Protected by both `healthLimiter` (rate limiting at the router level — 10 requests per minute per IP) and `authMiddleware` (JWT-based authentication) — requires any authenticated user.

- **Middleware:**
  1. `healthLimiter` — rate limits health-check probes to 10 per minute per IP. Returns 429 if exceeded. Applied via `router.use()` covering all `/check-health/*` routes.
  2. `authMiddleware` — verifies Bearer JWT; returns 401 on authentication failure.
- **Handler:** `async (req, res) => { ... }`
- **Parameters:**
  - `params.pcId`: MongoDB ObjectId string of the target PC.
- **Double ObjectId protection:** Preemptive `isValidObjectId(pcId)` check rejects malformed IDs with a 400 response before any database query. A catch-block fallback handles Mongoose `CastError` if one slips through for any reason.
- **Success response (200):** `{ success: true, data: { pcId, id, services: [{ index, nombre, puerto, status }] } }` — per-service TCP probe results from `checkPcServices()`.
- **Bad request (400):** `{ success: false, message: 'Invalid PC ID' }` — invalid ObjectId format caught by either the pre-check or CastError fallback.
- **Not found (404):** `{ success: false, message: 'PC not found' }` — no PC document matches the given `_id`.
- **Error response (500):** `{ success: false, message: 'Internal server error' }` — unexpected errors are logged via `console.error('[health] ...')` and returned with a safe message.

#### `POST /all` — Health-check services across the entire fleet

Fetches every PC document via `PC.find()` and delegates to `checkAllServices()` which runs `checkPcServices()` on each PC concurrently using `Promise.allSettled`. Individual failures do not abort the sweep — they are wrapped with an `error` field in the per-PC result. Returns an array of per-PC health summaries for the entire monitored fleet. Protected by both `healthLimiter` (rate limiting at the router level) and `authMiddleware` — requires any authenticated user.

- **Middleware (inherited from router-level):**
  1. `healthLimiter` — rate limits health-check probes to 10 per minute per IP. Returns 429 if exceeded. Applied via `router.use()` covering all `/check-health/*` routes.
  2. `authMiddleware` — verifies Bearer JWT; returns 401 on authentication failure.
- **Handler:** `async (req, res) => { ... }`
- **No parameters required.**
- **Success response (200):** `{ success: true, data: [{ pcId, id, services: [...] }, ...] }` — array of per-PC result objects from `checkAllServices()`. Each object is augmented with `pcDocIndex` (original array index). Synchronous failures within an individual PC's handler produce an `error` string field.
- **Error response (500):** `{ success: false, message: 'Internal server error' }` — unexpected errors are logged via `console.error('[health] ...')` and returned with a safe message.

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `default` | `express.Router()` | Router instance with 2 health-check endpoints mounted at `/api/health` (or equivalent path) via `server.js` |

---

## 📄 `users.js`

Express router for user administration operations. Default-exports an Express `Router` with three endpoints: listing all registered users, changing a user's role, and deleting a user. All endpoints are protected by `authMiddleware` (JWT verification) and `requireAdmin` (role-based access control), meaning only authenticated admin users can invoke them. Returns safe projections — the hashed password field is excluded both by Mongoose schema (`select: false`) and by explicit projection logic in the handlers. The `DELETE /:userId` endpoint includes a last-admin safeguard that automatically promotes another eligible user to admin before deletion to prevent the loss of all administrator accounts.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `express` | `express` (default) | External |
| `mongoose` | `mongoose` (default) | External |
| `../models/User.js` | `User` (default) | Internal |
| `../middleware/auth.js` | `authMiddleware`, `requireAdmin` (named) | Internal |

### Router endpoints

#### `GET /` — List all users (admin only)

Returns every user document from the `users` collection as a lean array. Projects only `userId` (stringified `_id`), `username`, and `role` — the password hash is never exposed. Protected by two middleware layers: authentication first, then role enforcement.

- **Middleware chain (in order):**
  1. `authMiddleware` — verifies Bearer JWT; returns 401 on authentication failure.
  2. `requireAdmin` — enforces `role === 'admin'`; returns 403 for non-admin users.
- **Handler:** `async (req, res) => { ... }`
- **Success response (200):** `{ success: true, data: [{ userId, username, role }, ...] }` — array of projected user objects.
- **Unauthorized (401):** Various messages depending on auth failure type — handled by upstream `authMiddleware`.
- **Forbidden (403):** `{ success: false, message: 'Admin access required.' }` — returned by `requireAdmin` when the authenticated user's role is not `'admin'`.
- **Error response (500):** `{ success: false, message: 'Internal server error' }` — logged via `console.error('[users] GET / error:', err)`.

#### `PUT /:userId/role` — Change a user's role (admin only)

Updates the `role` field of an existing user to one of three allowed values: `'admin'`, `'user'`, or `'pending'`. Performs a preemptive `mongoose.Types.ObjectId.isValid()` check on `req.params.userId` before any database access. Validates that `req.body.role` is one of the three allowed values. Uses `User.findByIdAndUpdate()` with `{ new: true, runValidators: true }` to return the fresh document and trigger schema validators. Catches Mongoose `CastError` for malformed ObjectIds that bypass the pre-check. Returns the updated user document (password excluded by schema's `select: false`).

- **Middleware chain (in order):**
  1. `authMiddleware` — verifies Bearer JWT; returns 401 on authentication failure.
  2. `requireAdmin` — enforces `role === 'admin'`; returns 403 for non-admin users.
- **Handler:** `async (req, res) => { ... }`
- **Parameters:**
  - `params.userId`: MongoDB ObjectId string of the target user.
- **Request body:**
  - `role`: New role value (`string`, must be `'admin'`, `'user'`, or `'pending'`).
- **Success response (200):** `{ success: true, data: { <updated User document with password excluded> } }`
- **Bad request (400):** `{ success: false, message: 'Invalid user ID format.' }` — either from the pre-check (`isValid()`) or from a Mongoose `CastError` in the catch block.
- **Bad request (400):** `{ success: false, message: 'Role must be either "admin", "user" or "pending".' }` — role value not one of the three allowed strings.
- **Not found (404):** `{ success: false, message: 'User not found.' }` — no user document matches the given `_id`.
- **Unauthorized (401):** Various messages depending on auth failure type — handled by upstream `authMiddleware`.
- **Forbidden (403):** `{ success: false, message: 'Admin access required.' }` — returned by `requireAdmin` when the authenticated user's role is not `'admin'`.
- **Error response (500):** `{ success: false, message: 'Internal server error' }` — logged via `console.error('[users] PUT /:userId/role error:', err)`.

#### `DELETE /:userId` — Delete a user (admin only) with last-admin safeguard

Deletes a user document by `_id`. Performs a preemptive `mongoose.Types.ObjectId.isValid()` check on `req.params.userId` before any database access. Looks up the target user to confirm existence (404 if not found). **Last-admin safeguard:** Before deletion, counts existing admins via `User.countDocuments({ role: 'admin' })`. If only one admin exists (i.e., the targeted user), searches for a non-pending candidate (`role !== 'pending'`, `_id` different from target) to automatically promote to `'admin'` before proceeding. If no eligible candidate exists, returns 400 with an error message — the deletion is aborted. On success, deletes the user via `User.findByIdAndDelete()` and returns 204 No Content. Catches Mongoose `CastError` for malformed ObjectIds that bypass the pre-check.

- **Middleware chain (in order):**
  1. `authMiddleware` — verifies Bearer JWT; returns 401 on authentication failure.
  2. `requireAdmin` — enforces `role === 'admin'`; returns 403 for non-admin users.
- **Handler:** `async (req, res) => { ... }`
- **Parameters:**
  - `params.userId`: MongoDB ObjectId string of the target user.
- **Last-admin safeguard logic:**
  - Counts admins: `User.countDocuments({ role: 'admin' })`.
  - If count equals 1 (only admin is the deletion target): searches for a replacement candidate via `User.findOne({ role: { $ne: 'pending' }, _id: { $ne: targetId } })`.
  - If a candidate is found: sets `candidate.role = 'admin'` and persists via `candidate.save()`, then proceeds with deletion.
  - If no candidate exists: aborts deletion with HTTP 400 and an explanatory message.
- **Success response (204):** No content body — empty response indicating successful deletion.
- **Bad request (400):** `{ success: false, message: 'Invalid user ID format.' }` — either from the pre-check (`isValid()`) or from a Mongoose `CastError` in the catch block.
- **Bad request (400):** `{ success: false, message: 'Cannot delete the last admin and no other user is available to promote.' }` — last-admin safeguard triggered and no eligible promotion candidate found.
- **Not found (404):** `{ success: false, message: 'User not found.' }` — no user document matches the given `_id`.
- **Unauthorized (401):** Various messages depending on auth failure type — handled by upstream `authMiddleware`.
- **Forbidden (403):** `{ success: false, message: 'Admin access required.' }` — returned by `requireAdmin` when the authenticated user's role is not `'admin'`.
- **Error response (500):** `{ success: false, message: 'Internal server error' }` — logged via `console.error('[users] DELETE /:userId error:', err)`.

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `default` | `express.Router()` | Router instance with 3 admin-only user management endpoints mounted at `/api/users` via `server.js` |

---

## 🔄 Changes in this update

- **2026-06-03 — T005 Embedded Service CRUD Routes:** Added full documentation for `services.js`. This new file provides four REST endpoints (`GET /`, `POST /`, `PUT /:serviceIndex`, `DELETE /:serviceIndex`) for managing embedded service subdocuments within a PC. Services are addressed by array index (not ObjectId) and all mutations leverage Mongoose `.save()` to enforce the schema-level GPU-cap validator (`sum(gpu) ≤ vram`).
- **2026-06-04 — Added `validatePcBody` middleware:** `POST /api/pcs` and `PUT /api/pcs/:id` routes now use the `validatePcBody` middleware from `../middleware/validation.js`. Input validation (nombre non-empty, ip valid IPv4 with octet range 0-255, vram ≥ 1) runs before the route handler executes. Invalid requests return 400 with structured error messages. Updated imports table and route documentation for both endpoints.
- **2026-06-04 — T2: Added `validateServiceBody` and `validateServiceUpdate` middleware:** `POST /api/pcs/:pcId/services` now uses `validateServiceBody` and `PUT /api/pcs/:pcId/services/:serviceIndex` now uses `validateServiceUpdate` from `../middleware/validation.js`. Service input validation runs before route handlers execute, returning 400 with structured error messages on invalid input. Updated imports table and route documentation for both endpoints.
- **2026-06-04 — Added `.lean()` to `GET /api/pcs/:id`:** The `GET /api/pcs/:id` route now uses `.lean()` after `PC.findById()`, consistent with `GET /api/pcs`. The response is a plain JavaScript object instead of a full Mongoose Document, so the `totalGpu` virtual field is no longer included. Updated route description and success response documentation.

## 🔄 Changes in this update

- **Task 4 — Added CastError handling in pcs.js routes**: `GET /:id`, `PUT /:id`, and `DELETE /:id` routes now check for `err.name === 'CastError'` in their catch blocks and return 400 with message 'Invalid PC ID format.' for invalid ObjectId strings. Updated pcs.js description to mention CastError handling.
- **Task 4 — Added CastError handling in services.js routes**: `GET /`, `POST /`, `PUT /:serviceIndex`, and `DELETE /:serviceIndex` routes now check for `err.name === 'CastError'` in their catch blocks and return 400 with message 'Invalid PC ID format.' for invalid ObjectId strings. Updated services.js description to mention CastError handling.
- **Task 4 — Updated error response documentation**: Added Bad request (400) response for CastError to all affected endpoints in both pcs.js and services.js route documentation.

## 🔄 Changes in this update

- **T03 — Multi-GPU support in `services.js` routes:** The POST `/api/pcs/:pcId/services` handler now pushes `assignedGpu` alongside `{ nombre, puerto, gpu }` when creating a new service. The PUT `/api/pcs/:pcId/services/:serviceIndex` handler conditionally updates the `assignedGpu` field if it is present in the request body (partial update). GET `/` endpoint success response now documents that each service subdocument includes the `assignedGpu` field. Updated the `services.js` file description and all relevant endpoint documentation.

## 🔄 Changes in this update

- **2026-07-11 — Added health check route (`health.js`):** New Express router providing two POST endpoints for TCP-based service health checks. `POST /pcs/:pcId` validates the ObjectId, looks up the PC, and delegates to `checkPcServices()` from `healthChecker.js`. `POST /all` fetches all PCs and delegates to `checkAllServices()` for fleet-wide sweeps. Both use double ObjectId protection (pre-check + CastError fallback) consistent with pcs.js conventions. Full per-endpoint documentation including parameters, response shapes, and error handling has been added.

## 🔄 Changes in this update

- **2026-07-11 — Multi-GPU `vram` → `gpus` alignment in docs:** Updated all references to the legacy single-GPU `vram` field in `pcs.js` documentation. POST `/api/pcs` and PUT `/api/pcs/:id` now correctly document request body as `{ nombre, ip, gpus }` with the multi-GPU schema `{ name: string, vram: number }[]`. Middleware descriptions, file-level description, and per-endpoint request/response bodies all updated.
- **2026-07-11 — Per-GPU validator description in `services.js`:** The GPU-cap validator description now accurately reflects the multi-GPU constraint: `sum(svc.gpu where assignedGpu===i) ≤ gpus[i].vram` instead of the legacy single-GPU formula `sum(gpu) ≤ vram`.
- **2026-07-11 — `health.js` param name fix:** Source corrected from `req.params.pcid` to `req.params.pcId` on line 14 to match the route pattern `:pcId` (case-sensitive). Documentation was already describing `params.pcId`, so no structural change needed — this entry records the source alignment.

## 🔄 Changes in this update

- **T005 — Auth routes (`auth.js`) added:** New Express router providing three authentication endpoints mounted at `/api/auth`. `POST /register` creates a new user account (first user gets `'admin'` role, subsequent users get `'pending'` role), signs a JWT for the first user only — pending users receive a Spanish-language success message instead of a token. `POST /login` authenticates via username/password comparison (bcryptjs), signs a JWT on success, and returns token + profile. `GET /me` is protected by `authMiddleware` and returns the decoded JWT payload as the user profile without an additional database query. Full per-endpoint documentation including imports, helper functions (`signToken`, `userProfile`), request/response shapes, and error handling has been added.

## 🔄 Changes in this update

- **2026-07-12 — Users router (`users.js`) added:** New Express router providing an admin-only user listing endpoint mounted at `/api/users`. `GET /` is protected by both `authMiddleware` and `requireAdmin`, returning a lean projection of `{ userId, username, role }` for all users (password hash excluded). Full per-endpoint documentation including middleware chain, response shapes, and error handling has been added.

## 🔄 Changes in this update

- **2026-07-12 — T2: Added `PUT /:userId/role` endpoint to `users.js`:** New admin-only endpoint for changing a user's role to `'admin'` or `'user'`. Performs preemptive `mongoose.Types.ObjectId.isValid()` validation on the URL parameter, validates that the request body `role` field is one of two allowed values, then updates via `User.findByIdAndUpdate()` with `{ new: true, runValidators: true }`. Catches Mongoose `CastError` for malformed ObjectIds. Updated the `users.js` file description, imports table (added `mongoose`), full per-endpoint documentation, and exports table to reflect both endpoints.

## 🔄 Changes in this update

- **T3 — Pending-user rejection guard in `POST /login`:** After password verification, before JWT signing, a new guard checks if `user.role === 'pending'`. Pending users are now rejected with HTTP 403 and the Spanish message `"Tu cuenta está pendiente de aprobación por un administrador."` even when credentials are correct. Updated the `POST /login` description to describe this new step in the authentication flow and added a **Forbidden (403)** response entry cross-referencing `PUT /api/users/:userId/role` as the admin approval mechanism.

## 🔄 Changes in this update

- **T2 — Pending registration flow in `auth.js`:** The `POST /register` endpoint now assigns `'pending'` (instead of `'user'`) to all non-first users via `User.countDocuments()`. When the assigned role is `'pending'`, the handler skips JWT issuance and returns a Spanish-language confirmation message (`'Cuenta registrada exitosamente. Espera aprobación del administrador.'`) along with `role: 'pending'`. The first user still receives `'admin'` + JWT as before (unchanged). Updated the per-endpoint description, split success response into two distinct shapes (admin vs. pending), corrected all references to `'user'` in prior changelog entries, and added a note cross-referencing `PUT /api/users/:userId/role` as the admin approval mechanism.

## 🔄 Changes in this update

- **T5 — Added `DELETE /:userId` endpoint to `users.js`:** New admin-only endpoint that deletes a user with full last-admin safeguard logic: (1) preemptive ObjectId format validation (400 on invalid), (2) target user lookup (404 if not found), (3) last-admin safeguard — counts current admins, and if only 1 exists, searches for a non-pending candidate (`role !== 'pending'`, different `_id`) to promote to admin before deletion; aborts with 400 if no eligible candidate is found, (4) deletes via `User.findByIdAndDelete()` returning 204 No Content on success. Protected by both `authMiddleware` and `requireAdmin`. Updated the file description to mention three endpoints, added full per-endpoint documentation including safeguard flow details, updated the exports table count from 2 to 3.

## 🔄 Changes in this update

- **Task 3 — Rate limiting on auth routes (`auth.js`):** `POST /register` and `POST /login` are now protected by `authLimiter` imported from `../middleware/rateLimit.js`. This limiter allows only 5 requests per 15-minute window per IP address, providing brute-force protection against credential guessing attacks. Both endpoints now return HTTP 429 (`{ success: false, message: 'Too many requests, please try again later.' }`) when the limit is exceeded. Updated the imports table (added `../middleware/rateLimit.js` entry), updated endpoint descriptions to mention rate limiting, added middleware documentation for both POST endpoints, and added the 429 response shape to both handlers.
- **Task 3 — Rate limiting on health routes (`health.js`):** The entire health router is now protected by `healthLimiter` imported from `../middleware/rateLimit.js`. The limiter is applied at the router level via `router.use(healthLimiter)`, covering all `/check-health/*` sub-routes. Allows 10 requests per minute per IP to prevent excessive TCP probing. Updated the imports table, file-level description, middleware chains on both endpoints, and added healthLimiter's 429 response behavior documentation.

## 🔄 Changes in this update

- **Password complexity guard added to `POST /register` (`auth.js`):**
  - **Added `PASSWORD_REGEX` constant** at module level — identical regex pattern from `User.js` model, duplicated for synchronous checking before async DB operations.
  - **Inserted synchronous password-complexity guard** in the `/register` handler after presence/type checks but *before* any database work (`User.findOne`, `User.countDocuments`). If `PASSWORD_REGEX.test(password)` fails, returns HTTP 400 with `{ success: false, message: 'Password does not meet complexity requirements.' }` immediately — no wasteful bcrypt hashing or DB round-trip occurs for invalid passwords.
  - This is the **first** defense layer in a three-layer validation chain: (1) sync route guard (`auth.js`), (2) Mongoose schema validator (`User.js` `validate` block), (3) client-side check (`isPasswordStrong` in `LoginPage.jsx`). Together they provide defense-in-depth across client, server handler, and persistence layers.
  - Updated the `/register` endpoint description to document this new validation step, updated error response documentation to include the complexity-rejection body.

## 🔄 Changes in this update

- **2026-07-20 — Bugfix: services sub-router PC ID extraction (`getPcId`):** The `getPcId()` helper function's regex was updated from `/\/api\/pcs\/([^/]+)/` to `/\/api\/v\d+\/pcs\/([^/]+)/`. The old pattern did not match the actual API versioned mount path (`/api/v1/pcs/<id>/services`) and therefore returned `null`, causing all service CRUD endpoints (POST, PUT, DELETE) to return 404 "PC not found" even when the PC existed. The new regex accounts for any version segment (`v1`, `v2`, etc.) between `/api` and `/pcs`. The broken fallback to `req.params.pcid` was removed — Express does not pass mount-path parameters to sub-routers, so `req.params` is always empty inside this sub-router. Added full `getPcId()` helper documentation with explanation of why it exists (Express sub-router parameter stripping). Updated all four endpoint parameter descriptions to reference `getPcId(req)` instead of `req.params.pcId`. Updated imports table to include `auth.js`, `logger.js`, and `sanitization.js`.

## 🔄 Changes in this update

- **Task 21 — Added `twoFactor.js` router:** New Express router providing four TOTP-based 2FA endpoints mounted at `/api/auth/2fa`. The file is registered in `server.js` **before** the general `/api/auth` router to prevent Express from matching `/auth/2fa` against auth route parameters. Four endpoints:
  - **`POST /setup`** — Generates a TOTP secret via `speakeasy`, stores it on the user (without enabling 2FA), and returns a QR code data URI + plaintext manual entry code. Requires authentication.
  - **`POST /verify`** — Dual-mode endpoint: Mode A reads `tempAuthSession` cookie from post-login intercept; Mode B reads `accessToken` cookie for mid-session enablement. Verifies the TOTP code timing-safely (`window: 1`). On success, enables 2FA if not already enabled, revokes all old refresh tokens, issues full session cookies, and clears the temp session.
  - **`POST /disable`** — Requires both current password (bcrypt comparison) AND a valid TOTP code. On success, clears `totpSecret` and sets `totpEnabled: false`.
  - **`GET /status`** — Lightweight check returning `{ totpEnabled: boolean }`.
  All endpoints are rate-limited via `authLimiter`. The module shares helper implementations with `auth.js` (`signAccessToken`, `signRefreshToken`, `setAuthCookies`, `userProfile`) to maintain consistency across the authentication surface.

- **Task 21 — Updated `auth.js` for 2FA integration:**
  - Added `RefreshToken` model import — auth routes now use a cookie-based two-token architecture (httpOnly `accessToken` + `refreshToken` cookies) instead of returning a bare JWT in the response body.
  - Added new helpers: `createTempAuthToken(userId)` produces a 5-minute-lifetime temporary token for the 2FA intercept flow; `verifyTempAuthToken(token)` validates temp tokens with dual expiry checking (JWT `exp` claim + embedded timestamp); `parseDurationToMs(duration)` parses JWT duration strings; `signAccessToken(user)`, `signRefreshToken(user)`, and `setAuthCookies(res, ...) ` manage cookie-based sessions.
  - Added `TEMP_SESSION_TTL_MS` constant (5 minutes).
  - **Updated `/register`:** First-user admin flow now sets access + refresh cookies instead of returning a bare token. Response body no longer includes `token` — it uses the same `{ success, user }` shape as login.
  - **Updated `/login`:** Now selects both `+password` and `+totpEnabled` when looking up users. Added the 2FA intercept: if `user.totpEnabled` is true after credential validation, the handler sets a `tempAuthSession` cookie (httpOnly, 5 min TTL, scoped to `/api/auth/2fa/verify`) and returns HTTP 403 with `{ status: '2FA_REQUIRED' }`. Non-2FA users follow the normal flow of revoking old refresh tokens and issuing fresh session cookies.
  - **Added `/refresh`:** New endpoint for rotating expired access tokens via a valid refresh token cookie. Full rotation architecture including DB lookup, revocation check, and re-issuance.
  - **Added `/logout`:** Revokes all unrevoked refresh tokens for the authenticated user (best-effort DB write), clears both auth cookies, returns 200 with confirmation message.
  - **Updated `/me`:** Now performs a MongoDB lookup instead of relying solely on the JWT payload. Returns a safe profile projection.
  - Updated imports table to include `RefreshToken` import. Updated exports count from 3 to 5 endpoints.

## 🔄 Changes in this update

- **Task 6 — Switch JWT to httpOnly cookies (sameSite fix):** Fixed the `sameSite` cookie policy across all authentication cookies from hardcoded `'strict'` (lowercase) to environment-aware values:
  - **`auth.js`** — `setAuthCookies()` helper now uses `isProd ? 'Strict' : 'Lax'` for both `accessToken` and `refreshToken` cookies. The `POST /login` handler's `tempAuthSession` cookie (2FA intercept) was similarly updated at the point of issuance.
  - **`twoFactor.js`** — The duplicated `setAuthCookies()` helper receives the same fix: `sameSite` is `'Strict'` in production, `'Lax'` in development for both `accessToken` and `refreshToken`.
  - Rationale: `'Strict'` blocks all cross-site requests including those from an external dev proxy or HMR server. `'Lax'` allows the Vite dev server (on a different port) to send cookies while still protecting against CSRF on cross-origin POST/PUT/DELETE. Properly capitalized values (`'Strict'`, `'Lax'`) conform to current browser implementations (some browsers normalize lowercase, but explicit capitalization ensures compliance).
  - All three "Set both auth cookies" helper descriptions and the 2FA intercept cookie documentation have been updated accordingly.
