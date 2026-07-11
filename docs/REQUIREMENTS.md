# Requirements — where-is-my-model: Authentication & Authorization System

## Overview
Implement a complete authentication and authorization system for the multi-GPU dashboard application, securing all existing API endpoints and adding role-based access control throughout the frontend.

---

## Backend Requirements

### 1. User Model (new MongoDB collection)
- Fields: `username` (String, unique), `password` (String, bcrypt-hashed), `role` ('admin' | 'user')
- Bcrypt for password hashing
- Basic validation on all fields

### 2. JWT Authentication
- `POST /api/auth/register` — register new user. **First user** registered (when collection is empty) automatically receives `role: 'admin'`. All subsequent users get `role: 'user'`.
- `POST /api/auth/login` — validate credentials, return JWT token
- `GET /api/auth/me` — return logged-in user info (excluding password)
- JWT payload must include at minimum: `userId`, `username`, `role`, standard expiration

### 3. Authorization Middlewares
- `authMiddleware` — validates JWT token from `Authorization: Bearer <token>` header
- `requireAdmin` — verifies role is 'admin'
- Apply `authMiddleware` to ALL existing CRUD routes (`/api/pcs`, `/api/pcs/:id/services`) — no route accessible without authentication
- Apply `requireAdmin` only to mutation operations (POST, PUT, DELETE). GET endpoints require only authentication (any role)

### 4. Seed Initialization
- Logic for automatic first-admin assignment is already covered in the register endpoint

---

## Frontend Requirements

### 5. Login Page
- Form with username and password fields
- On successful login, store JWT (localStorage or sessionStorage)
- If no valid token exists on app load, redirect/block to login page

### 6. Route Protection
- Without active session = only Login page is shown
- With active session = dashboard and remaining views are shown

### 7. Role-Based Control
- If `role === 'admin'`: render add/edit/delete buttons and modals for PCs and services (current behavior)
- If `role === 'user'`: read-only view — PCCards without action buttons, modals inaccessible
- Global user context for easy role access from any component

### 8. Updated apiClient.js
- Include JWT token in every request via `Authorization: Bearer <token>` header
- Handle 401 (unauthorized) → clear token and redirect to login
- Block write requests if user is not admin

---

## Technical Considerations

- Stack: Express 4 + Mongoose 8 + MongoDB 7 (backend), React 19 + Vite 8 + Tailwind CSS (frontend)
- ESM on both sides, no TypeScript
- Docker Compose with 3 services (frontend :3000, backend :8080→9003, mongo internal)
- apiClient.js returns `{ data, error }` pattern — NOT throw/catch
- Routes in `backend/routes/`, middleware in `backend/middleware/`, models in `backend/models/`
- Frontend entry: `frontend/src/main.jsx` → `App.jsx`
- Documentation in `docs/documentation/`
