# Build stage: full dependency tree, TypeScript emitted to dist/.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# Production dependencies only, resolved separately so no dev tooling reaches the final image.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache wget
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# The migrations ship with the code: src/migrate.ts resolves ../drizzle relative to dist/.
COPY drizzle ./drizzle
USER node
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" || exit 1
# Migrate before serving: the container is responsible for its own schema.
CMD ["sh", "-c", "node dist/migrate.js && node dist/index.js"]
