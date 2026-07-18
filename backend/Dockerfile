# ------------------------------------------------------------------
# Stage: backend — single-stage Node.js 20 Alpine image
# Purpose: Development-ready Express + Mongoose API server
# ------------------------------------------------------------------

FROM node:20-alpine

WORKDIR /app

# ------------------------------------------------------------------
# Layer 1: Install production dependencies (cached unless package
#           files change)
# ------------------------------------------------------------------

COPY package*.json ./

RUN npm install --production

# ------------------------------------------------------------------
# Layer 2: Copy application source
#           In development, docker-compose volume mount will overlay
#           this directory with live host source, invalidating this
#           layer for hot-reload.
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
# Health check — Express responds at /api/health with { status: 'ok' }
# Runs as appuser (non-root). node is in PATH under node:20-alpine.
# ------------------------------------------------------------------

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

# ------------------------------------------------------------------
# Expose and run
# ------------------------------------------------------------------

EXPOSE 8080

CMD ["node", "server.js"]
