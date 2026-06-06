# `models`

> Path: `backend/models/`
> Last updated: 2026-06-03
> Type: Leaf folder

Mongoose schema definitions for the Express backend. Contains data models that map to MongoDB collections, implementing validation at both field-level and document-level for GPU server infrastructure entities.

---

## 📄 `PC.js`

Mongoose model for a GPU server (PC). Defines two schemas — a subdocument schema for network services and a top-level schema for the PC itself — with custom validators ensuring that total GPU allocation never exceeds available VRAM. Exports a single default Mongoose model bound to the `pcs` collection. The schema is configured with `toJSON: { virtuals: true }` and `toObject: { virtuals: true }`, enabling the `totalGpu` virtual field to serialize automatically in JSON API responses and Node.js instance access.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `mongoose` | `mongoose` (default) | External |

### Classes / Schemas

#### `serviceSchema` *(Mongoose Subdocument Schema)*

Embedded schema representing a single network service running on a GPU server. Each subdocument stores the service name, listening port, and GPU VRAM allocation in GB. Subdocuments disable their own `_id` field to reduce storage overhead.

**Fields:**

| Field | Type | Constraints |
|-------|------|-------------|
| `nombre` | `String` | Required, trimmed |
| `puerto` | `Number` | Required, min 1, max 65535 |
| `gpu` | `Number` | Required, min 0 |

#### `pcSchema` *(Mongoose Schema)*

Top-level schema for a GPU server entity. Stores the server name, IPv4 address, total VRAM capacity in GB, and an array of embedded `serviceSchema` subdocuments. Includes automatic timestamps (`createdAt`, `updatedAt`) via Mongoose's `timestamps: true` option. Configured with `toJSON: { virtuals: true }` and `toObject: { virtuals: true }` so that the `totalGpu` virtual field serializes in API responses and is accessible on plain object instances.

**Schema options:**

| Option | Value | Purpose |
|--------|-------|---------|
| `timestamps` | `true` | Automatically adds `createdAt` and `updatedAt` fields to every document |
| `toJSON.virtuals` | `true` | Serializes virtual fields (e.g., `totalGpu`) when the document is converted to JSON for API responses |
| `toObject.virtuals` | `true` | Exposes virtual fields on model instances within Node.js context |

**Fields:**

| Field | Type | Constraints |
|-------|------|-------------|
| `nombre` | `String` | Required, trimmed |
| `ip` | `String` | Required, IPv4 regex match (`^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$`) |
| `vram` | `Number` | Required, min 1 |
| `servicios` | `[serviceSchema]` | Array of subdocuments, defaults to `[]` (empty) |

**Virtual fields:**

- **`totalGpu`** — Computed getter that returns the sum of all `gpu` values across `servicios` elements. Null-coalesces missing GPU values to 0. Automatically included in JSON serialization thanks to schema options above.

**Custom validators:**

- **`servicios` document-level validator** — Ensures that `sum(servicios[].gpu) <= pc.vram`. Rejects documents where total GPU allocation exceeds the server's VRAM capacity with message: *"Total GPU usage across services exceeds available VRAM on this server."*

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `default` | `mongoose.model('PC', pcSchema, 'pcs')` | Mongoose model named `'PC'`, bound to MongoDB collection `'pcs'` |

---

## 🔄 Changes in this update

- **Added `toJSON: { virtuals: true }` and `toObject: { virtuals: true }`** to `pcSchema` options (lines 60-61 of source). These directives cause the `totalGpu` virtual field to serialize when documents are returned as JSON by Express route handlers.
- **Added Schema options table** documenting all three Mongoose schema configuration options for `pcSchema`.
