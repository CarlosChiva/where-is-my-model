# `context`

> Path: `frontend/src/context`
> Last updated: 2026-07-11
> Type: Leaf folder

React Context layer for global application state that must be shared across the component tree without prop-drilling. Currently holds `AuthContext.jsx`, which provides authentication state management (user identity, session token, loading indicators, and login/logout actions) to any descendant component via a custom `useAuth()` hook.

---

## 📄 `AuthContext.jsx`

Central authentication context provider that manages user session lifecycle for the entire application. On mount, it reads a JWT token from `localStorage`, verifies it by calling `getMe()`, and loads the user profile — or performs a silent logout if the token is stale. Exposes three public actions (`login`, `register`, `logout`) and derived state (`isAuthenticated`, `isLoading`) through React's context API, consumed via the `useAuth()` custom hook.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `react` | `createContext`, `useContext`, `useState`, `useEffect`, `useRef` | External |
| `../services/authApi` | `login as apiLogin`, `register as apiRegister`, `getMe` | Internal |

### Classes

#### `AuthContext` *(React Context object via `createContext(null)`)*

The raw context handle that carries authentication state and actions. Created with a `null` default to allow `useAuth()` to throw a clear error when called outside of an `<AuthProvider>` tree.

**Provided value shape:**

| Key | Type | Description |
|-----|------|-------------|
| `user` | `Object \| null` | Current authenticated user object (from the server). |
| `token` | `string \| null` | Raw JWT token persisted in `localStorage`. |
| `isAuthenticated` | `boolean` | Derived: `Boolean(user)` — truthy if a valid user exists. |
| `isLoading` | `boolean` | True while the initial session verification (`getMe()`) is in flight. |
| `login` | `Function` | Action that authenticates with credentials, persists token, and sets user state. |
| `register` | `Function` | Action that creates an account, persists token, and sets user state. |
| `logout` | `Function` | Clears localStorage token and resets all auth state to null. |

---

#### `AuthProvider` *(React functional component)*

Provider wrapper component that maintains authentication state using five React hooks (`useState` × 3, `useEffect`, `useRef`). Renders `<AuthContext.Provider>` around `{children}` with the current auth value. Must be mounted at or above the root of any tree that needs access to auth state.

**State variables:**

| Variable | Initial Value | Role |
|----------|---------------|------|
| `user` | `null` | Authenticated user object from the server. |
| `token` | `null` | JWT token string, mirrored to and read from `localStorage`. |
| `isLoading` | `true` | Blocks child rendering until session verification completes. |

**Internal logic — boot sequence:**

- **`loadUser() → void`** *(async internal function)*
  Session recovery called on mount via `useEffect(() => { void loadUser(); }, [])`. Reads `"token"` from `localStorage`; if absent, sets `isLoading = false` and returns. If present, calls `getMe()` to validate: a failure triggers silent logout (removes token, nulls state). A success updates `user` from `result.data`. Guarded by `hasCheckedAuthRef` (`useRef(false)`) to prevent double-execution in React StrictMode.

**Public methods:**

- **`login(username: string, password: string) → Promise<{ data: any \| null, error: string \| null }> → return_type: same envelope`**
  Authenticates the user against the backend (`apiLogin`). On success, persists the returned token to `localStorage`, updates user and token state. Returns the original `{ data, error }` envelope from `authApi`.
  - `username`: registered login name.
  - `password`: account password.
  - **Returns:** `{ data, error }` — either `{ data: { token, user }, error: null }` on success or `{ data: null, error: "message" }` on failure.

- **`register(username: string, password: string) → Promise<{ data: any \| null, error: string \| null }> → return_type: same envelope`**
  Creates a new user account via `apiRegister`. On success, token is persisted and state is updated (same flow as login). Returns the original `{ data, error }` envelope.
  - `username`: desired login name for the new account.
  - `password`: password for authentication.
  - **Returns:** `{ data, error }` — either `{ data: { token, user }, error: null }` on success or `{ data: null, error: "message" }` on failure.

- **`logout() → void`**
  Synchronously removes `"token"` from `localStorage`, nullifies `user` and `token` state. No async call is made; the session ends client-side immediately.

---

### Functions

- **`useAuth() → { user, token, isAuthenticated, isLoading, login, register, logout }`** *(exported custom hook)*
  Consumer hook that returns the full auth context value via `useContext(AuthContext)`. Throws a descriptive error (`'useAuth must be used within an AuthProvider'`) if called outside the provider tree — guards against accidental unguarded usage.
  - **Returns:** the context value object containing all five state/action keys documented above.

---

### Exports

| Export | Type | Purpose |
|--------|------|---------|
| `AuthProvider` | Component | Wrap around the app tree to provide auth state globally. |
| `AuthContext` | Context handle | Raw context reference for advanced consumers or testing. |
| `useAuth` | Hook | Primary way to consume auth state and actions from any descendant component. |

---

### Architecture notes

- **StrictMode guard:** A `useRef(false)` flag (`hasCheckedAuthRef`) prevents the boot sequence from running twice when React StrictMode intentionally double-invokes effects in development. The ref acts as a one-shot latch — once `hasCheckedAuthRef.current` is `true`, subsequent calls to `loadUser()` return immediately.
- **Derived state:** `isAuthenticated` is computed inline during render as `Boolean(user)` (Vercel rule 5.1: simple derived value, no memoization needed). No separate hook or variable stores it.
- **Token persistence:** The JWT token lives in `localStorage` under the key `"token"`. On login and register, the new token is written here. On logout and stale-token detection, it is removed. On mount, it is read — if present, a verification call fires; if absent, the app bootstraps in an unauthenticated state.
