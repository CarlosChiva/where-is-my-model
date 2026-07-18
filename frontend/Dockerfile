# ------------------------------------------------------------------
# Frontend Dockerfile — Vite + React
# Three stages: development, build, production
# ------------------------------------------------------------------

# ------------------------------------------------------------------
# Stage 1: development — Node.js 20 Alpine with Vite dev server
# Purpose: Hot-reload development environment
#           In development, docker-compose volume mount overlays
#           this directory with live host source for HMR.
# ------------------------------------------------------------------

FROM node:20-alpine AS development

WORKDIR /app

# ------------------------------------------------------------------
# Layer 1: Install all dependencies (cached unless package files
#           change). Uses npm ci for deterministic installs.
# ------------------------------------------------------------------

COPY package*.json ./

RUN npm ci

# ------------------------------------------------------------------
# Layer 2: Copy application source
#           In development, docker-compose volume mount will
#           overlay this directory with live host source.
# ------------------------------------------------------------------

COPY . .

# ------------------------------------------------------------------
# Security: Create non-root user and set ownership
#           System group/user (-S): no home dir, no login shell
#           chmod ensures volume-mounted source files are readable
# ------------------------------------------------------------------

RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app \
    && chmod -R u+r,g+r /app

USER appuser

# ------------------------------------------------------------------
# Health check — Vite dev server responds at http://localhost:3000/
# Runs as appuser (non-root). wget is provided by BusyBox in Alpine.
# start-period=15s accounts for npm install + Vite first-compile time.
# ------------------------------------------------------------------

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1

# ------------------------------------------------------------------
# Expose and run
#           --host is MANDATORY for container networking: binds to
#           0.0.0.0 instead of localhost, allowing external access.
# ------------------------------------------------------------------

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host"]

# ------------------------------------------------------------------
# Stage 2: build — Compile production static assets
# Purpose: Generate dist/ output for nginx production stage
# ------------------------------------------------------------------

FROM node:20-alpine AS build

WORKDIR /app

# ------------------------------------------------------------------
# Layer 1: Install all dependencies (including devDependencies
#           needed for Vite build)
# ------------------------------------------------------------------

COPY package*.json ./

RUN npm ci

# ------------------------------------------------------------------
# Layer 2: Copy source and run production build
# ------------------------------------------------------------------

COPY . .

RUN npm run build

# ------------------------------------------------------------------
# Stage 3: production — Nginx serving static assets
# Purpose: Lightweight production image with no Node.js runtime
# ------------------------------------------------------------------

FROM nginx:alpine AS production

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

USER nginx

# ------------------------------------------------------------------
# Health check — nginx serves static SPA at http://localhost:80/
# Runs as nginx user. wget is provided by BusyBox in Alpine.
# CMD inherited from nginx base image, so we add healthcheck after.
# ------------------------------------------------------------------

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1
