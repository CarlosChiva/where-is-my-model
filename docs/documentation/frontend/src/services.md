# `services`

> Path: `frontend/src/services`
> Last updated: 2026-06-07
> Type: Leaf folder

General purpose client-side service layer for the frontend application. This folder encapsulates all HTTP communication with the backend API, providing a lightweight fetch-based client (`apiClient`) and two domain-specific API wrappers (`pcApi` for PC management and `serviceApi` for service/lifecycle management). Together they form the data-access boundary of the frontend.

---

## 📄 `apiClient.js`

Low-level HTTP request wrapper built on top of the browser's native `fetch` API. Normalizes headers, body serialization, error handling, and response parsing into a uniform `{ data, error }` shape so callers never need to deal with raw `Response` objects. Does not import any external modules — only uses global browser APIs (`Headers`, `fetch`).

### Functions

- **`_request(url: string, options: RequestInit) → Promise<{ data: any | null, error: string | null }>`** *(private / internal)*
  Core async function that performs the actual HTTP call. Applies a default JSON content type, stringifies non-string request bodies, and normalizes both successful and failed responses into a consistent `{ data, error }` envelope.
  - `url`: full URL (including the `/api` base path) to call.
  - `options`: standard `fetch` options object (`method`, `body`, etc.).
  - **Returns:** a Promise resolving to an object with `data` (parsed JSON or `null`) and `error` (status text / error message or `null`).

- **`get(endpoint: string) → Promise<{ data: any | null, error: string | null }>`** *(exported)*
  Convenience wrapper for HTTP GET. Prepends the `/api` base to the given relative `endpoint`.
  - `endpoint`: relative path (e.g. `/pcs`, `/tokens`).
  - **Returns:** same `{ data, error }` envelope as `_request`.

- **`post(endpoint: string, body: any) → Promise<{ data: any | null, error: string | null }>`** *(exported)*
  Convenience wrapper for HTTP POST. Prepends `/api`, sets JSON content type, and sends `body`.
  - `endpoint`: relative path to create a resource at.
  - `body`: payload object (auto-serialized to JSON by `_request`).
  - **Returns:** same `{ data, error }` envelope.

- **`put(endpoint: string, body: any) → Promise<{ data: any | null, error: string | null }>`** *(exported)*
  Convenience wrapper for HTTP PUT / full resource replacement.
  - `endpoint`: relative path to the target resource.
  - `body`: updated payload object.
  - **Returns:** same `{ data, error }` envelope.

- **`del(endpoint: string) → Promise<{ data: any | null, error: string | null }>`** *(exported)*
  Convenience wrapper for HTTP DELETE.
  - `endpoint`: relative path to the resource to remove.
  - **Returns:** same `{ data, error }` envelope.

### Constants

| Constant   | Value     | Description                                      |
|------------|-----------|--------------------------------------------------|
| `API_BASE` | `/api`    | Base URL prefix prepended to every request path. |

---

## 📄 `pcApi.js`

Domain-level API functions for managing "PC" (personal computer / device) entities. Each function delegates to the corresponding method on `apiClient`. All RPCs target the `/pcs` resource group on the backend.

### Imports and dependencies

| Module          | Imported elements       | Type      |
|-----------------|-------------------------|-----------|
| `./apiClient`   | `get`, `post`, `put`, `del` | Internal |

### Functions

- **`fetchPcs() → Promise<{ data: any | null, error: string | null }>`** *(exported)*
  Retrieves the full list of PCs from the backend.
  - **Returns:** `{ data, error }` where `data` is the list of PC objects (or whatever the server returns).

- **`createPc(data: any) → Promise<{ data: any | null, error: string | null }>`** *(exported)*
  Creates a new PC resource on the backend.
  - `data`: payload containing the fields for the new PC.
  - **Returns:** `{ data, error }` with the created resource or an error message.

- **`updatePc(id: string | number, data: any) → Promise<{ data: any | null, error: string | null }>`** *(exported)*
  Updates an existing PC identified by `id`.
  - `id`: unique identifier of the PC to update.
  - `data`: updated fields payload.
  - **Returns:** `{ data, error }` with the updated resource or an error message.

- **`deletePc(id: string | number) → Promise<{ data: any | null, error: string | null }>`** *(exported)*
  Deletes a PC identified by `id`.
  - `id`: unique identifier of the PC to delete.
  - **Returns:** `{ data, error }` (data is typically `null` for deletions).

---

## 📄 `serviceApi.js`

Domain-level API functions for managing "services" associated with a specific PC. Each RPC targets the `/pcs/{pcId}/services` sub-resource on the backend. A service is identified within its parent PC by a positional `index` rather than an independent UUID.

### Imports and dependencies

| Module          | Imported elements       | Type      |
|-----------------|-------------------------|-----------|
| `./apiClient`   | `get`, `post`, `put`, `del` | Internal |

### Functions

- **`fetchServices(pcId: string | number) → Promise<{ data: any | null, error: string | null }>`** *(exported)*
  Retrieves the list of services belonging to a given PC.
  - `pcId`: identifier of the parent PC.
  - **Returns:** `{ data, error }` where `data` is the list of service objects.

- **`createService(pcId: string | number, data: any) → Promise<{ data: any | null, error: string | null }>`** *(exported)*
  Creates a new service under the specified PC.
  - `pcId`: identifier of the parent PC.
  - `data`: payload describing the new service.
  - **Returns:** `{ data, error }` with the created resource or an error message.

- **`updateService(pcId: string | number, index: number, data: any) → Promise<{ data: any | null, error: string | null }>`** *(exported)*
  Updates a service at position `index` within the given PC's service list.
  - `pcId`: identifier of the parent PC (appears in two positions on the call stack — once here and once in the URL path).
  - `index`: positional index of the service to update (integer).
  - `data`: updated fields payload.
  - **Returns:** `{ data, error }` with the updated resource or an error message.

- **`deleteService(pcId: string | number, index: number) → Promise<{ data: any | null, error: string | null }>`** *(exported)*
  Deletes a service at position `index` within the given PC's service list.
  - `pcId`: identifier of the parent PC.
  - `index`: positional index of the service to remove.
  - **Returns:** `{ data, error }` (data is typically `null` for deletions).

---

## Inter-file relationships

```
┌─────────────────────┐
│    apiClient.js     │  ← low-level HTTP wrapper
│  (get / post/put/del)│
└────────┬────────────┘
         │ imported by
   ┌─────┴──────┐
   │            │
   ▼            ▼
┌─────────┐ ┌──────────────┐
│ pcApi.js│ │serviceApi.js │  ← domain-specific CRUD layer
└─────────┘ └──────────────┘
```

- `apiClient.js` is the **foundation**: zero external imports, pure-fetch abstraction.
- `pcApi.js` and `serviceApi.js` are **thin wrappers** that map domain concepts (PCs, Services) onto REST endpoints via `apiClient`. They add no extra logic beyond URL composition.
- Neither domain module depends on the other; both depend exclusively on `apiClient`.

---

## API surface summary

| Endpoint pattern                | Method   | pcApi / serviceApi function  |
|---------------------------------|----------|-----------------------------|
| `/pcs`                          | GET      | `fetchPcs()`                |
| `/pcs`                          | POST     | `createPc(data)`            |
| `/pcs/:id`                      | PUT      | `updatePc(id, data)`        |
| `/pcs/:id`                      | DELETE   | `deletePc(id)`              |
| `/pcs/:pcId/services`           | GET      | `fetchServices(pcId)`       |
| `/pcs/:pcId/services`           | POST     | `createService(pcId, data)` |
| `/pcs/:pcId/services/:index`    | PUT      | `updateService(pcId, index, data)` |
| `/pcs/:pcId/services/:index`    | DELETE   | `deleteService(pcId, index)`
