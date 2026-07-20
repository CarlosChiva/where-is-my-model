# `utils`

> Path: `backend/utils/`
> Last updated: 2026-07-18 (Task 17 — Add Request ID tracking)
> Type: Leaf folder

Shared utility modules for structural backend logging infrastructure. Centralizes the Pino logger configuration, HTTP request/response middleware, sensitive-data sanitization, and distributed-tracing request ID generation so that structured logs are emitted consistently across all application layers with correlation IDs for request tracing.

---

## 📄 `logger.js`

Centralized logging module responsible for creating a shared Pino logger instance, configuring redaction of sensitive fields, providing an `pino-http` middleware factory for Express HTTP request/response logging, and stripping sensitive query parameters from logged URLs before serialization. Exports both default (the base `logger` instance) and named exports (`createHttpLogger`, `sanitizeUrl`).

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `node:crypto` | `crypto` (namespace) | External (Node.js built-in) |
| `pino` | `default` (namespace) | External |
| `pino-http` | `default` (namespace) | External |

### Constants

- **`isProduction: boolean`** — Truthy when `process.env.NODE_ENV === 'production'`. Controls log verbosity (`debug` in dev, `info` in production) and whether a pretty-print transport is attached.
- **`SENSITIVE_QUERY_PARAMS: Set<string>`** — Immutable set containing names of query parameters that must be stripped from logged URLs: `'password'`, `'token'`, `'accessToken'`, `'refreshToken'`, `'authorization'`, `'auth'`.
- **`VALID_UUID_RE: RegExp`** — Regular expression matching standard RFC 4122 UUID format (`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$` with case-insensitive flag). Used by the `genReqId` callback to validate whether an incoming `X-Request-ID` header should be trusted and reused for distributed tracing.

### Functions

- **`sanitizeUrl(url: string) → string`**
  Strips sensitive query parameters from a URL before it is logged. Parses the URL with `new URL()` (using `'http://localhost'` as fallback base), deletes any search parameter whose lower-cased key exists in `SENSITIVE_QUERY_PARAMS`, and returns the cleaned pathname + remaining query string + hash. If parsing fails, returns the original URL verbatim.
  - `url`: The raw request URL string (e.g., `'/api/auth/login?token=abc'`).
  - **Returns:** The sanitized URL string (e.g., `'/api/auth/login'`).

- **`createHttpLogger() → middleware`**
  Factory function that returns a configured `pino-http` Express middleware. The middleware:
  — reuses the shared `logger` instance for consistent structured output;
  — enables `wrapSerializers: true` to merge custom serialization with defaults;
  — **generates/reuses a request ID via `genReqId(req, _res)` callback** (Task 17): reads the `X-Request-ID` header from the incoming request; if present and its value passes the RFC 4122 UUID validation (`VALID_UUID_RE.test(existing)`), that existing ID is returned and reused by pino-http (which assigns it to `req.id`). If absent or invalid, a new UUID is generated via `crypto.randomUUID()`;
  — uses `customSuccessObject` and `customErrorObject` callbacks to replace the raw URL with a sanitized version via `sanitizeUrl()` — ensuring sensitive query params never appear in access logs;
  — appends the matched Express route path as a `route` field on every log line (via `req.route?.path`), enabling request-to-route tracing.
  - **Returns:** An HTTP logging middleware function compatible with `app.use()`.

### Pino base logger (default export)

A singleton Pino instance shared across the application. Configuration:

| Option | Value(s) | Purpose |
|--------|----------|---------|
| `name` | `'where-is-my-model'` | Logger identifier appearing in every JSON log line |
| `level` | `'debug'` (dev) / `'info'` (prod) | Log verbosity threshold controlled by `NODE_ENV` |
| `redact.paths` | `['password', 'token', 'accessToken', 'refreshToken', 'authorization', 'cookie', 'req.query.password', 'req.query.token', 'req.query.accessToken', 'req.query.refreshToken']` | Field paths automatically replaced with `[Redacted]` in structured output |
| `redact.censor` | `'[Redacted]'` | Replacement string for redacted values |
| `base.env` | `process.env.NODE_ENV || 'development'` | Injects environment name into every log entry |
| `transport` | `'pino-pretty'` (dev only) / `undefined` (prod) | Human-readable colored output in development; JSON-only for production performance |

## 🔄 Changes in this update

- **Task 17 — Request ID tracking integration:** Added `crypto` import from `node:crypto`. New constant `VALID_UUID_RE` (RFC 4122 UUID regex pattern) validates incoming `X-Request-ID` headers. The `createHttpLogger()` factory now includes a `genReqId(req, _res)` callback: it checks if the request carries an `X-Request-ID` header value that matches the RFC 4122 pattern; if valid, that UUID is reused by pino-http (assigned to `req.id`) for distributed-tracing correlation. If absent or invalid, a fresh `crypto.randomUUID()` is generated. Updated folder description and function documentation accordingly.
