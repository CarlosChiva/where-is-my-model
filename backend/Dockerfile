# ------------------------------------------------------------------
# Stage: backend — single-stage Node.js 20 Debian Slim image
# Purpose: Development-ready Express + Mongoose API server
# ------------------------------------------------------------------

FROM node:20-slim

WORKDIR /app

# ------------------------------------------------------------------
# Layer 0: Install MongoDB utilities for backup operations           --
#           mongodump / mongorestore required by scripts/backup.js   --
# ------------------------------------------------------------------

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    MONGODB_TOOLS_VERSION="100.14.0" && \
    ARCHIVE="mongodb-database-tools-debian12-x86_64-${MONGODB_TOOLS_VERSION}.tgz" && \
    curl -fsSL "https://fastdl.mongodb.org/tools/db/${ARCHIVE}" -o "${ARCHIVE}" && \
    tar xzf "${ARCHIVE}" && \
    cp "mongodb-database-tools-debian12-x86_64-${MONGODB_TOOLS_VERSION}/bin/mongodump" /usr/local/bin/ && \
    chmod +x /usr/local/bin/mongodump && \
    rm -rf "mongodb-database-tools-debian12-x86_64-${MONGODB_TOOLS_VERSION}" "${ARCHIVE}" && \
    apt-get purge -y curl && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

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

RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser \
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
