# Build stage: full dependency tree, TypeScript emitted to dist/. The emitted JavaScript does not
# depend on the architecture, so this runs on the builder's platform rather than under emulation.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app/apps/api
COPY apps/api/package*.json ./
RUN npm ci
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json ./
COPY apps/api/src ./src
COPY packages/contracts ../../packages/contracts
RUN npm run build

# Production dependencies only, resolved separately so no dev tooling reaches the final image.
FROM node:22-alpine AS deps
WORKDIR /app/apps/api
COPY apps/api/package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache wget
COPY --from=deps /app/apps/api/node_modules ./node_modules
COPY --from=build /app/apps/api/dist/apps/api/src ./dist
COPY apps/api/package.json ./package.json
# The migrations ship with the code: src/migrate.ts resolves ../drizzle relative to dist/.
COPY apps/api/drizzle ./drizzle
USER node
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" || exit 1
# Migrate before serving, and create the first account when one is configured: the container is
# responsible for its own schema, and for being usable on first start.
CMD ["sh", "-c", "node dist/migrate.js && node dist/bootstrap.js && node dist/index.js"]
