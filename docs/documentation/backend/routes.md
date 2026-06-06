# `routes`

> Path: `backend/routes/`
> Last updated: 2026-06-05
> Type: Leaf folder

Express route modules for the API server. Each file exports a single `express.Router()` instance with RESTful endpoints, unified error handling, and standardized `{ success, data? }` response envelopes.

---

## 📄 `pcs.js`

REST router for PC CRUD operations against MongoDB. Default-exports an Express `Router` with five endpoints covering list, retrieve, create, update, and delete operations on GPU server entities. All responses follow a standard envelope: `{ success: boolean, data?: any, message?: string, errors?: string[] }`. Mongoose validation errors are caught and extracted into a human-readable array; CastError exceptions (invalid ObjectId format) return 400 with a descriptive message; generic errors are logged to console and returned as 500 with a safe message.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `express` | `express` (default) | External |
| `../models/PC.js` | `PC` (default) | Internal |
| `../middleware/validation.js` | `validatePcBody` (named) | Internal |

### Router endpoints

#### `GET /` — List all PCs

Returns every PC document from the `pcs` collection as a lean (plain-object) array.

- **Handler:** `async (req, res) => { ... }`
- **Success response (200):** `{ success: true, data: [...] }` — array of PC plain objects with all schema fields (virtual fields like `totalGpu` are not included).
- **Error response (500):** `{ success: false, message: 'Internal server error' }`

#### `GET /:id` — Get single PC by ID

Retrieves a single PC document by MongoDB `_id`. Uses `PC.findById()` followed by `.lean()` to return a plain JavaScript object instead of a full Mongoose Document. This is consistent with the `GET /` endpoint, which also uses `.lean()`. As a result, virtual fields (including `totalGpu`) are **not** included in the response.

- **Handler:** `async (req, res) => { ... }`
- **Parameters:**
  - `params.id`: MongoDB ObjectId string.
- **Success response (200):** `{ success: true, data: { <PC plain object — no virtual fields> } }`
- **Bad request (400):** `{ success: false, message: 'Invalid PC ID format.' }` — CastError from invalid ObjectId string
- **Not found (404):** `{ success: false, message: 'PC not found' }`
- **Error response (500):** `{ success: false, message: 'Internal server error' }`

#### `POST /` — Create new PC

Creates a new PC document. Accepts `nombre`, `ip`, and `vram` from the request body. The `servicios` field defaults to an empty array via the Mongoose schema definition.

- **Middleware:** `validatePcBody` — validates request body before handler execution (checks `nombre` non-empty string, `ip` valid IPv4 format with octet range 0-255, `vram` number ≥ 1).
- **Handler:** `async (req, res) => { ... }`
- **Request body:**
  - `nombre`: Server name (`string`, required by model).
  - `ip`: IPv4 address (`string`, required, validated by schema regex).
  - `vram`: Total VRAM capacity in GB (`number`, required).
- **Success response (201):** `{ success: true, data: { <saved PC document> } }`
- **Validation error (400):** `{ success: false, errors: [string, ...] }` — array of validation messages from `validatePcBody` middleware or Mongoose validation errors.
- **Error response (500):** `{ success: false, message: 'Internal server error' }`

#### `PUT /:id` — Update existing PC

Updates metadata fields (`nombre`, `ip`, `vram`) of an existing PC. Runs Mongoose validators on the updated fields via `{ runValidators: true }`. Returns the updated document with `{ new: true }`.

- **Middleware:** `validatePcBody` — validates request body before handler execution (checks `nombre` non-empty string, `ip` valid IPv4 format with octet range 0-255, `vram` number ≥ 1).
- **Handler:** `async (req, res) => { ... }`
- **Parameters:**
  - `params.id`: MongoDB ObjectId string.
- **Request body:**
  - `nombre`: Updated server name (`string`).
  - `ip`: Updated IPv4 address (`string`).
  - `vram`: Updated VRAM capacity in GB (`number`).
- **Success response (200):** `{ success: true, data: { <updated PC document> } }`
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

REST router for embedded Service CRUD operations within a given PC. Default-exports an Express `Router` with four endpoints covering list, create, update, and delete operations on the `pc.servicios[]` subdocument array. Services are identified by **array index** (not ObjectId) because they are defined with `_id: false` in the Mongoose schema. All mutations use live Mongoose documents (non-lean) so that `.save()` triggers the document-level GPU-cap validator (`path('servicios')` validator enforcing `sum(gpu) ≤ vram`). Responses follow the same envelope as `pcs.js`: `{ success: boolean, data?: ..., errors?: string[], message?: string }`. CastError exceptions (invalid ObjectId format) are caught and return 400 with a descriptive message.

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

Pushes a new service subdocument (`nombre`, `puerto`, `gpu`, `assignedGpu`) onto the PC's `servicios` array, then calls `pc.save()` which fires the document-level validator checking that `sum(servicios[].gpu) ≤ pc.vram`. Returns 201 on success; returns 400 with an errors array if the GPU cap is exceeded (caught as `ValidationError`). The `assignedGpu` field identifies which of the PC's GPUs the service is bound to, enabling per-GPU capacity tracking.

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
