# Aftershock, self-hosted: the Next.js app with in-process workflows and the Docker runner.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Only so the build can render; the real secret is provided at runtime.
ENV AUTH_SECRET=build-time-placeholder-not-a-secret-0000 NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates curl && rm -rf /var/lib/apt/lists/*
COPY --from=docker:27.3.1-cli /usr/local/bin/docker /usr/local/bin/docker
WORKDIR /app
COPY --from=build /app ./
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    AFTERSHOCK_RUNNER=docker AFTERSHOCK_WORKFLOWS=inline \
    AFTERSHOCK_WORK_DIR=/var/lib/aftershock/runs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD curl -fsS http://127.0.0.1:3000/signin >/dev/null || exit 1
CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
