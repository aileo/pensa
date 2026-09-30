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
| `WEB_ORIGIN` | api | `http://localhost:8080` | optional allowlist of origins; usually leave it alone |
| `OPEN_REGISTRATION` | api | `false` | allow signing up without an invitation code |
| `TRUST_PROXY` | api | `1` | how many proxies sit in front of the API, so rate limits see the visitor |
| `API_UPSTREAM` | web | `http://api:3000` | where nginx forwards `/api` |
| `WEB_PORT` | web | `8080` | published port on the host |
| `API_IMAGE`, `WEB_IMAGE` | — | the GHCR images | override to run locally built images |

**Change the database password before exposing anything.** The defaults exist so
that `docker compose up` works out of the box, not because they are safe.

## Who can sign up

Registration is **invitation-only by default**. Someone who finds your URL sees
the sign-in page and cannot create an account without a code.

There is one exception, and it is the one you need: **the first account of an
empty database is always allowed**. Deploy, open the site, sign up — you are the
first household, and the door closes behind you. From there every other account
comes from a code you hand out, either an invitation to your household or an
invitation to one of your families. A family code gives the newcomer a household
of their own, already attached to that family.

Set `OPEN_REGISTRATION=true` if you would rather let anyone join, for instance on
a throwaway instance you are only using to try the app out.

## Behind a reverse proxy

Terminate TLS in front of the web container and forward to `WEB_PORT`. **There is
nothing else to configure.** The interface calls the API on its own address, so
the API accepts writes coming from whatever address the request was actually made
to — it reads that from the `X-Forwarded-Proto` and `X-Forwarded-Host` headers
your proxy already sends, whatever your domain happens to be.

Two headers do need to reach it, which nginx and Traefik send by default:

```nginx
proxy_set_header Host              $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
```

Without `X-Forwarded-Proto`, an HTTPS site looks like plain HTTP to the API and
every save fails with *Origine interdite* / *Forbidden origin*. If writes fail
while browsing works, that is what to check — and the API logs the origin it
received next to the one it expected, so `docker compose logs api` says so
outright.

If you put a proxy of your own in front of the web container, count it:

```yaml
services:
  api:
    environment:
      TRUST_PROXY: 2
```

This only affects rate limiting, but getting it wrong matters: the API counts
login attempts per visitor, and a proxy it cannot see through makes everyone
share a single budget — one person fumbling their password locks out the family.

`WEB_ORIGIN` is still there for anyone who prefers to pin the accepted origins
explicitly, as a comma-separated list. It is no longer required.

```yaml
# example: pinning the origin, served at https://pensa.example.org
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
version tags. Pin a SHA or a version if you would rather decide when to move:

```yaml
services:
  api:
    image: ghcr.io/aileo/pensa-api:0.1.0
  web:
    image: ghcr.io/aileo/pensa-web:0.1.0
```

Read the [changelog](../CHANGELOG.md) before moving between minor versions —
below `1.0`, a minor bump may change behaviour.

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
