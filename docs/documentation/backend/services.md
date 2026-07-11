# `services`

> Path: `backend/services`
> Last updated: 2026-07-11
> Type: Leaf folder

Contains pure service-layer utilities for the backend — currently a health-checking module that probes TCP ports and optional HTTP endpoints of managed PCs and their embedded services. All functions are dependency-free (only Node.js built-in `net` and native `fetch`).

---

## 📄 `healthChecker.js`

Core health-probing module. Performs two-tier availability checks on registered machines: a first pass using raw TCP socket connections (via the `net` module), and an optional second pass using native `fetch()` with configurable timeout to verify that an HTTP endpoint actually responds with a valid status code. Designed to be fleet-aware — it can check one PC's services or all PCs in parallel without any single failure aborting the sweep.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `net` | `createConnection` (implicit via namespace) | External (Node.js built-in) |
| *(builtin)* | `fetch`, `AbortController`, `Promise.allSettled` | External (Node.js / global) |

### Functions

- **`checkHttpEndpoint(host: string, port: number | string, endpoint: string, protocol: string) → Promise<boolean>`**
  Sends an HTTP GET probe to `protocol://host:port/endpoint` using native `fetch()` with a 3-second timeout enforced via `AbortController`. Returns `true` when the response status is between 200 and 399 (inclusive). Logs a warning and returns `false` on any failure.

  - `host`: hostname or IP of the target machine.
  - `port`: port number to connect to.
  - `endpoint`: path suffix appended to the base URL (e.g., `/health`).
  - `protocol`: `'http'` or `'https'`; defaults are handled by callers.
  - **Returns:** `true` if the endpoint responded with a 2xx/3xx status; `false` otherwise.

- **`checkServiceStatus(host: string, port: number | string, endpoint: string | null, protocol: string) → Promise<{ port: number, status: 'up' | 'down' }>`**
  Opens a TCP socket to `{ host, port }` with a 3-second timeout. If the connection succeeds and no `endpoint` is provided, resolves immediately with `status: 'up'`. If an `endpoint` is given, performs a two-tier check by additionally calling `checkHttpEndpoint()` to validate the HTTP response. Timeout or socket errors resolve with `status: 'down'`.

  - `host`: hostname or IP of the target machine.
  - `port`: port number to probe.
  - `endpoint`: optional path for HTTP validation; `null` skips the second tier.
  - `protocol`: defaults to `'http'` when omitted.
  - **Returns:** `{ port, status }` — `status` is `'up'` if both TCP and (optionally) HTTP checks pass, `'down'` otherwise.

- **`checkPcServices(pcDoc: object) → Promise<{ pcId: string | null, id: any, services: Array<{ index, nombre?, puerto, status, reason? }> }>`**
  Iterates over the `servicios` embedded array of a single PC document. For each service it resolves the effective host (`svc.host ?? pcDoc.ip ?? pcDoc.nombre`) and port, then delegates to `checkServiceStatus()`. Services missing both host and port short-circuit with `'down'` and reason `'missing-host-or-port'`. All checks run in parallel via `Promise.allSettled()` so a single malformed entry does not poison the batch.

  - `pcDoc`: a PC document (Mongoose doc or plain object) expected to have `_id` or `id`, `ip`, `nombre`, and an embedded `servicios` array where each element may contain `host`, `puerto`/`port`, `endpoint`, and `protocol`.
  - **Returns:** an object with the PC identifier(s) and a list of per-service health results.

- **`checkAllServices(pcsArray: Array<object>) → Promise<Array<{ pcId, id, services, error?, pcDocIndex }>>`**
  Orchestrates fleet-wide health checks. Maps every element of `pcsArray` through `checkPcServices()`, wrapping each call in a try/catch and attaching the original array index as `pcDocIndex`. Outer resolution is via `Promise.allSettled()` — rejected or thrown individual PC checks are captured with an `error` field rather than aborting the sweep.

  - `pcsArray`: array of PC documents (Mongoose docs or plain objects).
  - **Returns:** array of per-PC result envelopes, one for each input element, sorted in original order.
