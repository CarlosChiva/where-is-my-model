# `models`

> Path: `backend/models/`
> Last updated: 2026-07-11
> Type: Leaf folder

Mongoose schema definitions for the Express backend. Contains data models that map to MongoDB collections, implementing validation at both field-level and document-level for GPU server infrastructure entities. The single model defined here manages multi-GPU servers with per-GPU VRAM allocation tracking across assigned network services.

---

## 📄 `PC.js`

Mongoose model for a GPU server (PC). Defines two schemas — a subdocument schema for network services and a top-level schema for the PC itself — with custom validators ensuring that per-GPU allocation never exceeds available VRAM and that no service references a non-existent GPU index. Exports a single default Mongoose model bound to the `pcs` collection. The schema is configured with `toJSON: { virtuals: true }` and `toObject: { virtuals: true }`, enabling the `gpuUsage` virtual field to serialize automatically in JSON API responses and Node.js instance access.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `mongoose` | `mongoose` (default) | External |

### Classes / Schemas

#### `serviceSchema` *(Mongoose Subdocument Schema)*

Embedded schema representing a single network service running on a GPU server. Each subdocument stores the service name, listening port, VRAM demand in GB, and the index of the GPU it is assigned to. Subdocuments disable their own `_id` field to reduce storage overhead.

**Fields:**

| Field | Type | Constraints |
|-------|------|-------------|
| `nombre` | `String` | Required, trimmed |
| `puerto` | `Number` | Required, min 1, max 65535 |
| `gpu` | `Number` | Required, min 0 — VRAM demand in GB |
| `assignedGpu` | `Number` | Required, min 0 — zero-based index into the parent PC's `gpus` array |
| `endpoint` | `String` | Optional, defaults to `null` — path portion of the HTTP health-check URL |
| `host` | `String` | Optional, defaults to `null` — hostname or IP for external health checks |
| `protocol` | `String` | Optional, enum `['http', 'https']`, defaults to `'http'` — protocol used for health-check requests |

#### `pcSchema` *(Mongoose Schema)*

Top-level schema for a GPU server entity. Stores the server name, IPv4 address, an array of GPU definitions (each with a name and VRAM capacity), and an array of embedded `serviceSchema` subdocuments. Includes automatic timestamps (`createdAt`, `updatedAt`) via Mongoose's `timestamps: true` option. Configured with `toJSON: { virtuals: true }` and `toObject: { virtuals: true }` so that the `gpuUsage` virtual field serializes in API responses and is accessible on plain object instances.

**Schema options:**

| Option | Value | Purpose |
|--------|-------|---------|
| `timestamps` | `true` | Automatically adds `createdAt` and `updatedAt` fields to every document |
| `toJSON.virtuals` | `true` | Serializes virtual fields (e.g., `gpuUsage`) when the document is converted to JSON for API responses |
| `toObject.virtuals` | `true` | Exposes virtual fields on model instances within Node.js context |

**Fields:**

| Field | Type | Constraints |
|-------|------|-------------|
| `nombre` | `String` | Required, trimmed |
| `ip` | `String` | Required, IPv4 regex match (`^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$`) |
| `gpus` | `Array<{ name: String, vram: Number }>` | Array of inline GPU definitions; defaults to `[]`; each entry requires `name` (String) and `vram` (Number, min 1) |
| `servicios` | `[serviceSchema]` | Array of service subdocuments, defaults to `[]` (empty) |

**Virtual fields:**

- **`gpuUsage`** — Computed getter that returns an array with one entry per GPU index. Each entry contains `{ gpuIndex, name, totalVram, usedVram }`, where `usedVram` is the sum of `gpu` values across all services assigned to that GPU index (`assignedGpu === idx`). Null-coalesces missing GPU values to 0. Automatically included in JSON serialization thanks to schema options above.

**Custom validators:**

- **`gpus` field-level validator** (line 85) — Ensures the `gpus` array contains at least one element. Non-array inputs are passed through to let Mongoose's built-in type validation handle them. Error message: *"At least one GPU must be defined for this server."*

- **`servicios` document-level validator** (line 117) — Two-phase check:
  1. Rejects any service whose `assignedGpu` is out of bounds relative to the length of the `gpus` array (catches stale references after GPU removal).
  2. For each GPU index `i`, computes the sum of `gpu` values for all services assigned to that GPU and verifies it does not exceed `gpus[i].vram`. Rejects if any GPU is over-allocated.
  - Error message: *"GPU allocation exceeds capacity on one or more GPUs, or references a non-existent GPU."*

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `default` | `mongoose.model('PC', pcSchema, 'pcs')` | Mongoose model named `'PC'`, bound to MongoDB collection `'pcs'` |

---

## 📄 `User.js`

Mongoose model for application authentication. Defines a user entity with password hashing via `bcryptjs`, role-based access (admin / user / pending), and a pre-save hook that automatically hashes plain-text passwords before persistence. The `password` field is excluded from query results by default (`select: false`) to prevent accidental exposure. Schema virtuals are enabled in both JSON serialization and plain-object conversion.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `mongoose` | `mongoose` (default) | External |
| `bcryptjs` | `bcryptjs` (default namespace) | External |

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `SALT_ROUNDS` | `10` | Number of bcrypt salt rounds used for password hashing |

### Classes / Schemas

#### `userSchema` *(Mongoose Schema)*

Schema for authenticated users. Each document stores a unique username, a bcrypt-hashed password, and an access role (`admin`, `user`, or `pending`). Timestamps are enabled automatically. The password field is deselected by default in queries (`select: false`) so it must be explicitly requested via `.select('password')` — this prevents accidental leakage in list or profile endpoints.

**Schema options:**

| Option | Value | Purpose |
|--------|-------|---------|
| `timestamps` | `true` | Automatically adds `createdAt` and `updatedAt` fields to every document |
| `toJSON.virtuals` | `true` | Serializes virtual fields when the document is converted to JSON for API responses |
| `toObject.virtuals` | `true` | Exposes virtual fields on model instances within Node.js context |

**Fields:**

| Field | Type | Constraints |
|-------|------|-------------|
| `username` | `String` | Required, unique, trimmed, minlength 3, maxlength 64. Error messages: *"Username is required."*, *"Username must be at least 3 characters long."*, *"Username must not exceed 64 characters."* |
| `password` | `String` | Required, minlength 8, `select: false`. Error messages: *"Password is required."*, *"Password must be at least 8 characters long."* |
| `role` | `String` | Enum `['admin', 'user', 'pending']`, defaults to `'user'` |

**Hooks:**

- **`pre('save')`** — Asynchronous pre-save middleware. If the `password` field has not been modified, skips hashing entirely (preserves efficiency on non-password updates). Otherwise: generates a salt using `bcryptjs.genSalt(SALT_ROUNDS)`, hashes the plain-text password via `bcryptjs.hash()`, and stores the result back on the document. Errors are passed to `next(err)` rather than swallowed.

**Instance methods:**

- **`comparePassword(plainText: string) → Promise<boolean>`**
  Compares a plain-text password against the stored bcrypt hash using `bcryptjs.compare()`. Returns a promise that resolves to `true` if the passwords match, `false` otherwise. Designed to be called after loading a user document with `.select('password')`.

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `default` | `mongoose.model('User', userSchema, 'users')` | Mongoose model named `'User'`, bound to MongoDB collection `'users'` |


## 🔄 Changes in this update

- **Replaced monolithic `vram` field with multi-GPU `gpus[]` array** — The PC schema previously had a single `vram: Number` field representing the total VRAM capacity of the server. This has been replaced by `gpus: Array<{ name: String, vram: Number }>` which allows defining multiple GPUs per server, each with its own name and VRAM capacity.
- **Added `assignedGpu` field to `serviceSchema`** — Each service subdocument now carries an `assignedGpu: Number` (required, min 0) that indicates the zero-based index of the GPU to which this service is pinned.
- **Replaced `totalGpu` virtual with `gpuUsage` virtual** — The old `totalGpu` virtual was a single number (sum of all service GPU usage). It has been replaced by `gpuUsage`, a computed array that provides a per-GPU breakdown: `{ gpuIndex, name, totalVram, usedVram }`. This permits the consumer to see which specific GPU is over-utilized.
- **Added `gpus` field-level validator** — A new custom validator on the `gpus` path enforces that at least one GPU must be defined for every PC document.
- **Rewrote `servicios` document-level validator** — The old validator compared total GPU usage against a single `vram` cap. The new validator performs two checks: (1) rejects services referencing non-existent GPU indices and (2) verifies per-GPU allocation does not exceed that GPU's VRAM capacity.
- **Added optional HTTP health-check fields to `serviceSchema`** — Three new optional fields were added to support a two-layer HTTP health-check system: `endpoint` (String, nullable), `host` (String, nullable), and `protocol` (enum `'http'`/`'https'`, defaults to `'http'`). These allow each service to advertise an external health-check probe URL (`{protocol}://{host}{endpoint}`).
- **T003 — Added `User.js` model** — New Mongoose schema for application authentication. Defines three fields: `username` (unique, trimmed, 3–64 chars), `password` (required, minlength 8, `select: false` to prevent accidental exposure), and `role` (enum `['admin', 'user']`, defaults to `'user'`). Includes a `pre('save')` hook that hashes the password using `bcryptjs` with 10 salt rounds (skips hashing if password is unmodified). Provides an instance method `comparePassword(plainText)` for login verification. Model is bound to the MongoDB collection `'users'`.
- **T1 — Extended `role` enum with `'pending'`** — The `role` field in the `User` schema was updated from `['admin', 'user']` to `['admin', 'user', 'pending']`, allowing users to be created in a provisional state before full activation.
