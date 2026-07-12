# `routes`

> Path: `backend/routes/`
> Last updated: 2026-07-11
> Type: Leaf folder

Express route modules for the API server. Each file exports a single `express.Router()` instance with RESTful endpoints, unified error handling, and standardized `{ success, data? }` response envelopes.

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

### Router endpoints

#### `GET /` — List all services for a PC

Returns the `pc.servicios` array for the PC identified by `req.params.pcId` (inherited from parent route param). Returns 404 if the PC does not exist.

- **Handler:** `async (req, res) => { ... }`
- **Parameters:**
  - `params.pcId`: MongoDB ObjectId string of the parent PC.
- **Success response (200):** `{ success: true, data: [servicios] }` — array of service subdocuments (`{ nombre, puerto, gpu, assignedGpu }`).
- **Bad request (400):** `{ success: false, message: 'Invalid PC ID format.' }` — CastError from invalid ObjectId string
- **Not found (404):** `{ success: false, message: 'PC not found' }`
- **Error response (500):** `{ success: false, message: 'Internal server error' }`

#### `POST /` — Add a service to a PC

Pushes a new service subdocument (`nombre`, `puerto`, `gpu`, `assignedGpu`) onto the PC's `servicios` array, then calls `pc.save()` which fires the document-level per-GPU validator: `sum(svc.gpu where assignedGpu===i) ≤ gpus[i].vram`. Returns 201 on success; returns 400 with an errors array if any GPU cap is exceeded (caught as `ValidationError`). The `assignedGpu` field identifies which of the PC's GPUs the service is bound to, enabling per-GPU capacity tracking.

- **Middleware:** `validateServiceBody` — validates request body before handler execution (checks required fields and types for `nombre`, `puerto`, `gpu`, `assignedGpu`; enforces per-GPU cap against `pc.gpus[assignedGpu].vram`).
- **Handler:** `async (req, res) => { ... }`
- **Parameters:**
  - `params.pcId`: MongoDB ObjectId string of the parent PC.
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

- **Middleware:** `validateServiceUpdate` — validates request body before handler execution (checks types and constraints for optional `nombre`, `puerto`, `gpu` fields).
- **Handler:** `async (req, res) => { ... }`
- **Parameters:**
  - `params.pcId`: MongoDB ObjectId string of the parent PC.
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

Parses the integer index, validates bounds, then splices the service from the `servicios` array at that position. Calls `pc.save()` to persist. GPU cap cannot be violated on deletion (only reduces usage).

- **Handler:** `async (req, res) => { ... }`
- **Parameters:**
  - `params.pcId`: MongoDB ObjectId string of the parent PC.
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

Express router for JWT-based user authentication. Default-exports an Express `Router` with three endpoints: registration, login, and profile retrieval. Two internal helper functions (`signToken`, `userProfile`) produce the JWT and a safe user-profile object (excludes the hashed password). The `/me` endpoint is protected by the `authMiddleware` from `../middleware/auth.js`. All error responses follow the `{ success: false, message? }` envelope shared across all route modules.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `express` | `express` (default) | External |
| `jsonwebtoken` | `jwt` (default) | External |
| `../models/User.js` | `User` (default) | Internal |
| `../middleware/auth.js` | `authMiddleware` (named) | Internal |

### Helper functions

- **`signToken(user: User) → string`**
  Creates a signed JWT for an authenticated user. The payload contains three fields: `userId` (stringified `_id`), `username`, and `role`. Signs with `process.env.JWT_SECRET` using `process.env.JWT_EXPIRES_IN` as the expiration claim.
  - `user`: A Mongoose User document instance.
  - **Returns:** The signed JWT string, ready to be sent in a Bearer token.

- **`userProfile(user: User) → object`**
  Builds a safe user-profile object that excludes the hashed password (which is marked `select: false` in the schema). Returns `userId`, `username`, and `role`.
  - `user`: A Mongoose User document instance.
  - **Returns:** `{ userId: string, username: string, role: string }`

### Router endpoints

#### `POST /register` — Create a new user account

Accepts `username` and `password` from the request body. Validates both fields are non-empty strings. Checks for duplicate usernames via `User.findOne()`. Uses `User.countDocuments()` to determine the role: the first registered user receives `'admin'`; all subsequent registrations receive `'pending'`. Upon success, persists the new user (which triggers bcryptjs hashing in the pre-save hook). **Response differs by role:** admins receive a JWT token and profile; pending users receive a Spanish-language confirmation message and their role value — no JWT is issued until an admin approves them via `PUT /api/users/:userId/role`.

- **Handler:** `async (req, res) => { ... }`
- **Request body:**
  - `username`: Account name (`string`, required). Trimmed before persistence.
  - `password`: Plain-text password (`string`, required). Hashed by the User model's pre-save hook.
- **Success response — admin (first user, 201):** `{ success: true, token: <JWT string>, user: { userId, username, role } }`
- **Success response — pending (subsequent users, 201):** `{ success: true, message: 'Cuenta registrada exitosamente. Espera aprobación del administrador.', role: 'pending' }` — no token is returned; the user must wait for an admin to change their role before they can log in and receive a JWT.
- **Validation error (400):** `{ success: false, message: 'Username is required.' }` or `{ success: false, message: 'Password is required.' }` — missing/invalid input. Also `{ success: false, errors: [string, ...] }` from Mongoose `ValidationError`.
- **Conflict (409):** `{ success: false, message: 'Username already exists.' }` — username collision.
- **Error response (500):** `{ success: false, message: 'Internal server error' }`

#### `POST /login` — Authenticate and receive a JWT

Looks up a user by trimmed username with `.select('+password')` to include the normally-excluded password field. If the user exists, calls the instance method `user.comparePassword(password)` to verify the bcrypt hash. On mismatch or missing user, returns 401. **After password verification, before JWT signing**, an additional guard checks if `user.role === 'pending'`: pending users are rejected with HTTP 403 and a Spanish-language message even though their credentials were correct — they must wait for an admin to approve them via `PUT /api/users/:userId/role`. On success (non-pending, correct credentials), signs a JWT and returns token + profile.

- **Handler:** `async (req, res) => { ... }`
- **Request body:**
  - `username`: Account name (`string`, required).
  - `password`: Plain-text password to compare against the stored hash (`string`, required).
- **Success response (200):** `{ success: true, token: <JWT string>, user: { userId, username, role } }`
- **Validation error (400):** `{ success: false, message: 'Username is required.' }` or `{ success: false, message: 'Password is required.' }` — missing/invalid input.
- **Unauthorized (401):** `{ success: false, message: 'Invalid credentials.' }` — wrong username or password.
- **Forbidden (403):** `{ success: false, message: 'Tu cuenta está pendiente de aprobación por un administrador.' }` — credentials are correct but the user's role is `'pending'`; no JWT is issued until an admin changes their role via `PUT /api/users/:userId/role`.
- **Error response (500):** `{ success: false, message: 'Internal server error' }`

#### `GET /me` — Return the authenticated user's profile

Protected endpoint that requires a valid Bearer token. The `authMiddleware` middleware verifies and decodes the JWT before this handler executes, populating `req.user`. The handler simply returns the decoded payload as the user profile — no additional database query is performed because all needed fields (`userId`, `username`, `role`) are already present in the token payload.

- **Middleware:** `authMiddleware` — verifies Bearer JWT; returns 401 on any authentication failure.
- **Handler:** `(req, res) => { ... }` (synchronous — no database call).
- **Request headers:**
  - `Authorization: Bearer <JWT>` (required).
- **Success response (200):** `{ success: true, user: { userId, username, role } }`
- **Unauthorized (401):** Various messages depending on the auth failure type (handled by upstream `authMiddleware`).

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `default` | `express.Router()` | Router instance with 3 authentication endpoints mounted at `/api/auth` via `server.js` |

---

## 📄 `health.js`

Express router dedicated to TCP-based service health checks against GPU compute servers. Default-exports an Express `Router` with two POST endpoints that leverage the `healthChecker.js` utility (in `backend/services/`) to probe the reachability of long-running network services hosted on each PC's configured IP address and ports. Both endpoints are protected by `authMiddleware` (JWT-based authentication) — any authenticated user may invoke health checks. Uses double ObjectId protection: a preemptive `isValidObjectId()` check before database access, plus a Mongoose `CastError` fallback in the catch block — consistent with conventions established in `pcs.js`. Error responses follow the `{ success: false, message }` envelope pattern shared across all route modules.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `express` | `express` (default) | External |
| `mongoose` | `isValidObjectId` (named) | External |
| `../models/PC.js` | `PC` (default) | Internal |
| `../services/healthChecker.js` | `checkPcServices`, `checkAllServices` (named) | Internal |
| `../middleware/auth.js` | `authMiddleware` (named) | Internal |

### Router endpoints

#### `POST /pcs/:pcId` — Health-check services on a single PC

Validates the PC ObjectId parameter, looks up the PC document from MongoDB (404 if not found), then delegates to `checkPcServices()` which iterates the embedded `servicios` array performing per-port TCP probes. Returns structured status data for each service. Protected by `authMiddleware` — requires any authenticated user.

- **Middleware:** `authMiddleware` — verifies Bearer JWT; returns 401 on authentication failure.
- **Handler:** `async (req, res) => { ... }`
- **Parameters:**
  - `params.pcId`: MongoDB ObjectId string of the target PC.
- **Double ObjectId protection:** Preemptive `isValidObjectId(pcId)` check rejects malformed IDs with a 400 response before any database query. A catch-block fallback handles Mongoose `CastError` if one slips through for any reason.
- **Success response (200):** `{ success: true, data: { pcId, id, services: [{ index, nombre, puerto, status }] } }` — per-service TCP probe results from `checkPcServices()`.
- **Bad request (400):** `{ success: false, message: 'Invalid PC ID' }` — invalid ObjectId format caught by either the pre-check or CastError fallback.
- **Not found (404):** `{ success: false, message: 'PC not found' }` — no PC document matches the given `_id`.
- **Error response (500):** `{ success: false, message: 'Internal server error' }` — unexpected errors are logged via `console.error('[health] ...')` and returned with a safe message.

#### `POST /all` — Health-check services across the entire fleet

Fetches every PC document via `PC.find()` and delegates to `checkAllServices()` which runs `checkPcServices()` on each PC concurrently using `Promise.allSettled`. Individual failures do not abort the sweep — they are wrapped with an `error` field in the per-PC result. Returns an array of per-PC health summaries for the entire monitored fleet. Protected by `authMiddleware` — requires any authenticated user.

- **Middleware:** `authMiddleware` — verifies Bearer JWT; returns 401 on authentication failure.
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
