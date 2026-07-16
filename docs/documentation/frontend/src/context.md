# `context`

> Path: `frontend/src/context`
> Last updated: 2026-07-16 (Task 6 — httpOnly cookie sameSite fix)
> Type: Leaf folder

React Context layer for global application state that must be shared across the component tree without prop-drilling. Currently holds `AuthContext.jsx`, which provides authentication state management (user identity, loading indicators, and login/logout actions) to any descendant component via a custom `useAuth()` hook. Authentication is entirely cookie-based: the backend issues httpOnly `accessToken` and `refreshToken` cookies; this context manages only the user profile object and session lifecycle by querying `GET /api/auth/me`.

---

## 📄 `AuthContext.jsx`

Central authentication context provider that manages user session lifecycle for the entire application. On mount, it verifies the session by calling `getMe()` — if the httpOnly access cookie is valid, the server returns the user profile; if not, the user is considered unauthenticated. No token is stored client-side (JWTs live exclusively in httpOnly cookies managed by the browser). Exposes four public actions (`login`, `register`, `logout`, `forceLogout`) and derived state (`isAuthenticated`, `isLoading`) through React's context API, consumed via the `useAuth()` custom hook.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `createContext`, `useContext`, `useState`, `useEffect`, `useRef` | External |
| `../services/authApi` | `login as apiLogin`, `register as apiRegister`, `getMe`, `logout as apiLogout` | Internal |

### Classes

#### `AuthContext` *(React Context object via `createContext(null)`)*

The raw context handle that carries authentication state and actions. Created with a `null` default to allow `useAuth()` to throw a clear error when called outside of an `<AuthProvider>` tree.

**Provided value shape:**

| Key | Type | Description |
|-----|------|-------------|
| `user` | `Object \| null` | Current authenticated user object (from the server). |
| `isAuthenticated` | `boolean` | Derived: `Boolean(user)` — truthy if a valid user exists. |
| `isLoading` | `boolean` | True while the initial session verification (`getMe()`) is in flight. |
| `login` | `Function` | Action that authenticates with credentials and sets user state. Backend handles cookie persistence via httpOnly cookies. |
| `register` | `Function` | Action that creates an account. First registration auto-logs in (backend sets cookies + returns user); subsequent registrations return `{ ...result, pending: true }` (no state mutation) — caller must handle admin-approval flow. |
| `logout` | `Function` | Calls the backend to revoke refresh tokens and clear auth cookies, then nullifies local user state. |
| `forceLogout` | `Function` | Synchronously nullifies user state without calling the server. Triggered by the `auth:session-ended` custom event for immediate client-side session termination. |

---

#### `AuthProvider` *(React functional component)*

Provider wrapper component that maintains authentication state using two React hooks (`useState` × 2, `useEffect`, `useRef`). Renders `<AuthContext.Provider>` around `{children}` with the current auth value. Must be mounted at or above the root of any tree that needs access to auth state.

**State variables:**

| Variable | Initial Value | Role |
|----------|---------------|------|
| `user` | `null` | Authenticated user object from the server. |
| `isLoading` | `true` | Blocks child rendering until session verification completes. |

**Internal logic — boot sequence:**

- **`loadUser() → void`** *(async internal function)*
  Session recovery called on mount via `useEffect(() => { void loadUser(); }, [])`. Calls `getMe()` to validate the current cookie-backed session: if `result.error` is truthy, sets `user = null`; otherwise sets `user = result.data`. Guarded by `hasCheckedAuthRef` (`useRef(false)`) to prevent double-execution in React StrictMode. Once `hasCheckedAuthRef.current` is `true`, subsequent calls return immediately.

**Custom event integration:**

- **`auth:session-ended`:** A stable ref (`onSessionEndedRef`) holds a callback that nullifies `user` and sets `isLoading = false`. This listener is registered on mount and removed on unmount. Any part of the application (e.g., an interception layer or polling hook) can trigger an immediate client-side logout by dispatching this custom event on `window`.

**Public methods:**

- **`login(username: string, password: string) → Promise<{ data: any \| null, error: string \| null }> → return_type: same envelope`**
  Authenticates the user against the backend (`apiLogin`). On success, sets `user` from `result.data.user` and resolves loading. The JWT cookies are managed entirely by the browser (httpOnly). Returns the original `{ data, error }` envelope from `authApi`.
  - `username`: registered login name.
  - `password`: account password.
  - **Returns:** `{ data, error }` — either `{ data: { user }, error: null }` on success or `{ data: null, error: "message" }` on failure.

- **`register(username: string, password: string) → Promise<{ data: any \| null, error: string \| null, pending?: boolean }> → return_type: extended envelope`**
  Creates a new user account via `apiRegister`. Behaves differently depending on whether this is the first registration or a subsequent one:

  **(a) First registration (auto-login):** The backend sets httpOnly session cookies and returns `{ user }` — the function updates `user` state from `result.data.user`, and returns the original envelope.

  **(b) Subsequent registration (pending approval):** The backend creates a `'pending'` account without issuing session cookies. `result.data?.user` is falsy, so the function does *not* mutate auth state. Instead, it returns `{ ...result, pending: true }`, signaling to the caller that an admin must approve the account before login is possible.

  - `username`: desired login name for the new account.
  - `password`: password for authentication.
  - **Returns (first user):** `{ data: { user }, error: null }` — auto-logs in on success.
  - **Returns (pending):** `{ data: <created-but-no-user>, error: null, pending: true }` — caller must display a "pending approval" message.
  - **Returns (failure):** `{ data: null, error: "message" }` — same as all other auth methods.

- **`logout() → void`** *(async)*
  Calls `apiLogout()` to revoke all refresh tokens on the server and clear the httpOnly cookies. Then nullifies local `user` state.

- **`forceLogout() → void`**
  Synchronously sets `user = null` and `isLoading = false` without making any network request. Exposed for use by the `auth:session-ended` event listener to enable immediate client-side session termination from any part of the application.

---

### Functions

- **`useAuth() → { user, isAuthenticated, isLoading, login, register, logout, forceLogout }`** *(exported custom hook)*
  Consumer hook that returns the full auth context value via `useContext(AuthContext)`. Throws a descriptive error (`'useAuth must be used within an AuthProvider'`) if called outside the provider tree — guards against accidental unguarded usage.
  - **Returns:** the context value object containing all state/action keys documented above.

---

### Exports

| Export | Type | Purpose |
|--------|------|---------|
| `AuthProvider` | Component | Wrap around the app tree to provide auth state globally. |
| `AuthContext` | Context handle | Raw context reference for advanced consumers or testing. |
| `useAuth` | Hook | Primary way to consume auth state and actions from any descendant component. |

---

### Architecture notes

- **Cookie-based authentication:** No client-side token management occurs. The backend issues `accessToken` (15 min) and `refreshToken` (7 day) as httpOnly cookies with environment-aware `sameSite` policy (`'Strict'` in production, `'Lax'` in development). This context sends requests with `credentials: 'include'` (handled by the API client layer), so the browser automatically attaches cookies to every `/api/*` request. Session validity is determined exclusively by calling `GET /api/auth/me`.
- **StrictMode guard:** A `useRef(false)` flag (`hasCheckedAuthRef`) prevents the boot sequence from running twice when React StrictMode intentionally double-invokes effects in development. The ref acts as a one-shot latch — once `hasCheckedAuthRef.current` is `true`, subsequent calls to `loadUser()` return immediately.
- **Derived state:** `isAuthenticated` is computed inline during render as `Boolean(user)` (Vercel rule 5.1: simple derived value, no memoization needed). No separate hook or variable stores it.
- **Custom event-driven session termination:** The provider listens for a custom `auth:session-ended` event on `window`. When dispatched from anywhere in the application, it triggers an immediate synchronous logout via a ref-backed handler — no round-trip to the server is needed. This enables hooks, interceptors, or background pollers to forcibly invalidate the session without prop-drilling a `forceLogout` reference.
- **Dual-behavior `register()`:** The registration flow distinguishes between the very first user (admin auto-creates, backend sets cookies + returns `{ user }` → immediate login) and subsequent users (backend creates a `'pending'` account with no session). This is detected by checking `result.data?.user` on line 70. When falsy, `register()` skips all state mutation and augments the return envelope with `{ pending: true }` for the UI layer to consume.

---

## 🔄 Changes in this update

### AuthContext.jsx — Pending-registration handling (T8, 2026-07-12)
- **Updated** `register()` method documentation to reflect dual-behavior: first user gets auto-login with token; subsequent users get `{ ...result, pending: true }` without state mutation.
- **Updated** the return type signature of `register()` to include the optional `pending: boolean` flag in the envelope.
- **Updated** the "Provided value shape" table entry for `register` to describe the two branches (first vs. subsequent registration).
- **Updated** Architecture notes: clarified that token persistence applies only to login and *first* registration; added a new note on dual-behavior `register()`.

## 🔄 Changes in this update

### AuthContext.jsx — Full cookie-based rewrite (Task 6, 2026-07-16)
- **Removed** all references to `localStorage` token management. The JWT now lives exclusively in httpOnly cookies on the backend; no client-side token is read, written, or persisted.
- **Removed** the dead `token: null` state variable (was a leftover artifact from pre-cookie localStorage architecture). State is reduced to two variables: `user` and `isLoading`.
- **Replaced** the old Provider value shape: `token` key removed, `forceLogout` added. The hook now returns `{ user, isAuthenticated, isLoading, login, register, logout, forceLogout }`.
- **Rewrote** the boot sequence (`loadUser`) documentation: it no longer reads from `localStorage`; calls `getMe()` unconditionally (cookie is sent automatically by the browser with `credentials: 'include'`).
- **Updated** `login()` documentation to reflect that cookie persistence is handled by the backend — this context only updates local `user` state.
- **Updated** `register()` dual-behavior branches: first registration checks `result.data?.user` (not `result.data?.token`) to detect auto-login.
- **Changed** `logout()` from synchronous localStorage removal to async server call (`apiLogout`) that revokes refresh tokens and clears cookies, then nullifies local state.
- **Added** `forceLogout()` documentation: synchronous client-only session termination via the custom `auth:session-ended` event.
- **Rewrote** Architecture notes: removed "Token persistence" section entirely; added "Cookie-based authentication", "Custom event-driven session termination"; updated remaining notes to reflect current code.
- **Updated** imports table: added `logout as apiLogout` from `../services/authApi`.
