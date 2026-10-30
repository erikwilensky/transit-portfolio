# NIST Transit Portfolio: the app (dist/) and the pilot server (/api) in one image.
#   docker build -t transit-portfolio .
#   docker run -d -p 8080:8080 -v "$PWD/../transit-portfolio-data:/data" transit-portfolio
# Usually run through docker-compose.yml (scripts/deploy-mac.sh).

# ── 1. Build: install everything, build the app and the server's bundle of src/api.js ──
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ── 2. Runtime: only what the server needs. The server has no npm dependencies. ──
# (If a server/ module ever imports a package, add: COPY package-lock.json ./ and
#  RUN npm ci --omit=dev --no-audit --no-fund before the COPY --from=build lines.)
FROM node:22-alpine
# The commit, for System health and /api/health (docker-compose.yml passes it from scripts/deploy-mac.sh).
ARG GIT_COMMIT=
ENV GIT_COMMIT=$GIT_COMMIT \
    NODE_ENV=production \
    DATA_DIR=/data \
    PORT=8080 \
    TP_MODE=demo
WORKDIR /app
# Code stays owned by root (read-only to the app); only /data is writable by the `node` user.
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO /dev/null "http://127.0.0.1:${PORT}/api/health" || exit 1
# The server handles SIGTERM itself (finishes requests, then exits); compose adds an init for PID 1.
STOPSIGNAL SIGTERM
CMD ["node", "server/index.mjs"]
