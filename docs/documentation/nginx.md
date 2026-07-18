# `nginx`

> Path: `nginx/`
> Last updated: 2026-07-18
> Type: Leaf folder

Nginx reverse-proxy configuration and TLS certificate generation for the project. Contains the production-grade edge proxy config (`nginx.conf`) that terminates TLS (HTTPS on port 443), redirects HTTP to HTTPS (port 80), and routes traffic to the frontend Vite dev server and backend Express API. Includes a helper script (`generate-certs.sh`) for creating self-signed development certificates with a local CA chain and Subject Alternative Names (SAN) for `localhost` / `127.0.0.1`.

---

## 📄 `nginx.conf`

Nginx reverse-proxy configuration serving as the authoritative edge layer for the entire stack. Terminates TLS using self-signed development certificates, redirects all HTTP traffic to HTTPS via 301, and proxies three location groups: `/api/*` → backend Express on port 8080, `/hmr` → Vite HMR WebSocket, and `/` (catch-all) → frontend SPA on port 3000. Enforces a comprehensive set of security response headers at the HTTPS server level with the `always` flag so they apply to every response code class (2xx, 3xx, 4xx, 5xx).

Declarative Nginx config syntax — no classes or functions.

### Global HTTP block settings

| Directive | Value | Purpose |
|-----------|-------|---------|
| `worker_processes` | `1` | Single worker sufficient for a dev-scale reverse proxy |
| `error_log` | `/var/log/nginx/error.log warn` | Container-captured error log at warn-level |
| `pid` | `/var/run/nginx.pid` | PID file location inside container |
| `worker_connections` | `1024` | Max simultaneous connections per worker |
| `log_format main` | Standard combined format with referer + user-agent fields | Structured access log for Docker stdout/stderr capture |
| `sendfile` | `on` | Kernel-level file transfer for static assets |
| `keepalive_timeout` | `65` | Client keep-alive timeout in seconds |

### Server block — HTTP to HTTPS redirect (port 80)

| Directive | Value | Purpose |
|-----------|-------|---------|
| `listen` | `80` | Accepts plain-HTTP connections |
| `server_name` | `localhost` | Matches the development host |
| `return 301` | `https://$host$request_uri` | Permanent redirect preserving the original URI path and query string |

### Server block — HTTPS termination (port 443)

**TLS configuration:**

| Directive | Value | Purpose |
|-----------|-------|---------|
| `listen` | `443 ssl http2` | HTTP/2 over TLS on port 443 |
| `ssl_certificate` | `/etc/nginx/certs/server.crt` | Self-signed server certificate (mounted read-only from `./nginx/certs/`) |
| `ssl_certificate_key` | `/etc/nginx/certs/server.key` | Corresponding private key |
| `ssl_protocols` | `TLSv1.2 TLSv1.3` | Modern TLS only — disables TLS 1.0 and 1.1 |
| `ssl_ciphers` | `HIGH:!aNULL:!MD5` | Strong cipher suites only, excludes NULL auth and MD5 |
| `ssl_prefer_server_ciphers` | `on` | Server's cipher order takes precedence over client preference |

### Security headers (Task 8 — authoritative edge layer)

> These headers override any upstream service headers (e.g., Helmet.js in the Express backend) and guarantee every response carries the full security set. All use the `always` flag.

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `"max-age=31536000; includeSubDomains; preload" always` | HSTS — instructs browsers to only use HTTPS for 1 year, includes all subdomains, eligible for browser preload lists |
| `Content-Security-Policy` | See breakdown below | Restricts resource loading origins and injection vectors |
| `X-Frame-Options` | `DENY always` | Prevents clickjacking — the page can never be framed |
| `X-Content-Type-Options` | `nosniff always` | Blocks MIME-type sniffing |
| `Referrer-Policy` | `"strict-origin-when-cross-origin" always` | Sends full referrer on same-origin navigation; only sends origin (not path) on cross-origin; sends nothing when downgrading to HTTP |
| `Permissions-Policy` | See breakdown below | Restricts browser feature access to the application |

**CSP directive breakdown:**

| Directive | Value | Allows |
|-----------|-------|--------|
| `default-src` | `'self'` | Baseline: only same-origin resources |
| `script-src` | `'self'` | JavaScript only from the application origin |
| `style-src` | `'self' 'unsafe-inline' https://fonts.googleapis.com` | Inline styles (needed by Tailwind's class-to-CSS compilation), plus Google Fonts API stylesheet delivery |
| `img-src` | `'self' data: blob:` | Same-origin images, inline Data URIs, Blob URLs (used by the dashboard GPU bar visualizations) |
| `font-src` | `'self' https://fonts.gstatic.com` | Application-bundled fonts + Google Fonts static delivery CDN |
| `connect-src` | `'self' http://backend:8080 ws://backend:8080` | Same-origin XHR/fetch, internal Docker HTTP to the Express API, and WebSocket connections to backend |
| `frame-ancestors` | `'none'` | Nothing may embed this page in an iframe or frame (redundant with X-Frame-Options DENY — defense in depth) |
| `base-uri` | `'self'` | Prevents `<base>` tag injection that could redirect relative URLs |
| `form-action` | `'self'` | Form submissions only to same-origin endpoints |

**Permissions-Policy breakdown:**

| Feature | Policy | Rationale |
|---------|--------|-----------|
| `camera` | `()` | No camera access needed |
| `microphone` | `()` | No microphone access needed |
| `geolocation` | `()` | No geolocation access needed |
| `payment` | `()` | No payment API access needed |
| `usb` | `()` | No USB device access needed |
| `magnetometer` | `()` | No magnetometer access needed |
| `gyroscope` | `()` | No gyroscope access needed |
| `accelerometer` | `()` | No accelerometer access needed |
| `fullscreen` | `(self)` | Fullscreen allowed only from same origin (used by modals and dashboard views) |

### Location blocks (HTTPS server)

| Location | Proxy target | Purpose | Key settings |
|----------|-------------|---------|-------------|
| `/api` | `http://backend:8080` | Reverse proxy all REST API requests to Express backend | Standard proxy headers (`Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`). HTTP/1.1 with empty Connection header for keepalive to backend. |
| `/hmr` | `http://frontend:3000` | Vite HMR WebSocket passthrough | Full WebSocket upgrade headers (`Upgrade`, `Connection: "upgrade"`). Extended read timeout of 86400s (24 h) to prevent idle disconnect during long dev sessions. |
| `/` | `http://frontend:3000` | Catch-all SPA proxy | Same standard proxy header forwarding. Includes WebSocket upgrade handling as a fallback for HMR connections that don't hit the dedicated `/hmr` route. |

---

## 📄 `generate-certs.sh`

Idempotent Bash script that generates a local Certificate Authority (CA) and a server certificate signed by that CA, suitable for development HTTPS. Uses OpenSSL to produce a two-level PKI chain within the `nginx/certs/` directory. Sets strict error handling (`set -euo pipefail`). No classes or functions — procedural shell script.

### Command-line interface

| Argument | Type | Default | Purpose |
|----------|------|---------|---------|
| Positional (first) | Integer | `365` | Certificate validity period in days |
| `-f` / `--force` | Flag | Off | Regenerate certificates even if they already exist |

### Generation workflow

| Step | Action | Output files |
|------|--------|-------------|
| 1. CA creation | `openssl genrsa` (2048-bit) + `openssl req -x509` self-signed CA with CN=`Local Dev CA` | `certs/ca.key`, `certs/ca.crt` |
| 2. Server key + CSR | `openssl genrsa` (2048-bit) + `openssl req -new` with a temporary config defining SAN (`DNS:localhost`, `IP:127.0.0.1`) under CN=`localhost` | `certs/server.key`, `/tmp/server.csr` (temp) |
| 3. Server cert signing | `openssl x509 -req` — signs the CSR using the CA key, inheriting SAN extensions from the same temp config | `certs/server.crt` |

### Idempotency logic

Before generating:
1. Iterates over all four certificate files (`ca.key`, `ca.crt`, `server.key`, `server.crt`).
2. Sets `should_generate=true` if **any** file is missing.
3. Force flag overrides this check entirely.
4. If nothing needs generation, prints a skip message and exits cleanly with code 0.

### Cleanup

After signing, removes temporary files: `/tmp/server.csr`, `/tmp/cert-ext.cnf`, `/tmp/ca.srl`.

### Output messages

| Condition | Console output |
|-----------|---------------|
| Certificates generated | Prints file paths and a warning that these are self-signed (browsers show security warnings) |
| Certificates already exist | Prints skip message, suggests `-f` flag for regeneration |
| Unrecognized option | Prints error and exits with code 1 |

---

## 🔄 Changes in this update

- **Task 8 — First documentation of `nginx/` folder:** Created `docs/documentation/nginx.md` as a leaf-folder document covering both direct files.
- **`nginx.conf`:** Documented the complete configuration including HTTP→HTTPS redirect server block, HTTPS TLS termination server block with security header section (HSTS, CSP with full directive breakdown table, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy), and all three location proxy blocks.
- **`generate-certs.sh`:** Documented CLI interface, three-step PKI generation workflow, idempotency logic, cleanup behavior, and console output conventions.
