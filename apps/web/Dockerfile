# The bundle is plain static files, identical whatever the target architecture, so the build
# always runs on the builder's own platform. Emulating it instead makes Vite and Tailwind's
# native binaries crawl under QEMU, to the point where the arm64 build never finishes.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app/apps/web
COPY apps/web/package*.json ./
RUN npm ci
COPY apps/web/ ./
COPY packages/contracts ../../packages/contracts
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
# Overridable at run time: point it at wherever the API actually lives.
ENV API_UPSTREAM=http://api:3000
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
