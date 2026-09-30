# Deploying Pensa

Two images are published to the GitHub Container Registry on every push to
`main`, for `linux/amd64` and `linux/arm64`:

| Image | Contains | Port |
| --- | --- | --- |
| `ghcr.io/aileo/pensa-api` | the compiled API on Node.js | 3000 |
| `ghcr.io/aileo/pensa-web` | the built interface served by nginx | 8080 |

The web image also proxies `/api` to the API, because the interface calls the
API on its own origin. You therefore expose **one** port to your users.

## Run it

```sh
curl -O https://raw.githubusercontent.com/aileo/pensa/main/compose.prod.yaml
docker compose -f compose.prod.yaml up -d
```

The app is on http://localhost:8080. Nothing else to prepare: the API applies
its own migrations at startup and only reports healthy once the database
answers.

To load the sample data — useful to try the app, never on a real instance:

```sh
docker compose -f compose.prod.yaml exec api node dist/seed.js
```

The accounts it creates are listed in the [testing guide](testing-guide.md).

## Configuration

Everything is set through the environment; `compose.prod.yaml` gives each one a
working default.

| Variable | Used by | Default | Purpose |
| --- | --- | --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | db | `pensa` | database credentials |
| `DATABASE_URL` | api | `postgres://pensa:pensa@db:5432/pensa` | connection string; point it elsewhere to use a managed database |
| `WEB_ORIGIN` | api | `http://localhost:8080` | the origin browsers load the app from |
| `API_UPSTREAM` | web | `http://api:3000` | where nginx forwards `/api` |
| `WEB_PORT` | web | `8080` | published port on the host |
| `API_IMAGE`, `WEB_IMAGE` | — | the GHCR images | override to run locally built images |

**Change the database password before exposing anything.** The defaults exist so
that `docker compose up` works out of the box, not because they are safe.

## Behind a reverse proxy

Terminate TLS in front of the web container and forward to `WEB_PORT`.

**`WEB_ORIGIN` must match the URL your users actually type**, scheme included.
The API compares it against the `Origin` header on every write, so a mismatch
does not degrade gracefully: reads keep working, and every save fails with
*Origine interdite* / *Forbidden origin*. If writes fail while browsing works,
check this variable first.

```yaml
# example: served at https://pensa.example.org
services:
  api:
    environment:
      WEB_ORIGIN: https://pensa.example.org
```

## Health

`GET /api/health` answers `{"status":"ok"}`, and `503` when the database cannot
be queried. Both containers already declare a Docker health check; use the same
endpoint for an external monitor or a Kubernetes probe.

## Upgrading

```sh
docker compose -f compose.prod.yaml pull
docker compose -f compose.prod.yaml up -d
```

Pending migrations are applied by the API when it starts, so upgrading is just
pulling a newer image. Migrations only ever add to the schema; still, take a
backup first — see below.

Images are tagged `latest`, the short commit SHA, and `x.y` / `x.y.z` for
version tags. Pin a SHA or a version if you would rather decide when to move.

## Backup

All state is in the PostgreSQL volume.

```sh
docker compose -f compose.prod.yaml exec db pg_dump -U pensa pensa > pensa.sql
```

Restore into an empty database with `psql`. The API will migrate it at the next
start if it comes from an older version.

## Publishing your own images

Fork the repository and the `Release` workflow publishes under your own
namespace, with no configuration: it authenticates with the token GitHub
already provides.

One thing it cannot do for you: **packages are created private by default**.
The workflow succeeds, the images exist, and nobody can pull them. After the
first release, open each package's settings and switch it to public.
