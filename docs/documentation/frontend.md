# `frontend`

> Path: `frontend/`
> Last updated: 2026-06-07
> Type: Composite folder

React 19 + Vite 8 frontend application for the "Where is My Model — GPU Dashboard" project. A single-page application that provides a full CRUD interface for managing GPU servers ("PCs") and their assigned AI inference services, with per-GPU VRAM visualization, capacity validation, and a GPU calculator tool. Built with Tailwind CSS 3.4, PostCSS, and ESLint (flat config), containerized via a three-stage Dockerfile (development → build → nginx production).

---

## 📁 Subfolders

| Folder | Documentation | Description |
|--------|--------------|-------------|
| `src/` | [see docs](./frontend/src.md) | React source files: entry point, root component, Tailwind CSS imports, REST API client layer (`services/`), custom hooks (`hooks/`), UI components (`components/` including presentational and modal subfolder), and utility functions (`utils/`). |

---

## 📄 Direct files

## 📄 `tailwind.config.js` (modified)

Tailwind CSS 3.4 configuration that defines the visual theme for the GPU Dashboard dark UI. Exports a module default containing `content` pipelines, an extended `theme` (colors, fonts, border radius, box shadows, animations with keyframes), and `plugins`. Sourced by the PostCSS pipeline (`postcss.config.js`) and consumed at build time to generate on-demand CSS utilities.

### Content sources — Template scanning paths

| Pattern | Purpose |
|---------|---------|
| `'./index.html'` | Scans the sole HTML entry point for class usage |
| `'./src/**/*.{js,jsx,ts,tsx}'` | Recursively scans all React source files (JSX included) for Tailwind utility classes |

### Theme extensions

**Colors** — A dark-system palette designed around a near-black base:

| Token | Hex | Purpose |
|-------|-----|---------|
| `bg-primary` | `#0b0f14` | Main page background |
| `bg-secondary` | `#111821` | Sub-surface panels, header background |
| `bg-card` | `#182030` | Card containers |
| `bg-input` | `#1e2a3a` | Form fields, text inputs |
| `bg-hover` | `#1f2b3d` | Hover state on interactive elements |
| `text-primary` | `#e6edf3` | Body text, headings |
| `text-secondary` | `#7a8a9e` | Muted labels, subtitles |
| `text-muted` | `#4a5a6e` | Placeholder hints, disabled text |
| `accent.DEFAULT` | `#00d4aa` | Primary action colour (buttons, links) |
| `accent.hover` | `#00f0c0` | Hover variant of accent |
| `accent.dim` | `rgba(0,212,170,0.15)` | Subtle accent overlays and backgrounds |
| `danger.DEFAULT` | `#ff6b6b` | Destructive actions (delete buttons) |
| `danger.hover` | `#ff8a8a` | Hover variant of danger |
| `gpu.green` | `#3fb950` | GPU usage ≤ 35% (healthy) |
| `gpu.yellow` | `#d29922` | GPU usage ≤ 70% (warning) |
| `gpu.red` | `#f85149` | GPU usage > 70% (critical) |
| `border.DEFAULT` | `#233045` | Card borders, dividers |
| `border.light` | `rgba(230,237,243,0.06)` | Subtle separator lines |

**Font families:**
- `sans`: Spectral → Georgia → "Times New Roman" → serif fallback
- `mono`: "JetBrains Mono" → "Fira Code" → Consolas → monospace fallback

**Border radius:** Custom scale — `sm: 6px`, `md: 10px`, `lg: 14px`.

**Box shadows (six named tokens):**

| Token | Value | Purpose |
|-------|-------|---------|
| `card` | `0 2px 12px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)` | Default card elevation |
| `card-hover` | `0 6px 24px rgba(0,212,170,0.1), 0 2px 8px rgba(0,0,0,0.3)` | Accent-tinted hover lift on cards |
| `btn-primary` | `0 1px 4px rgba(0,212,170,0.25)` | Primary accent button glow |
| `btn-danger` | `0 1px 4px rgba(255,107,107,0.25)` | Destructive button glow |
| `fab` | `0 4px 20px rgba(0,212,170,0.3), 0 6px 8px rgba(0,0,0,0.35)` | Floating action button depth |

**Animations (four named keyframe sequences):**

| Animation name | Keyframe token | Duration/Easing | Purpose |
|----------------|---------------|-----------------|---------|
| `card-enter` | `cardSlideInUp` | 0.4s ease-out | Card appearance: slides up from 24px with fade-in (opacity 0→1) |
| `gpu-fill` | `gpuBarFill` | 0.6s cubic-bezier(0.25,0.8,0.25,1) | GPU bar fill animation: width animates from 0% to a CSS custom property `--gpu-target-width` (defaults to 100%) |
| `gpu-warning` | `gpuWarningPulse` | 1.8s ease-in-out infinite | Warning state pulse on GPU bars exceeding threshold: red box-shadow radiates outward |
| `dialog-fade` | `dialogFadeIn` | 0.25s ease-out | Modal/dialog entrance: scales from 0.96, translates Y from -8px with fade |

**Breakpoints:** Overrides default Tailwind screens — `lg: 1200px`, `md: 768px`.

### Plugins

Empty array `[]` — no third-party Tailwind plugins are used; all visual effects are composed via custom theme extensions.

---

## 📄 `vite.config.js`

Vite build-tool configuration for the React SPA. Defines the dev server (port, reverse-proxy to backend), plugin list, and production build settings. ESM module.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `vite` | `defineConfig` | External |
| `@vitejs/plugin-react` | `react` | External |

### Configuration sections

**Plugins:** Uses `@vitejs/plugin-react` for Fast Refresh (HMR in dev) and React JSX transform.

**Dev server:**
- Binds to port `3000`.
- Proxies all `/api/*` requests to the backend. Target is resolved from `process.env.VITE_API_PROXY_TARGET` with fallback to `http://localhost:8080`. Inside Docker Compose this env var is set to `http://backend:8080`, which resolves via Docker DNS. In local dev, `.env.development` sets it to `http://localhost:9003` (the host-mapped backend port).
- `changeOrigin: true` rewrites the `Host` header; `secure: false` allows non-TLS upstream connections.

**Build:**
- Source maps disabled (`sourcemap: false`) for production output.

---

## 📄 `postcss.config.js`

PostCSS pipeline configuration that chains Tailwind CSS and Autoprefixer for the build process. ESM module, exported as a default object with two plugin entries. No parameters passed to either plugin (uses their defaults).

### Plugin chain

| Plugin | Purpose |
|--------|---------|
| `tailwindcss` | Processes the `@tailwind base`, `@tailwind components`, `@tailwind utilities` directives found in `src/index.css`, scanning template sources defined in `tailwind.config.js` to generate on-demand utility classes |
| `autoprefixer` | Automatically adds vendor prefixes for CSS properties based on configured browser targets (uses defaults from `browserslist` or `package.json`) |

---

## 📄 `eslint.config.js`

ESLint flat-config (ESM) that enforces code quality across the frontend source tree. Extends JavaScript recommended rules, React Hooks linting, and Vite Fast Refresh best practices. Applied via `npm run lint`.

### Imports and dependencies

| Module | Imported elements | Type |
|--------|-------------------|------|
| `@eslint/js` | `js` (default export) | External |
| `globals` | `globals` | External |
| `eslint-plugin-react-hooks` | `reactHooks` | External |
| `eslint-plugin-react-refresh` | `reactRefresh` | External |
| `eslint/config` | `defineConfig`, `globalIgnores` | External |

### Configuration entries

**Global ignores:** `['dist']` — excludes Vite's production build output directory.

**Active config block:**
- Applies to files matching `'**/*.{js,jsx}'`.
- Extends:
  - `js.configs.recommended` — ESLint core recommended rules
  - `reactHooks.configs.flat.recommended` — React Hooks linting rules (`exhaustive-deps`, `rules-of-hooks`)
  - `reactRefresh.configs.vite` — Fast Refresh compatibility rules
- Language options: browser globals enabled, JSX parser flag activated.

---

## 📄 `package.json`

NPM manifest for the frontend application. Private package (not published), ESM type. Declares runtime and build-time dependencies, plus four npm scripts.

### Identity

| Field | Value |
|-------|-------|
| name | `frontend` |
| version | `0.0.0` |
| private | `true` |
| type | `module` (ESM) |

### Scripts

| Command | Execution | Purpose |
|---------|-----------|---------|
| `dev` | `vite` | Launches Vite dev server with HMR (requires `--host` flag in Docker to bind 0.0.0.0) |
| `build` | `vite build` | Produces production-optimised static assets in `dist/` |
| `lint` | `eslint .` | Runs ESLint on the source tree using `eslint.config.js` |
| `preview` | `vite preview` | Serves production `dist/` locally for inspection |

### Dependencies

| Package | Version | Type | Purpose |
|---------|---------|------|---------|
| `react` | `^19.2.6` | Runtime | React 19 core library |
| `react-dom` | `^19.2.6` | Runtime | React DOM renderer |

### Dev dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@vitejs/plugin-react` | `^6.0.1` | Vite plugin for Fast Refresh + JSX transform |
| `vite` | `^8.0.12` | Build tool and dev server |
| `tailwindcss` | `^3.4.19` | Utility-first CSS framework |
| `postcss` | `^8.5.15` | CSS transformation pipeline |
| `autoprefixer` | `^10.5.0` | Browser-prefix auto-generator |
| `eslint` | `^10.3.0` | Code quality linter |
| `@eslint/js` | `^10.0.1` | ESLint recommended rule set |
| `eslint-plugin-react-hooks` | `^7.1.1` | Hooks linting rules |
| `eslint-plugin-react-refresh` | `^0.5.2` | Fast Refresh compliance rules |
| `globals` | `^17.6.0` | Browser/global environment definitions for ESLint |
| `@types/react` | `^19.2.14` | TypeScript declarations for React (used by tooling) |
| `@types/react-dom` | `^19.2.3` | TypeScript declarations for react-dom (used by tooling) |

---

## 📄 `Dockerfile`

Three-stage Docker image definition for the frontend application: development (Node.js 20 Alpine + Vite dev server), build (compile production assets), and production (nginx serving static HTML/CSS/JS). ESM, Node-based. No classes or functions.

### Stage overview

| Stage name | Base image | Layer sequence | Notes |
|------------|-----------|----------------|-------|
| **development** | `node:20-alpine` | 1) COPY `package*.json`, RUN `npm ci` (deterministic install, cached layer) → 2) COPY `.` (full source) → 3) EXPOSE 3000, CMD `npm run dev -- --host` | In Docker Compose, a volume mount overlays the app directory with live host source for HMR |
| **build** | `node:20-alpine` | Same dependency + source pattern as development → RUN `npm run build` (produces `dist/`) | Includes all devDependencies (needed by Vite to compile) |
| **production** | `nginx:alpine` | 1) COPY built `dist/` from build stage into `/usr/share/nginx/html` → 2) COPY `nginx.conf` as nginx default config → 3) EXPOSE 80 | Lightweight runtime image — no Node.js, no source code. CMD inherited from nginx base image |

### Key behaviours
- `--host` flag on the dev server is **mandatory** inside containers: binds to `0.0.0.0` instead of `127.0.0.1`, allowing Docker Compose networking to reach Vite's HMR WebSocket endpoint.
- `npm ci` (not `npm install`) ensures deterministic, lockfile-exact installs — recommended for reproducible container builds.

---

## 📄 `index.html`

SPA entry HTML document that Vite uses as the application shell. Contains metadata, external font loading, and a mount point for React.

### Structure

| Section | Contents |
|---------|----------|
| **Head** | UTF-8 charset, favicon (`/favicon.svg`), responsive viewport meta tag, page title "Where is My Model — GPU Dashboard" |
| **Fonts** | Two `preconnect` links to Google Fonts CDN + one stylesheet link loading Spectral (400, 600, 700) and JetBrains Mono (400, 500, 700) from Google Fonts API. These match the font families defined in `tailwind.config.js`. |
| **Body** | Single `<div id="app"></div>` mount point for React's `ReactDOM.createRoot()` call in `main.jsx` |
| **Script** | Loads `/src/main.jsx` as an ES module (type="module"), which bootstraps the React application tree |

### Vite integration points
- Vite injects its `<script type="module" src="/@vite/client">` HMR client script automatically during development.
- During `npm run build`, Vite replaces this HTML with versioned asset references (hashed filenames for cache-busting) in the generated `dist/index.html`.

---

## 📄 `nginx.conf`

Nginx reverse-proxy and static-file-serving configuration used by the production Docker stage. Serves the compiled Vite SPA on port 80, proxies `/api/*` requests to the backend Express service at `http://backend:8080/api`, and handles SPA fallback routing. No classes or functions — declarative Nginx config syntax.

### Security headers (applied globally and repeated in locations with their own `add_header` directives)

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY always` | Prevents clickjacking (page cannot be embedded in an iframe) |
| `X-Content-Type-Options` | `nosniff always` | Blocks MIME-type sniffing |
| `X-XSS-Protection` | `"1; mode=block" always` | Legacy XSS filter for older browsers |

### Gzip compression

Enabled with level 6 compression, minimum response length 256 bytes. Covers: `text/plain`, `text/css`, `application/json`, `application/javascript`, `text/xml`, `application/xml`, `text/javascript`, `image/svg+xml`. Applies to proxied responses (`gzip_proxied any`).

### Location blocks

| Location | Purpose | Key settings |
|----------|---------|-------------|
| `/` (default) | SPA fallback routing | `try_files $uri $uri/ /index.html` — serves static file if it exists, otherwise falls back to `index.html` for client-side React Router |
| Static assets (`~* \.(css\|js\|svg\|…)`) | Long-lived cache for versioned Vite assets | `expires 1y`, `Cache-Control: public, immutable` — safe because Vite hash-names these files |
| `/index.html` (exact) | No-cache for shell document | `no-cache, no-store, must-revalidate` + `Pragma: no-cache` + `Expires: 0` — ensures latest JS bundle references are always served |
| `/api` | Reverse proxy to Express backend | `proxy_pass http://backend:8080/api`, forwards `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`. WebSocket upgrade support via `map` block (`$http_upgrade` → `$connection_upgrade`). Uses HTTP/1.1 with the upstream. |

### WebSocket map block

Defines a mapping between `$http_upgrade` header and `$connection_upgrade`:
- If `$http_upgrade` is present → value = `"upgrade"` (WebSocket connection)
- Otherwise → value = `"closed"` (normal HTTP)

Used by the `/api` proxy location to set `Connection: $connection_upgrade`, enabling WebSocket passthrough through nginx.

---

## 📄 `.env.development`

Environment file loaded by Vite during local development and Docker dev builds. Configures the API proxy target so that frontend fetch requests proxied at `/api/*` reach the correct backend endpoint. In Docker Compose, `VITE_API_PROXY_TARGET=http://backend:8080` resolves via internal Docker DNS. In native local dev, it points to `http://localhost:9003` (the host-mapped backend port). Contains Vite-virtual environment variables prefixed with `VITE_`. This file is excluded from Git (see root `.gitignore`) — create it manually or copy from a local template.

### Environment variables

| Variable | Docker Compose value | Local dev value | Consumed by |
|----------|---------------------|-----------------|-------------|
| `VITE_API_PROXY_TARGET` | `http://backend:8080` | `http://localhost:9003` | `vite.config.js` → `server.proxy['/api'].target` (with fallback to `http://localhost:8080`) |

---

## 🔄 Changes in this update

- **Created** `docs/documentation/frontend.md` — new top-level composite documentation for the entire `frontend/` directory.
- **Documented** seven direct files at the frontend root level with full detail:
  - `tailwind.config.js` (modified) — complete theme reference table: colour tokens, font families, border radius, six box-shadow variants, four animations with keyframe definitions, breakpoint overrides, plugin status.
  - `vite.config.js` — imports, plugin list, dev server proxy config with environment variable resolution, build settings.
  - `postcss.config.js` — Tailwind + Autoprefixer pipeline configuration.
  - `eslint.config.js` — flat config entries, extended rule sets, language options.
  - `package.json` — identity, scripts, full dependency/devDependency inventory.
  - `Dockerfile` — three-stage build overview with layer sequence and key behaviours.
  - `index.html` — SPA shell structure, font loading, Vite integration points.
  - `nginx.conf` — security headers table, gzip config, all location blocks, WebSocket map block.
- **Added** subfolder reference for `src/` linking to existing `./frontend/src.md`.

---

## 🔄 Changes in this update

- **T5 — Security hardening: .env files moved out of Git tracking:** `frontend/.env.development` is now untracked by Git. Updated the `.env.development` section to note that the file is excluded from Git and must be created manually or copied from a local template.
