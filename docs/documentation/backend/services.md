# `services`

> Path: `backend/services`
> Last updated: 2026-07-19 (email verification feature fully removed — emailService.js deleted, nodemailer dependency removed)
> Type: Leaf folder

 Contains application-level service utilities for the backend: a health-checking module that probes TCP ports and optional HTTP endpoints of managed PCs and their embedded services (`healthChecker.js`). Outbound connections from the health checker are protected against Server-Side Request Forgery (SSRF) via pre-connection DNS resolution and IP validation (`ssrfProtection.js`).



## 📄 `healthChecker.js`

Core health-probing module. Performs two-tier availability checks on registered machines: a first pass using raw TCP socket connections (via the `net` module), and an optional second pass using native `fetch()` with configurable timeout to verify that an HTTP endpoint actually responds with a valid status code. Designed to be fleet-aware — it can check one PC's services or all PCs in parallel without any single failure aborting the sweep.

Every outbound connection is preceded by an SSRF guard: `resolveAndValidate()` from `ssrfProtection.js` resolves the target hostname to its IP address and validates it against denylist (loopback, private, link-local, etc.) and optional allowlist ranges. If validation fails, the check resolves immediately with `status: 'down'`. On success, the resolved IP — not the original hostname — is used for the actual TCP connection, preventing DNS rebinding attacks.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `net` | `createConnection` (implicit via namespace) | External (Node.js built-in) |
| *(builtin)* | `fetch`, `AbortController`, `Promise.allSettled` | External (Node.js / global) |
| `../middleware/ssrfProtection.js` | `resolveAndValidate` (named) | Internal |

### Functions

- **`checkHttpEndpoint(host: string, port: number | string, endpoint: string, protocol: string) → Promise<boolean>`**
  Sends an HTTP GET probe to `protocol://host:port/endpoint` using native `fetch()` with a 3-second timeout enforced via `AbortController`. Returns `true` when the response status is between 200 and 399 (inclusive). Logs a warning and returns `false` on any failure.

  - `host`: hostname or IP of the target machine.
  - `port`: port number to connect to.
  - `endpoint`: path suffix appended to the base URL (e.g., `/health`).
  - `protocol`: `'http'` or `'https'`; defaults are handled by callers.
  - **Returns:** `true` if the endpoint responded with a 2xx/3xx status; `false` otherwise.

- **`checkServiceStatus(host: string, port: number | string, endpoint: string | null, protocol: string) → Promise<{ port: number, status: 'up' | 'down' }>`**
  Opens a TCP socket to `{ host, port }` with a 3-second timeout. Before attempting the connection, calls `resolveAndValidate(host)` to resolve the hostname and check the IP against SSRF denylist/allowlist rules. If validation fails (IP is on denylist or not in allowlist), resolves immediately with `status: 'down'` — no network I/O occurs. On success, uses the **resolved IP address** for the actual TCP connection (not the original hostname) to prevent DNS rebinding between validation and connect time. If an `endpoint` is given, performs a two-tier check by additionally calling `checkHttpEndpoint()` with the resolved IP. Timeout or socket errors resolve with `status: 'down'`.

  - `host`: hostname or IP of the target machine.
  - `port`: port number to probe.
  - `endpoint`: optional path for HTTP validation; `null` skips the second tier.
  - `protocol`: defaults to `'http'` when omitted.
  - **Returns:** `{ port, status }` — `status` is `'up'` if both TCP and (optionally) HTTP checks pass after SSRF validation, `'down'` otherwise.

- **`checkPcServices(pcDoc: object) → Promise<{ pcId: string | null, id: any, services: Array<{ index, nombre?, puerto, status, reason? }> }>`**
  Iterates over the `servicios` embedded array of a single PC document. For each service it resolves the effective host (`svc.host ?? pcDoc.ip ?? pcDoc.nombre`) and port, then delegates to `checkServiceStatus()`. Services missing both host and port short-circuit with `'down'` and reason `'missing-host-or-port'`. All checks run in parallel via `Promise.allSettled()` so a single malformed entry does not poison the batch. SSRF validation occurs inside `checkServiceStatus()` for every service probe.

  - `pcDoc`: a PC document (Mongoose doc or plain object) expected to have `_id` or `id`, `ip`, `nombre`, and an embedded `servicios` array where each element may contain `host`, `puerto`/`port`, `endpoint`, and `protocol`.
  - **Returns:** an object with the PC identifier(s) and a list of per-service health results.

- **`checkAllServices(pcsArray: Array<object>) → Promise<Array<{ pcId, id, services, error?, pcDocIndex }>>`**
  Orchestrates fleet-wide health checks. Maps every element of `pcsArray` through `checkPcServices()`, wrapping each call in a try/catch and attaching the original array index as `pcDocIndex`. Outer resolution is via `Promise.allSettled()` — rejected or thrown individual PC checks are captured with an `error` field rather than aborting the sweep.

  - `pcsArray`: array of PC documents (Mongoose docs or plain objects).
  - **Returns:** array of per-PC result envelopes, one for each input element, sorted in original order.

### SSRF integration notes

The SSRF protection is integrated at the lowest level (`checkServiceStatus`) so that every outbound probe — whether invoked from `checkPcServices()` or `checkAllServices()` — automatically benefits from it without callers needing to do anything. The three-stage safety chain:

1. **DNS resolution:** `resolveAndValidate(host)` calls Node.js `dns.lookup()` fresh on every invocation (no IP caching).
2. **IP validation:** Resolved IP is checked against a hard denylist (loopback, private RFC 1918, link-local, reserved ranges) and an optional allowlist (`HEALTH_CHECK_ALLOWED_NETWORKS` env var). Denied connections short-circuit to `status: 'down'`.
3. **IP-based connection:** On validation success, the resolved IP is used directly in `net.createConnection()` — not the original hostname — preventing DNS rebinding where the hostname might resolve differently between validation and actual connect time.

## 🔄 Changes in this update

- **Task 12 — SSRF protection integrated into healthChecker.js:** Added `import { resolveAndValidate } from '../middleware/ssrfProtection.js'`. Updated `checkServiceStatus()` to call `resolveAndValidate(host)` before opening any TCP socket. On SSRF denial, the function resolves immediately with `{ port, status: 'down' }`. On validation success, the resolved IP address (not the original hostname) is passed to both `net.createConnection()` and `checkHttpEndpoint()`, preventing DNS rebinding attacks between validation and connection time. Updated imports table and file-level description to reflect SSRF capabilities and the new internal dependency on `ssrfProtection.js`.

---

## 🔄 Changes in this update

- **Task 15 — Bug fix: `emailService.js` import path corrected:** The Logger import on line 2 was changed from `'../../utils/logger.js'` (incorrect, one directory level too deep) to `'../utils/logger.js'` (correct relative path from `backend/services/`). This bug was blocking the entire auth router (`routes/auth.js`) from loading during dynamic import in `server.js:RegisterRoutes()`, which in turn prevented the `/api/auth/*` endpoints from being registered — effectively disabling registration, login, and all authentication flows at startup. The fix ensures the module resolves cleanly on import. Full documentation for `emailService.js` added to this file, including both exported functions (`getTransporter()` and `sendVerificationEmail()`) with parameter types, return types, and behavioral descriptions covering lazy transport caching, graceful SMTP degradation, and verification email construction.

## 🔄 Changes in this update

- **Email verification feature fully removed:** The entire email verification subsystem has been deleted from the project:
  - **`emailService.js` deleted entirely** — the file no longer exists. It previously provided `getTransporter()` (lazy Nodemailer transport) and `sendVerificationEmail()` for sending bilingual verification links during user registration. All full documentation of its functions has been removed from this file.
  - **Folder-level description updated** — removed references to "SMTP-based email delivery module" and "graceful degradation when SMTP is not configured."
  - The only remaining service in this folder is `healthChecker.js`.
