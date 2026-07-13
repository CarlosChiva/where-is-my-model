# `hooks`

> Path: `frontend/src/hooks/`
> Last updated: 2026-07-13 (useServiceHealth — auto-check removed)
> Type: Leaf folder

Custom React hooks for the GPU Infrastructure Dashboard frontend. Provides data-fetching hooks for loading the master list of GPU servers (`usePcs`), per-server services (`useServices`), and the application user list (`useUsers`), eight mutation hooks for CRUD operations on PCs, services, and users (create, update, delete, role management), and a health-monitoring hook for per-service TCP status (`useServiceHealth`). Most CRUD hooks follow a consistent pattern: they manage `loading` and `error` state, expose an `onSuccess` callback for side effects, and return a simple object with reactive state and a mutation function. The two list-fetching hooks (`usePcs`, `useUsers`) share an identical monotonic fetch-counter staleness guard to prevent race conditions on rapid refetches.

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

  - **`useEffect(() => { const storedToken = localStorage.getItem('token'); if (storedToken) { fetchPCs(); } }, [fetchPCs])`**
    Triggers the initial fetch on component mount **only if an authentication token is present in `localStorage`**. This defensive check prevents premature 401 errors when the hook mounts before the user has authenticated. Dependency array includes `fetchPCs` (stable due to `useCallback`), so it runs exactly once on mount.

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

## 📄 `useServiceHealth.js`

Centralized per-service TCP health status manager. Maintains a flat map keyed by `"pcId---serviceIndex"` with values `'up'`, `'down'`, or `null` (not yet checked). Self-contained — accepts no props. Tracks loading state per-PC using a `Set` of in-flight `pcId`s, exposing `isPcLoading(pcId)` and `anyPcLoading()` helpers for granular per-server loading indicators. Uses `Set`-based per-PC loading tracking (no global `loading` boolean and no monotonic request counter). Auto-check on mount has been **removed entirely** — initial health check is now coordinated from `App.jsx` using a one-time ref guard.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `useState`, `useCallback` | External |
| `../services/healthApi.js` | `checkPcHealth` | Internal |

### Functions

- **`useServiceHealth() → { statuses: Object, isPcLoading: Function, anyPcLoading: Function, checkSinglePc: Function, checkAll: Function }`**
  Custom hook that manages TCP health status for all services across the fleet. Initializes `statuses` to `{}` and `loadingPcs` to a new `Set()`. Does **not** fire an auto-check on mount — that responsibility has been delegated to `App.jsx`.
  - **Returns:** An object containing:
    - `statuses`: Flat map of `"pcId---serviceIndex": 'up' | 'down' | null`
    - `isPcLoading`: Function to check if a specific PC's health check is in-flight
    - `anyPcLoading`: Function to check if any PC's health check is in-flight
    - `checkSinglePc`: Function to re-check a single GPU server's services
    - `checkAll`: Function to re-check multiple servers concurrently

  **Internal functions:**

  - **`flattenResults(data: Array) → Object`**
    Parses the backend array response into a flat `{ key: status }` map. Iterates over each entry's `services` array, constructing keys as `` `${entry.pcId}---${svc.index}` ``. Defaults to `'down'` when `svc.status` is falsy. Returns empty object if input is not an array.

  - **`checkSinglePc(pcId: string) → Promise<void>`** *(wrapped in `useCallback` with empty deps)*
    Hits the backend for a single server's health status via `checkPcHealth(pcId)`. Guards with `if (!pcId) return`. On call, adds `pcId` to the `loadingPcs` Set. On error or success, removes `pcId` from the Set. On success, merges new results into `statuses` using a functional updater with `flattenResults([result.data])` to normalize the single-entry response.

  - **`checkAll(pcIds: Array) → Promise<void>`** *(wrapped in `useCallback` with `[checkSinglePc]` deps)*
    Accepts an array of `pcId`s and fires `checkSinglePc(id)` for each concurrently. Guards with `if (!Array.isArray(pcIds) || pcIds.length === 0) return`. Maps over `pcIds` to produce an array of promises, then returns `Promise.allSettled(promises)`. Each `pcId` is tracked individually in `loadingPcs`.

  - **`isPcLoading(pcId: string) → boolean`** *(wrapped in `useCallback` with `[loadingPcs]` deps)*
    Helper that returns `true` if `loadingPcs.has(pcId)`. Used by components to show per-server loading spinners.

  - **`anyPcLoading() → boolean`** *(wrapped in `useCallback` with `[loadingPcs]` deps)*
    Helper that returns `true` if `loadingPcs.size > 0`. Used by components to show a global "checking health" banner.

  - **Auto-check removed** — the former `useEffect` with `mountedRef` that called `checkAll()` on mount (effectively a no-op) has been deleted. A comment placeholder (`/* AUTO-CHECK REMOVED: App.jsx handles initial health check instead. */`) remains at line 74 for documentation purposes.

---

### T12 — Re-read and verification pass (2026-06-07)

- Re-read all 8 source files in `frontend/src/hooks/` to verify documentation accuracy.
- Confirmed that signatures, return types, imports, and behavioral descriptions match the current codebase with no drift.
- No structural or functional changes detected since last update.

---

## 📄 `useUsers.js`

Fetches and manages the list of application users (for Admin Panel functionality). Uses a monotonic fetch counter (`useRef(0)`) to allow concurrent refetches without silently dropping explicit calls — only the response from the most recent fetch updates state. Explicit refetches always win; stale or competing in-flight responses are discarded silently. Follows the exact same pattern as `usePcs.js`.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `useState`, `useEffect`, `useCallback`, `useRef` | External |
| `../services/userApi.js` | `fetchUsers` | Internal |

### Functions

- **`useUsers() → { data: Array, loading: boolean, error: string \| null, refetch: Function }`**
  Custom hook that fetches all registered application users. Initializes `data` to `[]`, `loading` to `false`, and `error` to `null`.
  - **Returns:** An object containing:
    - `data`: Array of user objects (empty while loading or on error)
    - `loading`: Boolean — `true` during in-flight fetch
    - `error`: String or `null` — error message on failure
    - `refetch`: Reference to `fetchUsersList` (wrapped in `useCallback`) for manual re-fetching

  **Internal functions:**

  - **`fetchUsersList() → Promise<void>`** *(wrapped in `useCallback` with empty deps)*
    Performs the actual fetch using a monotonic counter stored in `fetchCounter` (`useRef(0)`). Increments the counter before each fetch, capturing `currentCounter`. After the async `fetchUsers()` call returns, compares `currentCounter` against `fetchCounter.current`: if they differ, a newer fetch was initiated and the stale response is discarded (early return). On match, updates `data`/`error` state and resets `loading` to `false` in the `finally` block.
    - **Behavior on success:** Sets `data` to `result.data` (or empty array if falsy), clears error.
    - **Behavior on error:** Sets `error` to the error message. Distinguishes between `result.error` (API-level) and caught exceptions (`err instanceof Error ? err.message : String(err)`).
    - **Concurrent fetch handling:** If a new fetch is initiated while an older one is in-flight, the older response is silently discarded at three checkpoints: after the `await`, in the `catch` block, and in the `finally` block (prevents `loading` from being reset prematurely).

  - **`useEffect(() => fetchUsersList(), [fetchUsersList])`**
    Triggers the initial fetch on component mount. Dependency array includes `fetchUsersList` (stable due to `useCallback`), so it runs exactly once.

---

## 📄 `useUpdateUserRole.js`

Mutation hook for changing an application user's role. Calls the `updateUserRole` API function from `userApi` and triggers an optional `onSuccess` callback on success. Follows the same pattern as other mutation hooks in this folder: manages `loading` and `error` state via `useState`, uses a try/catch/finally block for robust error handling, and guards the `onSuccess` callback invocation with a null check.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `useState` | External |
| `../services/userApi.js` | `updateUserRole` | Internal |

### Functions

- **`useUpdateUserRole({ onSuccess }: { onSuccess: Function }) → { loading: boolean, error: string \| null, mutate: Function, clearError: Function }`**
  Custom mutation hook for updating a user's role. Initializes `loading` to `false`, `error` to `null`.
  - `onSuccess`: Optional callback invoked after a successful role update.
  - **Returns:** An object with `loading`, `error`, `mutate`, and `clearError`.

  **Internal functions:**

  - **`mutate(userId: string, role: string) → Promise<Object>`**
    Changes the role of an existing user. Sets `loading=true`, clears error, calls `updateUserRole(userId, role)`, handles result errors (`result.error`) and caught exceptions (`err instanceof Error ? err.message : String(err)`), invokes `onSuccess` on success (guarded by `if (result && !result.error && onSuccess)`), and returns the result or `{ data: null, error }` on failure.

  - **`clearError() → void`**
    Resets the `error` state to `null`. Used by parent components (e.g., Admin Panel role management UI) to dismiss stale API error messages.

---

## 📄 `useDeleteUser.js`

Mutation hook for deleting a user account. Follows the same pattern as `useDeletePc` and `useDeleteService`: manages `loading` and `error` state via `useState`, uses a try/catch/finally block for robust error handling, guards the `onSuccess` callback invocation, and returns `{ data: null, error }` on failure. Exposes `clearError` (added in T10) to allow parent components (AdminPanel) to dismiss stale API errors — e.g., after closing a delete confirmation dialog.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `useState` | External |
| `../services/userApi.js` | `deleteUser` | Internal |

### Functions

- **`useDeleteUser({ onSuccess }: { onSuccess: Function }) → { loading: boolean, error: string \| null, mutate: Function, clearError: Function }`**
  Custom mutation hook for user deletion. Initializes `loading` to `false`, `error` to `null`.
  - `onSuccess`: Optional callback invoked after a successful delete operation.
  - **Returns:** An object with `loading`, `error`, `mutate`, and `clearError`.

  **Internal functions:**

  - **`mutate(userId: string) → Promise<Object>`**
    Deletes a user account by MongoDB `_id`. Sets `loading=true`, clears error, calls `deleteUser(userId)`, handles result errors (`result.error`) and caught exceptions (`err instanceof Error ? err.message : String(err)`), invokes `onSuccess` on success (guarded by `if (result && !result.error && onSuccess)`), and returns the result or `{ data: null, error }` on failure. Resets `loading=false` in the `finally` block regardless of outcome.

  - **`clearError() → void`**
    Resets the `error` state to `null`. Used by parent components (e.g., AdminPanel) to dismiss stale API error messages — called when closing the delete confirmation dialog so old errors don't persist visually.

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

### T7 — useDeleteUser.js addition (2026-07-12)
- **Added** full documentation for the new file `useDeleteUser.js`:
  - Imports (`useState` from `react`; `deleteUser` from `../services/userApi.js`).
  - Single exported default function: `useDeleteUser({ onSuccess })` returning `{ loading, error, mutate }`.
  - Follows the standard mutation hook pattern matching `useDeletePc` and `useDeleteService`: `useState` for `loading`/`error`, try/catch/finally for async handling, guard-claw on `onSuccess`, returns `{ data: null, error }` fallback on failure.
  - `mutate(userId)` accepts a single user ID string — intended for Admin Panel user deletion workflows.
  - Does **not** expose `clearError` (deletion errors self-clear on subsequent calls; consistent with `useDeletePc` and `useDeleteService` patterns).
- **Updated** general description: now mentions eight mutation hooks (previously seven) to account for the new user deletion capability completing the user CRUD cycle.

### useUpdateUserRole.js addition (2026-07-12)
- **Added** full documentation for the new file `useUpdateUserRole.js`:
  - Imports (`useState` from `react`; `updateUserRole` from `../services/userApi.js`).
  - Single exported default function: `useUpdateUserRole({ onSuccess })` returning `{ loading, error, mutate, clearError }`.
  - Follows the standard mutation hook pattern matching other hooks in this folder: `useState` for `loading`/`error`, try/catch/finally for async handling, guard-claw on `onSuccess`, returns `{ data: null, error }` fallback on failure.
  - `mutate(userId, role)` accepts a user ID string and a role string — intended for Admin Panel role management workflows.
  - Exposes `clearError()` for dismissing stale API errors in parent components.
- **Updated** general description: now mentions seven mutation hooks (six CRUD + one user-role) instead of six.

### useUsers.js addition (2026-07-12)
- **Added** full documentation for the new file `useUsers.js`:
  - Imports (`useState`, `useEffect`, `useCallback`, `useRef` from `react`; `fetchUsers` from `../services/userApi.js`).
  - Single exported default function: `useUsers()` returning `{ data, loading, error, refetch }`.
  - Follows the exact same monotonic fetch-counter staleness guard pattern as `usePcs.js`: a `useRef(0)` counter incremented before each async call; stale responses discarded at three checkpoints (after await, in catch, in finally).
  - Auto-fetches user list on mount via `useEffect`; refetch is exposed via the stable `fetchUsersList` callback.
  - Intended for Admin Panel components that display and manage registered users.
- **Updated** general description: now mentions `useUsers` alongside `usePcs` and `useServices` as list-fetching hooks with shared monotonic counter pattern.

### useServiceHealth.js rewrite (2026-07-13)
- **Complete rewrite** of `useServiceHealth.js`:
  - **Removed** the monotonic request counter (`requestCounter` ref) and the global `loading` boolean. No longer uses stale-response discarding via counter comparison.
  - **Removed** import of `checkAllHealth` from `../services/healthApi.js`. Only `checkPcHealth` is now imported.
  - **Added** `Set`-based per-pcId loading tracking: `loadingPcs` state is a `Set` of pcIds currently being checked, replacing the single `loading: boolean`.
  - **Added** `isPcLoading(pcId) → boolean` helper: returns `loadingPcs.has(pcId)`, enabling per-server loading spinners in components.
  - **Added** `anyPcLoading() → boolean` helper: returns `loadingPcs.size > 0`, enabling a global "checking health" indicator.
  - **Changed** `checkSinglePc(pcId)` to manage loading via Set operations: adds `pcId` on call start, removes it on error or success (both paths delete from Set).
  - **Changed** `checkAll(pcIds)` signature: now accepts an `Array<string>` of pcIds and iterates individually, firing `checkSinglePc(id)` for each via `Promise.allSettled`. Returns early if `pcIds` is not a valid non-empty array. Dependency array is `[checkSinglePc]` (was `[]`).
  - **Changed** return object: now returns `{ statuses, isPcLoading, anyPcLoading, checkSinglePc, checkAll }` instead of `{ statuses, loading, checkSinglePc, checkAll }`.
  - **Auto-check on mount** still present but effectively does nothing: `checkAll()` is called without arguments, and since `checkAll` guards `!Array.isArray(pcIds)`, no health checks fire automatically on mount. The StrictMode guard (`mountedRef`) remains in place.

### useServiceHealth.js — auto-check removed (2026-07-13)
- **Removed** the auto-check `useEffect` and `mountedRef` that were deprecated (the effect was a no-op since `checkAll()` was called with no arguments, which caused an early return).
- **Removed** unused imports: `useEffect` and `useRef` are no longer imported from `react`. Only `useState` and `useCallback` remain.
- **Updated** JSDoc: now clarifies that auto-check is coordinated from `App.jsx` (using a one-time ref guard), not from within the hook itself.
- **Added** a comment placeholder at line 74 (`/* AUTO-CHECK REMOVED: App.jsx handles initial health check instead. */`) for future reference.
- **Per-PC loading via Set-based tracking** remains intact and unchanged from the previous refactor — `loadingPcs`, `isPcLoading()`, and `anyPcLoading()` are unaffected.
