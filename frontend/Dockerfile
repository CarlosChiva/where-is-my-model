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

# CMD inherited from nginx base image
