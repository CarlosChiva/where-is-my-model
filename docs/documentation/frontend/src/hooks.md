# `hooks`

> Path: `frontend/src/hooks/`
> Last updated: 2026-06-04
> Type: Leaf folder

Custom React hooks for the GPU Infrastructure Dashboard frontend. Provides data-fetching hooks for loading the master list of GPU servers (`usePcs`) and per-server services (`useServices`), plus six mutation hooks for CRUD operations on PCs and services (create, update, delete). All hooks follow a consistent pattern: they manage `loading` and `error` state, expose an `onSuccess` callback for side effects, and return a simple object with reactive state and a mutation function.

---

## 📄 `usePcs.js`

Fetches and manages the master list of GPU servers. Uses a monotonic fetch counter (`useRef(0)`) to allow concurrent refetches without silently dropping explicit calls — only the response from the most recent fetch updates state. Explicit refetches always win; stale or competing in-flight responses are discarded silently.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `useState`, `useEffect`, `useCallback`, `useRef` | External |
| `../services/pcApi.js` | `fetchPcs` | Internal |

### Functions

- **`usePcs() → { data: Array, loading: boolean, error: string | null, refetch: Function }`**
  Custom hook that fetches all GPU servers. Initializes `data` to `[]`, `loading` to `false`, and `error` to `null`.
  - **Returns:** An object containing:
    - `data`: Array of PC objects (empty while loading or on error)
    - `loading`: Boolean — `true` during in-flight fetch
    - `error`: String or `null` — error message on failure
    - `refetch`: Reference to `fetchPCs` (wrapped in `useCallback`) for manual re-fetching

  **Internal functions:**

  - **`fetchPCs() → Promise<void>`** *(wrapped in `useCallback` with empty deps)*
    Performs the actual fetch using a monotonic counter stored in `fetchCounter` (`useRef(0)`). Increments the counter before each fetch, capturing `currentCounter`. After the async `fetchPcs()` call returns, compares `currentCounter` against `fetchCounter.current`: if they differ, a newer fetch was initiated and the stale response is discarded (early return). On match, updates `data`/`error` state and resets `loading` to `false` in the `finally` block.
    - **Behavior on success:** Sets `data` to `result.data` (or empty array if falsy), clears error.
    - **Behavior on error:** Sets `error` to the error message. Distinguishes between `result.error` (API-level) and caught exceptions (`err instanceof Error ? err.message : String(err)`).
    - **Concurrent fetch handling:** If a new fetch is initiated while an older one is in-flight, the older response is silently discarded at three checkpoints: after the `await`, in the `catch` block, and in the `finally` block (prevents `loading` from being reset prematurely).

  - **`useEffect(() => fetchPCs(), [fetchPCs])`**
    Triggers the initial fetch on component mount. Dependency array includes `fetchPCs` (stable due to `useCallback`), so it runs exactly once.

---

## 📄 `useServices.js`

Fetches the list of services for a specific GPU server. Only triggers a fetch when a valid `pcId` is provided. Initializes `loading` to `false`.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `useState`, `useEffect` | External |
| `../services/serviceApi.js` | `fetchServices` | Internal |

### Functions

- **`useServices(pcId: string) → { data: Array | null, loading: boolean, error: string | null, refetch: Function }`**
  Custom hook that fetches services for a specific GPU server identified by `pcId`. Initializes `loading` to `false`.
  - `pcId`: MongoDB `_id` of the parent PC — triggers the fetch when truthy.
  - **Returns:** An object containing:
    - `data`: Array of services or `null` (while loading)
    - `loading`: Boolean — `true` during in-flight fetch
    - `error`: String or `null`
    - `refetch`: Reference to `execFetch`

  **Internal functions:**

  - **`execFetch() → Promise<void>`**
    Guards with `if (!pcId) return` (skips fetch if no PC context). Otherwise fetches services via `fetchServices(pcId)` and updates state.

  - **`useEffect(() => { if (pcId) execFetch(); }, [pcId])`**
    Triggers fetch whenever `pcId` changes.

---

## 📄 `useCreatePc.js`

Mutation hook for creating a new GPU server. Calls the `createPc` API function and triggers an optional `onSuccess` callback on success. Exposes `clearError` to allow parent components to dismiss stale API errors.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `useState` | External |
| `../services/pcApi.js` | `createPc` | Internal |

### Functions

- **`useCreatePc({ onSuccess }: { onSuccess: Function }) → { loading: boolean, error: string | null, mutate: Function, clearError: Function }`**
  Custom mutation hook for PC creation. Initializes `loading` to `false`.
  - `onSuccess`: Callback invoked after a successful create operation.
  - **Returns:** An object with `loading`, `error`, `mutate`, and `clearError`.

  **Internal functions:**

  - **`mutate(pcData: Object) → Promise<Object>`**
    Creates a new GPU server. Sets `loading=true`, clears error, calls `createPc(pcData)`, handles success/error/exception, invokes `onSuccess` on success, and returns the result (or `{ data: null, error }` on failure).

  - **`clearError() → void`**
    Resets the `error` state to `null`. Used by parent components (e.g., `AddPcModal`) to dismiss stale API error messages when the modal reopens or the user takes action.

---

## 📄 `useCreateService.js`

Mutation hook for adding a service to a GPU server. Calls the `createService` API function and triggers an optional `onSuccess` callback on success. Exposes `clearError` to allow parent components to dismiss stale API errors.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `useState` | External |
| `../services/serviceApi.js` | `createService` | Internal |

### Functions

- **`useCreateService({ onSuccess }: { onSuccess: Function }) → { loading: boolean, error: string | null, mutate: Function, clearError: Function }`**
  Custom mutation hook for service creation. Initializes `loading` to `false`.
  - `onSuccess`: Callback invoked after a successful create operation.
  - **Returns:** An object with `loading`, `error`, `mutate`, and `clearError`.

  **Internal functions:**

  - **`mutate({ pcId: string, data: Object }) → Promise<Object>`**
    Adds a service to a GPU server. Sets `loading=true`, clears error, calls `createService(pcId, data)`, handles success/error/exception, invokes `onSuccess` on success, and returns the result (or `{ data: null, error }` on failure).

  - **`clearError() → void`**
    Resets the `error` state to `null`. Used by parent components (e.g., `AddServiceModal`) to dismiss stale API error messages when the modal reopens or the user takes action.

---

## 📄 `useDeletePc.js`

Mutation hook for deleting a GPU server.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `useState` | External |
| `../services/pcApi.js` | `deletePc` | Internal |

### Functions

- **`useDeletePc({ onSuccess }: { onSuccess: Function }) → { loading: boolean, error: string | null, mutate: Function }`**
  Custom mutation hook for PC deletion. Initializes `loading` to `false`.
  - **Returns:** An object with `loading`, `error`, and `mutate`.

  **Internal functions:**

  - **`mutate(pcId: string) → Promise<Object>`**
    Deletes a GPU server by ID. Calls `deletePc(pcId)`, handles result, invokes `onSuccess` on success.

---

## 📄 `useDeleteService.js`

Mutation hook for removing a service from a GPU server.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `useState` | External |
| `../services/serviceApi.js` | `deleteService` | Internal |

### Functions

- **`useDeleteService({ onSuccess }: { onSuccess: Function }) → { loading: boolean, error: string | null, mutate: Function }`**
  Custom mutation hook for service deletion. Initializes `loading` to `false`.
  - **Returns:** An object with `loading`, `error`, and `mutate`.

  **Internal functions:**

  - **`mutate({ pcId: string, index: number }) → Promise<Object>`**
    Removes a service from a GPU server by index. Calls `deleteService(pcId, index)`, handles result, invokes `onSuccess` on success.

---

## 📄 `useUpdatePc.js`

Mutation hook for updating an existing GPU server.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `useState` | External |
| `../services/pcApi.js` | `updatePc` | Internal |

### Functions

- **`useUpdatePc({ onSuccess }: { onSuccess: Function }) → { loading: boolean, error: string | null, mutate: Function, clearError: Function }`**
  Custom mutation hook for PC updates. Initializes `loading` to `false`.
  - `onSuccess`: Callback invoked after a successful update operation.
  - **Returns:** An object with `loading`, `error`, `mutate`, and `clearError`.

  **Internal functions:**

  - **`mutate({ id: string, data: Object }) → Promise<Object>`**
    Updates an existing GPU server. Sets `loading=true`, clears error, calls `updatePc(id, data)`, handles success/error/exception, invokes `onSuccess` on success, and returns the result (or `{ data: null, error }` on failure).

  - **`clearError() → void`**
    Resets the `error` state to `null`. Used by parent components (e.g., `EditPcModal`) to dismiss stale API error messages when the modal reopens or the user takes action.

---

## 📄 `useUpdateService.js`

Mutation hook for editing a service on a GPU server. Calls the `updateService` API function and triggers an optional `onSuccess` callback on success. Exposes `clearError` to allow parent components to dismiss stale API errors.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `useState` | External |
| `../services/serviceApi.js` | `updateService` | Internal |

### Functions

- **`useUpdateService({ onSuccess }: { onSuccess: Function }) → { loading: boolean, error: string | null, mutate: Function, clearError: Function }`**
  Custom mutation hook for service updates. Initializes `loading` to `false`.
  - `onSuccess`: Callback invoked after a successful update operation.
  - **Returns:** An object with `loading`, `error`, `mutate`, and `clearError`.

  **Internal functions:**

  - **`mutate({ pcId: string, index: number, data: Object }) → Promise<Object>`**
    Edits an existing service on a GPU server. Sets `loading=true`, clears error, calls `updateService(pcId, index, data)`, handles success/error/exception, invokes `onSuccess` on success, and returns the result (or `{ data: null, error }` on failure).

  - **`clearError() → void`**
    Resets the `error` state to `null`. Used by parent components (e.g., `EditServiceModal`) to dismiss stale API error messages when the modal reopens or the user takes action.

---

## 🔄 Changes in this update

- **Created** `hooks.md` as a new leaf folder document for `frontend/src/hooks/`. Documents all 8 React hooks: `usePcs` and `useServices` (data fetching), plus `useCreatePc`, `useCreateService`, `useDeletePc`, `useDeleteService`, `useUpdatePc`, `useUpdateService` (CRUD mutations).
- **Documented fix** in `usePcs.js`: the `loading` state is initialized to `false` (line 15, `useState(false)`), correcting a prior bug where `useState(true)` would permanently block the first fetch on mount via the debounce guard `if (loading) return`.

### T6 — useCreatePc clearError export
- **Updated** `useCreatePc.js` return object: now exports `clearError` function alongside `loading`, `error`, and `mutate`.
- **Added** `clearError()` internal function documentation: resets the `error` state to `null`, used by parent components (e.g., `AddPcModal`) to dismiss stale API error messages.
- **Updated** return type signature to `{ loading: boolean, error: string | null, mutate: Function, clearError: Function }`.

### T7 — useUpdatePc clearError export
- **Updated** `useUpdatePc.js` return object: now exports `clearError` function alongside `loading`, `error`, and `mutate`.
- **Added** `clearError()` internal function documentation: resets the `error` state to `null`, used by parent components (e.g., `EditPcModal`) to dismiss stale API error messages.
- **Updated** return type signature to `{ loading: boolean, error: string | null, mutate: Function, clearError: Function }`.
- **Updated** `mutate()` description: now includes `setLoading(true)`, `clearError()`, and error handling details matching actual implementation.

### T9 — useCreateService clearError export
- **Updated** `useCreateService.js` return object: now exports `clearError` function alongside `loading`, `error`, and `mutate`.
- **Added** `clearError()` internal function documentation: resets the `error` state to `null`, used by parent components (e.g., `AddServiceModal`) to dismiss stale API error messages.
- **Updated** return type signature to `{ loading: boolean, error: string | null, mutate: Function, clearError: Function }`.
- **Updated** `mutate()` description: now includes `setLoading(true)`, `setError(null)`, error handling details matching actual implementation.
- **Updated** function description: now mentions `clearError` export for dismissing stale API errors, consistent with `useCreatePc` and `useUpdatePc`.

### T10 — useUpdateService clearError export
- **Updated** `useUpdateService.js` return object: now exports `clearError` function alongside `loading`, `error`, and `mutate`.
- **Added** `clearError()` internal function documentation: resets the `error` state to `null`, used by parent components (e.g., `EditServiceModal`) to dismiss stale API error messages.
- **Updated** return type signature to `{ loading: boolean, error: string | null, mutate: Function, clearError: Function }`.
- **Updated** `mutate()` description: now includes `setLoading(true)`, `setError(null)`, error handling details matching actual implementation.
- **Updated** function description: now mentions `clearError` export for dismissing stale API errors, consistent with `useCreatePc`, `useCreateService`, and `useUpdatePc`.
