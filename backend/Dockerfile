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
# Expose and run
# ------------------------------------------------------------------

EXPOSE 8080

CMD ["node", "server.js"]
