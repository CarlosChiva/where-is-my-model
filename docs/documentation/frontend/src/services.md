# `services`

> Path: `frontend/src/services`
> Last updated: 2026-07-11
> Type: Leaf folder

General purpose client-side service layer for the frontend application. This folder encapsulates all HTTP communication with the backend API, providing a lightweight fetch-based client (`apiClient`) and four domain-specific API wrappers: `pcApi` for PC management, `serviceApi` for service/lifecycle management, `healthApi` for health-check operations on PCs, and `authApi` for user authentication (register, login, profile retrieval). Together they form the data-access boundary of the frontend.

---

## 📄 `apiClient.js`

Low-level HTTP request wrapper built on top of the browser's native `fetch` API. Normalizes headers, body serialization, error handling, and response parsing into a uniform `{ data, error }` shape so callers never need to deal with raw `Response` objects. Does not import any external modules — only uses global browser APIs (`Headers`, `fetch`, `localStorage`). Handles automatic JWT Bearer token injection: reads the `"token"` key from `localStorage` and attaches it as an `Authorization: Bearer <token>` header on every outgoing request.

### Functions

- **`_request(url: string, options: RequestInit) → Promise<{ data: any | null, error: string | null }>`** *(private / internal)*
  Core async function that performs the actual HTTP call. Applies a default JSON content type, stringifies non-string request bodies, and normalizes both successful and failed responses into a consistent `{ data, error }` envelope.
  - `url`: full URL (including the `/api` base path) to call.
  - `options`: standard `fetch` options object (`method`, `body`, etc.).
  - **Returns:** a Promise resolving to an object with `data` (parsed JSON or `null`) and `error` (status text / error message or `null`).

  **Authentication header injection** (added):
  Before sending the request, `_request()` reads a JWT token from `localStorage` under the key `"token"`. If a token is present, it attaches an `Authorization: Bearer <token>` header to the outgoing request. If no token exists in `localStorage`, the request proceeds without an `Authorization` header. Because all four exported convenience methods (`get`, `post`, `put`, `del`) delegate through `_request()`, every API call automatically includes the bearer token when a session is active.

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

## 📄 `authApi.js`

Thin authentication API service layer that wraps three backend auth endpoints using the existing `apiClient` module. Exposes user registration, login, and profile retrieval as simple functions following the same `{ data, error }` envelope pattern used by all other service files in this folder.

### Imports and dependencies

| Module          | Imported elements       | Type      |
|-----------------|-------------------------|-----------|
| `./apiClient`   | `get`, `post`           | Internal  |

### Functions

- **`register(username: string, password: string) → Promise<{ data: any \| null, error: string \| null }>`** *(exported)*
  Registers a new user on the backend by sending credentials to the `/auth/register` endpoint.
  - `username`: desired login name for the new account.
  - `password`: password for authentication.
  - **Returns:** `{ data, error }` with the server's registration response or an error message.

- **`login(username: string, password: string) → Promise<{ data: any \| null, error: string \| null }>`** *(exported)*
  Authenticates an existing user by sending credentials to the `/auth/login` endpoint.
  - `username`: registered login name.
  - `password`: account password.
  - **Returns:** `{ data, error }` with authentication result (typically a token or session object) or an error message.

- **`getMe() → Promise<{ data: any \| null, error: string \| null }>`** *(exported)*
  Retrieves the currently authenticated user's profile information from the `/auth/me` endpoint.
  - **Returns:** `{ data, error }` with the current user object or an error message.

---

## Inter-file relationships

```
┌─────────────────────┐
│    apiClient.js     │  ← low-level HTTP wrapper
│  (get / post/put/del)│
└────────┬────────────┘
         │ imported by
    ┌────┴──────────┐    │
    │                │    │
    ▼                ▼    ▼
┌─────────┐ ┌──────────────┐  ┌──────────┐
│ pcApi.js│ │serviceApi.js │  │authApi.js│  ← domain-specific layers
└─────────┘ └──────────────┘  └──────────┘
    CRUD              CRUD          Auth (3 endpoints)
```

- `apiClient.js` is the **foundation**: zero external imports, pure-fetch abstraction.
- `pcApi.js`, `serviceApi.js`, and `authApi.js` are **thin wrappers** that map domain concepts onto REST endpoints via `apiClient`. They add no extra logic beyond URL composition.
- No inter-dependencies between domain modules; each depends exclusively on `apiClient`.

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
| `/pcs/:pcId/services/:index`    | DELETE   | `deleteService(pcId, index)`       |
| `/auth/register`                | POST     | `register(username, password)`     |
| `/auth/login`                   | POST     | `login(username, password)`        |
| `/auth/me`                      | GET      | `getMe()`                          |

---

## 🔄 Changes in this update

- **Added** full documentation for the new file `authApi.js`:
  - Imports (`get`, `post` from `./apiClient`).
  - Three exported functions: `register(username, password)`, `login(username, password)`, and `getMe()`.
  - All follow the standard `{ data, error }` response envelope via `apiClient` delegation.
- **Updated** general description: now mentions four domain-specific API wrappers (added `authApi` for user authentication).
- **Updated** inter-file relationships diagram: added `authApi.js` node with label "Auth (3 endpoints)".
- **Updated** API surface summary table: added three rows for `/auth/register`, `/auth/login`, and `/auth/me`.

---

### Changes from JWT token injection update

- **Updated** file-level description for `apiClient.js`: now mentions that the module handles automatic JWT Bearer token injection using `localStorage`.
- **Updated** `_request()` function documentation: added a dedicated "Authentication header injection" paragraph describing the new behavior — reads the `"token"` key from `localStorage` and attaches `Authorization: Bearer <token>` on every outgoing request.
- **Noted** that all four exported convenience methods (`get`, `post`, `put`, `del`) inherit this authentication behavior since they all delegate through `_request()`.
- **Updated** the list of global browser APIs used by `apiClient.js` to include `localStorage` alongside `Headers` and `fetch`.
