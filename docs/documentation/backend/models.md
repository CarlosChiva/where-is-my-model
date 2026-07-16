# `models`

> Path: `backend/models/`
> Last updated: 2026-07-16 (Task 21 — TOTP 2FA fields)
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
| `PASSWORD_REGEX` | `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{12,}$/` | Regex enforcing password complexity: minimum 12 characters with at least one lowercase letter, one uppercase letter, one digit, and one special character (`@$!%*?&#`) |

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
| `password` | `String` | Required, minlength 12, custom regex validator (`PASSWORD_REGEX`) enforcing complexity (uppercase, lowercase, digit, special character), `select: false`. Runs before the bcrypt `pre('save')` hook. Error messages: *"Password is required."*, *"Password must be at least 12 characters long."*, *"Password does not meet complexity requirements."* |
| `role` | `String` | Enum `['admin', 'user', 'pending']`, defaults to `'user'` |
| `totpSecret` | `String` | Optional, sparse-indexed (indexed only when present), `select: false` — stores the base32 TOTP secret generated during 2FA setup. Excluded from queries by default; must be explicitly requested via `.select('+totpSecret')` |
| `totpEnabled` | `Boolean` | Defaults to `false` — flag indicating whether two-factor authentication has been verified and activated for this user. Becomes `true` only after a successful TOTP code verification via `POST /api/auth/2fa/verify` |

**Hooks:**

- **Custom field validator on `password`** — Synchronous validation runs *before* the pre-save hook: `PASSWORD_REGEX.test(v)` is invoked via the schema's `validate.validator` callback. Enforces that the password contains at least 12 characters and includes all four character classes (lowercase, uppercase, digit, special). On failure returns the message *"Password does not meet complexity requirements."* — this acts as a schema-level safety net complementing the route-level guard in `auth.js`.
- **`pre('save')`** — Asynchronous pre-save middleware that runs *after* schema validation. If the `password` field has not been modified, skips hashing entirely (preserves efficiency on non-password updates). Otherwise: generates a salt using `bcryptjs.genSalt(SALT_ROUNDS)`, hashes the plain-text password via `bcryptjs.hash()`, and stores the result back on the document. Errors are passed to `next(err)` rather than swallowed.

**Instance methods:**

- **`comparePassword(plainText: string) → Promise<boolean>`**
  Compares a plain-text password against the stored bcrypt hash using `bcryptjs.compare()`. Returns a promise that resolves to `true` if the passwords match, `false` otherwise. Designed to be called after loading a user document with `.select('password')`.

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `default` | `mongoose.model('User', userSchema, 'users')` | Mongoose model named `'User'`, bound to MongoDB collection `'users'` |


## 📄 `RefreshToken.js`

Mongoose model for tracking JWT refresh tokens in a dedicated MongoDB collection. Enables the two-token (short-lived access token + long-lived refresh token) rotation architecture introduced in Task 14. Each issued refresh token is persisted as a document with revocation and expiration metadata, allowing the `/api/auth/refresh` endpoint to verify its validity before issuing new tokens. Bound to the `refreshTokens` collection. Timestamps are enabled automatically.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `mongoose` | `mongoose` (default) | External |

### Classes / Schemas

#### `refreshTokenSchema` *(Mongoose Schema)*

Schema for a persisted refresh-token record. Each document stores the associated user ID, the raw JWT string, an absolute expiration date, and revocation flags. A compound index on `{ userId, revoked, expiresAt }` optimizes queries that look for active tokens belonging to a specific user.

**Schema options:**

| Option | Value | Purpose |
|--------|-------|---------|
| `timestamps` | `true` | Automatically adds `createdAt` and `updatedAt` fields to every document |

**Fields:**

| Field | Type | Constraints |
|-------|------|-------------|
| `userId` | `mongoose.Schema.Types.ObjectId` | Required, references `'User'`, indexed. Links the refresh token to its owner. |
| `token` | `String` | Required, unique. Stores the raw JWT string (not a hash) so it can be looked up by value during rotation. |
| `expiresAt` | `Date` | Required, indexed. Absolute expiration timestamp computed at creation time (`Date.now() + refreshMs`). |
| `revoked` | `Boolean` | Defaults to `false`, indexed. When set to `true`, the token is no longer valid for rotation. |
| `revokedAt` | `Date` | Optional. Set when `revoked` transitions to `true`; records the timestamp of revocation. |

**Indexes:**

- Individual indexes on `userId`, `expiresAt`, and `revoked`.
- Compound index: `{ userId: 1, revoked: 1, expiresAt: -1 }` — optimizes lookups for active tokens by user, sorted newest-first.

**Instance methods:**

- **`isValid() → boolean`**
  Returns `true` only if the token has not been revoked (`!this.revoked`) AND its expiration date is in the future (`this.expiresAt > new Date()`). Used by the `/api/auth/refresh` handler before issuing rotated tokens.

**Static methods:**

- **`findByToken(tokenValue: string) → Promise<RefreshToken | null>`**
  Convenience query alias for `this.findOne({ token: tokenValue })`. Called during the refresh flow to look up whether a presented JWT exists in the collection and is still valid.

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `default` | `mongoose.model('RefreshToken', refreshTokenSchema, 'refreshTokens')` | Mongoose model named `'RefreshToken'`, bound to MongoDB collection `'refreshTokens'` |

---

## 🔄 Changes in this update

- **Replaced monolithic `vram` field with multi-GPU `gpus[]` array** — The PC schema previously had a single `vram: Number` field representing the total VRAM capacity of the server. This has been replaced by `gpus: Array<{ name: String, vram: Number }>` which allows defining multiple GPUs per server, each with its own name and VRAM capacity.
- **Added `assignedGpu` field to `serviceSchema`** — Each service subdocument now carries an `assignedGpu: Number` (required, min 0) that indicates the zero-based index of the GPU to which this service is pinned.
- **Replaced `totalGpu` virtual with `gpuUsage` virtual** — The old `totalGpu` virtual was a single number (sum of all service GPU usage). It has been replaced by `gpuUsage`, a computed array that provides a per-GPU breakdown: `{ gpuIndex, name, totalVram, usedVram }`. This permits the consumer to see which specific GPU is over-utilized.
- **Added `gpus` field-level validator** — A new custom validator on the `gpus` path enforces that at least one GPU must be defined for every PC document.
- **Rewrote `servicios` document-level validator** — The old validator compared total GPU usage against a single `vram` cap. The new validator performs two checks: (1) rejects services referencing non-existent GPU indices and (2) verifies per-GPU allocation does not exceed that GPU's VRAM capacity.
- **Added optional HTTP health-check fields to `serviceSchema`** — Three new optional fields were added to support a two-layer HTTP health-check system: `endpoint` (String, nullable), `host` (String, nullable), and `protocol` (enum `'http'`/`'https'`, defaults to `'http'`). These allow each service to advertise an external health-check probe URL (`{protocol}://{host}{endpoint}`).
- **T003 — Added `User.js` model** — New Mongoose schema for application authentication. Defines three fields: `username` (unique, trimmed, 3–64 chars), `password` (required, minlength 8, `select: false` to prevent accidental exposure), and `role` (enum `['admin', 'user']`, defaults to `'user'`). Includes a `pre('save')` hook that hashes the password using `bcryptjs` with 10 salt rounds (skips hashing if password is unmodified). Provides an instance method `comparePassword(plainText)` for login verification. Model is bound to the MongoDB collection `'users'`.
- **T1 — Extended `role` enum with `'pending'`** — The `role` field in the `User` schema was updated from `['admin', 'user']` to `['admin', 'user', 'pending']`, allowing users to be created in a provisional state before full activation.

## 🔄 Changes in this update

- **Password complexity hardening on `User.js`:**
  - **Added `PASSWORD_REGEX` constant:** New top-level constant `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{12,}$/` enforcing that passwords contain at least 12 characters with all four character classes: lowercase, uppercase, digit, and special character (`@$!%*?&#`).
  - **Changed `password.minlength` from 8 to 12:** The minimum length constraint was raised from 8 to 12 characters. Error message updated accordingly.
  - **Added custom schema validator on `password`:** New `validate: { validator, message }` block using `PASSWORD_REGEX.test(v)`. This runs before the bcrypt `pre('save')` hook — it acts as a second defense layer (the first is the synchronous route guard in `auth.js`). Returns *"Password does not meet complexity requirements."* on failure. This provides multi-layer validation: (1) sync guard in auth route, (2) Mongoose schema validator, (3) client-side indicator in LoginPage.jsx.

## 🔄 Changes in this update

- **Task 14 — Added `RefreshToken.js` model:** New Mongoose schema for the two-token rotation architecture. Each issued refresh token is persisted in a dedicated `refreshTokens` collection with five fields: `userId` (required, ObjectId ref to `'User'`, indexed), `token` (required, unique string storing the raw JWT), `expiresAt` (required, absolute expiration timestamp, indexed), `revoked` (Boolean, defaults `false`, indexed), and `revokedAt` (optional Date). A compound index `{ userId: 1, revoked: 1, expiresAt: -1 }` optimizes lookups for active tokens by user. Provides an instance method `isValid()` returning true only if not revoked AND expiration is in the future, and a static method `findByToken(tokenValue)` as a convenience alias for `findOne({ token })`. Timestamps are enabled automatically. Model is bound to the MongoDB collection `'refreshTokens'`.

## 🔄 Changes in this update

- **Task 21 — Added TOTP 2FA fields to `User.js`:** Two new optional schema fields support time-based one-time password authentication:
  - **`totpSecret` (String, sparse, `select: false`):** Stores the base32-encoded TOTP secret generated during setup. Sparse indexing means only users with a set value consume index space. Like `password`, this field is excluded from queries by default and must be explicitly projected via `.select('+totpSecret')` when needed (setup, verify, disable flows).
  - **`totpEnabled` (Boolean, default: `false`):** Flag that transitions to `true` only after a successful TOTP code verification via `POST /api/auth/2fa/verify`. This distinguishes between "secret provisioned but not yet confirmed" (`totpSecret` set, `totpEnabled: false`) and "fully active 2FA" (both fields populated). The login flow in `auth.js` checks this flag to decide whether to intercept with a 403 `2FA_REQUIRED` response.
