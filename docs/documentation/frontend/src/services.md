# `services`

> Path: `frontend/src/services/`
> Last updated: 2026-06-04
> Type: Leaf folder

API client layer for the GPU Infrastructure Dashboard frontend. Contains a generic HTTP request wrapper (`apiClient.js`) that standardizes JSON serialization, error handling, and response parsing, plus two domain-specific API modules (`pcApi.js` for server CRUD, `serviceApi.js` for per-server service CRUD) that thin-wrap `apiClient` with REST endpoint routing. All functions return the uniform `{ data, error }` envelope used by the custom hooks layer.

---

## 📄 `apiClient.js`

Low-level HTTP request wrapper providing a unified interface for all API communication. Handles Content-Type negotiation, automatic JSON body serialization, response parsing, and consistent error envelope `{ data, error }` for every outcome (success, HTTP error, or network failure).

### Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `API_BASE` | `'/api'` | Base URL prefix prepended to every endpoint path; the backend is proxied under `/api` by Vite's dev server. |

### Internal functions

- **`_request(url: string, options: RequestInit) → Promise<{ data, error }>`**
  Core HTTP request executor. Wraps the native `fetch` API with automatic JSON handling.
  - `url`: The fully-qualified URL (prepended with `API_BASE`).
  - `options`: Standard `fetch` options (method, body, headers, etc.).
  - **Returns:** A Promise resolving to `{ data, error }`:
    - On success: `{ data: <parsed JSON or null>, error: null }`
    - On HTTP error (non-2xx): `{ data: null, error: <message from body or "HTTP <status>"> }`
    - On network error: `{ data: null, error: <err.message> }`
  - **Content-Type handling:** Sets `Content-Type: application/json` automatically unless already present.
  - **Body serialization:** If `options.body` is an object (not a string), it is serialized via `JSON.stringify()`.
  - **Response parsing:** For JSON responses with status 2xx, extracts `response.json().data ?? response.json()`. For 204 or empty responses, returns `{ data: null, error: null }`.

### Functions

- **`get(endpoint: string) → Promise<{ data, error }>`**
  Issues a GET request to `${API_BASE}${endpoint}`.
  - `endpoint`: The REST path (e.g., `'/pcs'`).
  - **Returns:** `{ data, error }` envelope from `_request`.

- **`post(endpoint: string, body: Object) → Promise<{ data, error }>`**
  Issues a POST request to `${API_BASE}${endpoint}` with the given body.
  - `endpoint`: The REST path (e.g., `'/pcs'`).
  - `body`: The data object to send (auto-serialized to JSON).
  - **Returns:** `{ data, error }` envelope from `_request`.

- **`put(endpoint: string, body: Object) → Promise<{ data, error }>`**
  Issues a PUT request to `${API_BASE}${endpoint}` with the given body.
  - `endpoint`: The REST path (e.g., `'/pcs/{id}'`).
  - `body`: The data object to send (auto-serialized to JSON).
  - **Returns:** `{ data, error }` envelope from `_request`.

- **`del(endpoint: string) → Promise<{ data, error }>`**
  Issues a DELETE request to `${API_BASE}${endpoint}`.
  - `endpoint`: The REST path (e.g., `'/pcs/{id}'`).
  - **Returns:** `{ data, error }` envelope from `_request`.

---

## 📄 `pcApi.js`

Thin wrapper around `apiClient` for GPU server (PC) CRUD operations. Maps each function to its corresponding REST endpoint under `/pcs`.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `./apiClient` | `get`, `post`, `put`, `del` | Internal |

### Functions

- **`fetchPcs() → Promise<{ data: Array, error }>`**
  Fetches the complete list of GPU servers.
  - **Endpoint:** `GET /api/pcs`
  - **Returns:** `{ data, error }` envelope.

- **`createPc(data: Object) → Promise<{ data, error }>`**
  Creates a new GPU server.
  - `data`: Server data object (`{ nombre, ip, vram, servicios? }`).
  - **Endpoint:** `POST /api/pcs`
  - **Returns:** `{ data, error }` envelope.

- **`updatePc(id: string, data: Object) → Promise<{ data, error }>`**
  Updates an existing GPU server by ID.
  - `id`: MongoDB ObjectId of the server.
  - `data`: Updated server data object.
  - **Endpoint:** `PUT /api/pcs/{id}`
  - **Returns:** `{ data, error }` envelope.

- **`deletePc(id: string) → Promise<{ data, error }>`**
  Deletes a GPU server by ID.
  - `id`: MongoDB ObjectId of the server.
  - **Endpoint:** `DELETE /api/pcs/{id}`
  - **Returns:** `{ data, error }` envelope.

---

## 📄 `serviceApi.js`

Thin wrapper around `apiClient` for AI service CRUD operations on a specific GPU server. Maps each function to its corresponding REST endpoint under `/pcs/{pcId}/services`.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `./apiClient` | `get`, `post`, `put`, `del` | Internal |

### Functions

- **`fetchServices(pcId: string) → Promise<{ data: Array, error }>`**
  Fetches all AI services running on a specific GPU server.
  - `pcId`: MongoDB ObjectId of the parent server.
  - **Endpoint:** `GET /api/pcs/{pcId}/services`
  - **Returns:** `{ data, error }` envelope.

- **`createService(pcId: string, data: Object) → Promise<{ data, error }>`**
  Adds a new AI service to a GPU server.
  - `pcId`: MongoDB ObjectId of the parent server.
  - `data`: Service data object (`{ nombre, puerto, gpu }`).
  - **Endpoint:** `POST /api/pcs/{pcId}/services`
  - **Returns:** `{ data, error }` envelope.

- **`updateService(pcId: string, index: number, data: Object) → Promise<{ data, error }>`**
  Updates an existing service at the given index on a GPU server.
  - `pcId`: MongoDB ObjectId of the parent server.
  - `index`: Array index of the service in the `servicios` array.
  - `data`: Updated service data object.
  - **Endpoint:** `PUT /api/pcs/{pcId}/services/{index}`
  - **Returns:** `{ data, error }` envelope.

- **`deleteService(pcId: string, index: number) → Promise<{ data, error }>`**
  Removes a service at the given index from a GPU server.
  - `pcId`: MongoDB ObjectId of the parent server.
  - `index`: Array index of the service in the `servicios` array.
  - **Endpoint:** `DELETE /api/pcs/{pcId}/services/{index}`
  - **Returns:** `{ data, error }` envelope.
