# `frontend`

> Path: `frontend/`
> Last updated: 2026-06-04
> Type: Composite folder

The React frontend for the GPU Infrastructure Dashboard, scaffolded with Vite + VitePluginReact. Contains configuration files (`vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `eslint.config.js`), the base HTML entry point (`index.html`) carrying the branded application title "Where is My Model — GPU Dashboard", source components under `src/`, and static assets under `public/`. The dev server is configured to listen on port 3000 with a `/api` proxy forwarding requests to the Express backend — configurable via `VITE_API_PROXY_TARGET` environment variable (`.env` for Docker Compose, `.env.development` for local dev) with a fallback to `http://localhost:9003`. Google Fonts (Spectral and JetBrains Mono) are preloaded in the HTML head for typography used throughout the dashboard UI.

---

## 📁 Subfolders

| Folder | Documentation | Description |
|--------|--------------|-------------|
| `src/` | [see docs](./frontend/src.md) | React source files: entry point (`main.jsx`), root component (`App.jsx`), and Tailwind CSS base styles (`index.css`). |

---

## 📄 Direct files

### `vite.config.js`

Vite build configuration for the frontend. Defines the plugin list, dev server settings (port binding, API proxy to the backend Express server), and production build options (source map control).

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `vite` | `defineConfig` | External |
| `@vitejs/plugin-react` | `react` | External |

**Configuration object (`export default`):**

- **`plugins: [react()]`** — Registers the React fast-refresh plugin for HMR support during development.
- **`server.port: 3000`** — Binds the Vite dev server to port 3000.
- **`server.proxy['/api'].target`** — Proxies any request path beginning with `/api` during development so the frontend can reach the Express backend without CORS issues. The target is sourced from `process.env.VITE_API_PROXY_TARGET` (read from `.env` / `.env.development`), with a fallback to `http://localhost:9003`. This allows switching between Docker Compose (backend service name via `.env`) and local development (localhost via `.env.development` or the hardcoded fallback) without code changes.
- **`server.proxy['/api'].changeOrigin: true`** — Rewrites the `Host` header of proxied requests to match the target backend.
- **`server.proxy['/api'].secure: false`** — Accepts self-signed certificates from the backend (useful in local Docker networks).
- **`build.sourcemap: false`** — Disables source map generation in production builds, reducing bundle size and preventing source code exposure.

---

### `index.html`

Base HTML template served by Vite during development and used as the build entry point for production. Provides the `<head>` metadata, favicon reference, Google Fonts preload links (Spectral + JetBrains Mono), and the root `<div id="app">` mount point for React. Loads `/src/main.jsx` as an ES module.

### HTML Structure

| Element | Purpose |
|---------|---------|
| `<meta charset="UTF-8">` | Declares UTF-8 character encoding |
| `<link rel="icon" href="/favicon.svg">` | Points to the SVG favicon in `public/` |
| `<meta name="viewport">` | Responsive viewport configuration (`width=device-width, initial-scale=1.0`) |
| `<title>Where is My Model — GPU Dashboard</title>` | Application branded title — identifies the page in browser tabs and bookmarks |
| `<link rel="preconnect" href="https://fonts.googleapis.com">` | Preconnects to Google Fonts CDN for reduced latency |
| `<link rel="preconnect" href="https://fonts.gstatic.com">` | Preconnects to the fonts resource origin with `crossorigin` for secure font delivery |
| `<link href="...css2?family=..." rel="stylesheet">` | Loads Spectral (400, 600, 700) and JetBrains Mono (400, 500, 700) via Google Fonts API with `display=swap` |
| `<div id="app"></div>` | React mount point targeted by `main.jsx` |
| `<script type="module" src="/src/main.jsx">` | Entry module that bootstraps the React application tree |

---

### `Dockerfile`

Multi-stage Dockerfile for building and running the frontend application. Defines three stages: **development** (hot-reload with Vite dev server on Node.js 20 Alpine), **build** (production asset compilation), and **production** (nginx serving static assets). Supports Docker Compose integration with volume mounts for live source code during development.

**Build stages:**

| Stage | Base Image | Purpose | Key commands |
|-------|-----------|---------|--------------|
| `development` | `node:20-alpine` | Hot-reload dev environment with Vite dev server | `npm ci`, `npm run dev -- --host` |
| `build` | `node:20-alpine` | Compile production static assets into `dist/` | `npm ci`, `npm run build` |
| `production` | `nginx:alpine` | Lightweight production server, no Node.js runtime | Copies `dist/` + `nginx.conf`, exposes port 80 |

**Exposed ports:**

| Stage | Port | Protocol |
|-------|------|----------|
| `development` | 3000 | HTTP (Vite dev server) |
| `production` | 80 | HTTP (nginx) |

**Docker Compose integration:**

- In development, a Docker Compose volume mount overlays the image's `/app` directory with live host source code, enabling HMR (Hot Module Replacement) without rebuilds.
- The `--host` flag is mandatory — it binds Vite to `0.0.0.0` instead of `localhost`, allowing external access from the Docker network.
- In production, static assets from the build stage (`/app/dist`) are copied to nginx's default serving directory (`/usr/share/nginx/html`).
- A custom `nginx.conf` is placed at `/etc/nginx/conf.d/default.conf` to configure reverse proxy behavior.

---

### `.dockerignore`

Docker build context exclusions file. Prevents unnecessary files from being sent to the Docker daemon during build, reducing build context size and preventing credential leakage or stale dependencies from entering the image.

**Excluded patterns:**

| Pattern | Purpose |
|---------|---------|
| `node_modules` | Dependency artifacts installed by Dockerfile during build |
| `dist` | Build output — baked into image during build stage |
| `.git` | Version control data — not needed inside the container |
| `.env*` | Environment files — injected at runtime via docker-compose, prevents credential leakage |
| `.dockerignore`, `Dockerfile` | Docker config files — not needed inside the container |
| `.DS_Store`, `*.swp`, `*.swo`, `*~` | Editor and OS artifacts |
| `.vscode/`, `.idea/` | IDE configuration directories |

---

### `.env`

Global Vite environment variable file loaded on every build and dev run. Contains project-wide configuration defaults. Only the `VITE_`-prefixed variables are embedded into the client bundle. The default proxy target is the Docker Compose backend service (`http://backend:8080`).

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_API_PROXY_TARGET` | `http://backend:8080` | Default Vite dev server API proxy target for Docker Compose environments. Allows the frontend to communicate with the backend service via its Docker network name. |

---

### `.env.development`

Vite environment variable file loaded **only** in development mode (when `vite` runs with `--mode development`, which is the default). This file overrides `.env` during local development, enabling the developer to hit a backend running on `localhost:9003` instead of the Docker service name `backend`.

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_API_PROXY_TARGET` | `http://localhost:9003` | Overrides the default proxy target so the Vite dev server proxies `/api` requests to the backend running on `localhost:9003` instead of the Docker service name `backend`. |

---

### `nginx.conf`

Production Nginx configuration that serves the Vite-built React SPA, enforces security headers, compresses text assets with gzip, manages cache policies for versioned static files, and reverse-proxies API requests to the Express backend. Also supports WebSocket connection upgrades on the `/api` endpoint.

**Server block:**

| Directive | Value | Purpose |
|-----------|-------|---------|
| `listen` | `80` | Accepts HTTP traffic on port 80 (Docker Compose maps host port 8080 → container port 80) |
| `server_name` | `_` | Catch-all — accepts any hostname (used inside Docker network) |
| `root` | `/usr/share/nginx/html` | Serves Vite production build output |
| `index` | `index.html` | Default file for directory requests |

**Variable mapping:**

| Variable | Source | Values | Purpose |
|----------|--------|--------|---------|
| `$http_upgrade` | Client `Upgrade` header | `"websocket"` or empty string | Detects whether the client requests a protocol upgrade |
| `$connection_upgrade` | Mapped via `map` block | `upgrade` or `close` | Normalized value passed to proxy for WebSocket handshake |

**Security headers (global):**

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevents the page from being embedded in iframes — mitigates clickjacking |
| `X-Content-Type-Options` | `nosniff` | Disables MIME-type sniffing — prevents browsers from interpreting files as a different content type |
| `X-XSS-Protection` | `"1; mode=block"` | Enables browser XSS filter — blocks rendering if an attack is detected |

> **Note:** These headers are repeated inside each `location` block that has its own `add_header` directives, because Nginx's behavior is to replace (not append) headers when `add_header` is used in a nested context.

**Gzip compression:**

| Directive | Value | Purpose |
|-----------|-------|---------|
| `gzip` | `on` | Enables compression |
| `gzip_vary` | `on` | Sends `Vary: Accept-Encoding` header for correct caching by proxy servers |
| `gzip_min_length` | `256` bytes | Only compress responses larger than 256 bytes — avoids overhead on tiny payloads |
| `gzip_proxied` | `any` | Compresses regardless of request origin (cached, redirected, or direct) |
| `gzip_comp_level` | `6` | Balances CPU usage vs. compression ratio |
| `gzip_types` | `text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml` | Sets of MIME types eligible for compression |

**Location blocks:**

1. **`location /`** — SPA fallback. Uses `try_files $uri $uri/ /index.html` to serve existing static files first, then fall back to `index.html` so React Router client-side routing works correctly on page refresh.

2. **`location ~* \.(?:css|js|svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot)$`** — Versioned static assets. Sets `expires 1y` and `Cache-Control: public, immutable` for 1-year browser caching (Vite hashes filenames, so content changes produce new filenames). Security headers are repeated here because Nginx replaces parent-level headers in location contexts with their own `add_header`.

3. **`location = /index.html`** — HTML entry point. Sets `Cache-Control: no-cache, no-store, must-revalidate`, `Pragma: no-cache`, and `Expires: 0` to force the browser to always fetch the latest `index.html` from the server.

4. **`location /api`** — API reverse proxy. Forwards requests starting with `/api` to the Express backend at `http://backend:8080/api`.

   **Proxy directives:**

   | Directive | Value | Purpose |
   |-----------|-------|---------|
   | `proxy_pass` | `http://backend:8080/api` | Routes to the backend Docker service |
   | `proxy_http_version` | `1.1` | Required for WebSocket upgrades (HTTP/1.0 does not support Upgrade header) |
   | `proxy_set_header Host` | `$host` | Preserves the original Host header |
   | `proxy_set_header X-Real-IP` | `$remote_addr` | Passes the client's real IP address |
   | `proxy_set_header X-Forwarded-For` | `$proxy_add_x_forwarded_for` | Builds the chained forwarded-IP list |
   | `proxy_set_header X-Forwarded-Proto` | `$scheme` | Preserves the original protocol (http/https) |
   | `proxy_set_header Upgrade` | `$http_upgrade` | Passes the WebSocket upgrade request |
   | `proxy_set_header Connection` | `$connection_upgrade` | Normalized connection header for WebSocket handshake |

---

## 🔄 Changes in this update

- **Created** `frontend.md` as a new composite folder document. This is the first documentation pass for the `frontend/` root-level files following T010 (Configure Vite dev server with API proxy, Google Fonts, and base HTML).
- **Documented** `vite.config.js`: server configuration with port 3000 and `/api` → `http://backend:8080` proxy.
- **Documented** `index.html`: Google Fonts preconnect links and stylesheet for Spectral + JetBrains Mono added to the `<head>`.

### Changes added in this update

- **Added** `Dockerfile` to Direct files: multi-stage Dockerfile with development (`node:20-alpine` + Vite), build (`node:20-alpine` + `npm run build`), and production (`nginx:alpine`) stages. Covers exposed ports, Docker Compose volume mount integration, and `--host` binding requirement.
- **Added** `.dockerignore` to Direct files: build context exclusions covering `node_modules`, `dist`, `.git`, `.env*`, editor artifacts, and IDE directories. Purpose: reduce build context size and prevent credential leakage.
- **Added** `nginx.conf` to Direct files (T030): production Nginx configuration serving Vite-built React SPA with SPA fallback (`try_files`), security headers (`X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`), gzip compression for text assets, 1-year immutable cache for versioned static files, no-cache for `index.html`, reverse proxy for `/api` → `http://backend:8080/api` with WebSocket upgrade support (`map $http_upgrade $connection_upgrade`), and standard proxy headers (`Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`).

---

## 🔄 Changes in this update

- **Modified** `vite.config.js`:
  - The `/api` proxy target is no longer hardcoded. It now reads `process.env.VITE_API_PROXY_TARGET` with a fallback to `http://localhost:9003`, allowing runtime configuration without code changes. Docker Compose environments provide the actual backend URL via `.env` (`http://backend:8080`), while local development defaults to `localhost:9003` via `.env.development` or the hardcoded fallback.
  - Added `build.sourcemap: false` to disable source map generation in production builds, reducing bundle size and preventing source code exposure.
- **Created** `.env`: Global Vite environment file setting `VITE_API_PROXY_TARGET=http://backend:8080`.
- **Created** `.env.development`: Development-only environment file (overrides `.env`) with `VITE_API_PROXY_TARGET=http://localhost:9003`, enabling local development against a backend on `localhost:9003` while preserving the Docker Compose default (`http://backend:8080`) for production builds.
- **Why**: Before this change, switching between Docker Compose and local development required editing `vite.config.js` directly. Now the proxy target is fully configurable via environment variables, following the [12-factor app](https://12factor.net/config) principle of storing config in the environment.
- **Expected result**: Developers can run the frontend against a backend on `localhost:9003` by simply having `.env.development` present. Docker Compose builds continue to work out of the box using the fallback `http://backend:8080`. No code changes needed when switching environments.

---

## 🔄 Changes in this update

- **Modified** `index.html` (T14):
  - The `<title>` tag was changed from the generic placeholder `"frontend"` to the application's branded title: **"Where is My Model — GPU Dashboard"**.
  - This ensures the browser tab, bookmarks, and any external references display the correct product name.
