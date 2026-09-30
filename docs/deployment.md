# Deploying Pensa

Two images are published to the GitHub Container Registry, for `linux/amd64`
and `linux/arm64`: `latest` on every push to `main`, and the version numbers on
every release.

| Image | Contains | Port |
| --- | --- | --- |
| `ghcr.io/aileo/pensa-api` | the compiled API on Node.js | 3000 |
| `ghcr.io/aileo/pensa-web` | the built interface served by nginx | 8080 |

The web image also proxies `/api` to the API, because the interface calls the
API on its own origin. You therefore expose **one** port to your users: the API
container has no published port at all and is only reachable from inside the
stack.

## Run it

Three files: the stack, the overlay naming the latest release, and the settings.

```sh
curl -O https://raw.githubusercontent.com/aileo/pensa/main/compose.prod.yaml
curl -O https://raw.githubusercontent.com/aileo/pensa/main/compose.stable.yaml
curl -o .env https://raw.githubusercontent.com/aileo/pensa/main/.env.example
docker compose -f compose.prod.yaml -f compose.stable.yaml up -d
```

The app is on http://localhost:8080. Nothing else to prepare: the API applies
its own migrations at startup and only reports healthy once the database
answers.

`.env.example` is entirely commented out, so downloading it as `.env` changes
nothing on its own — it is there to show you every setting, with its default,
at the moment you need it. At minimum, uncomment `POSTGRES_PASSWORD` **before
the first start**: afterwards the database keeps the password it was created
with, and editing the file will only stop the API from connecting.

To load the sample data — useful to try the app, never on a real instance:

```sh
docker compose -f compose.prod.yaml exec api node dist/seed.js
```

The accounts it creates are listed in the [testing guide](testing-guide.md).

## Configuration

Everything is set through the environment, read from the `.env` file next to
your Compose file. Every variable has a working default; this is the full list.

### Database

The API builds its connection from these fields rather than from a URL, so a
generated password containing `@`, `/`, `:` or `#` needs no encoding. The same
variables configure the database container, so each credential is written once.

| Variable | Default | Purpose |
| --- | --- | --- |
| `POSTGRES_USER` | `pensa` | database role |
| `POSTGRES_PASSWORD` | `pensa` | its password — change it before the first start |
| `POSTGRES_DB` | `pensa` | database name |
| `POSTGRES_HOST` | `db` | the service name inside the stack |
| `POSTGRES_PORT` | `5432` | database port |
| `DATABASE_URL` | — | a full connection string; when set it wins over everything above. Use it for a managed database |

### API

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | port the API listens on inside its container; never published on the host |
| `WEB_ORIGIN` | `http://localhost:8080` | optional comma-separated allowlist of origins; usually leave it alone |
| `TRUST_PROXY` | `1` | how many proxies sit in front of the API, so rate limits see the visitor |
| `OPEN_REGISTRATION` | `false` | allow signing up without an invitation code |

There is no session secret to set: sessions are random tokens stored in the
database, so nothing has to be kept in step between restarts.

### First account

Set together, these create the first account on the first start — see
[Who can sign up](#who-can-sign-up) below.

| Variable | Default | Purpose |
| --- | --- | --- |
| `BOOTSTRAP_EMAIL` | — | switches the bootstrap on; the next four are then required |
| `BOOTSTRAP_PASSWORD` | — | at least 12 characters, as in the sign-up form |
| `BOOTSTRAP_FIRST_NAME` | — | first name |
| `BOOTSTRAP_LAST_NAME` | — | last name |
| `BOOTSTRAP_BIRTH_DATE` | — | `YYYY-MM-DD`; birthdays are half the point of the app |
| `BOOTSTRAP_HOUSEHOLD` | `Foyer de <first name>` | name of the household |
| `BOOTSTRAP_FAMILY` | — | also creates that family, with its default occasions, and makes the account its admin |

### Web container

| Variable | Default | Purpose |
| --- | --- | --- |
| `WEB_PORT` | `8080` | published port on the host; point your reverse proxy at it |
| `API_UPSTREAM` | `http://api:3000` | where nginx forwards `/api` |
| `API_IMAGE`, `WEB_IMAGE` | the GHCR images | override to pin a version or run locally built images |

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

### Creating that first account from the environment

If you would rather not open the sign-up form at all — because you are
deploying from a script, or because you want the instance usable the moment it
answers — fill in the bootstrap variables:

```sh
BOOTSTRAP_EMAIL=you@example.org
BOOTSTRAP_PASSWORD=change-me-after-first-login
BOOTSTRAP_FIRST_NAME=Camille
BOOTSTRAP_LAST_NAME=Durand
BOOTSTRAP_BIRTH_DATE=1985-07-24
BOOTSTRAP_FAMILY=Famille Durand
```

The account is created on the first start, as admin of its household, and of
the family too when you name one. It is safe to leave these in place: the
bootstrap does nothing as soon as any account exists, so restarting, upgrading
or recreating the container never touches a live instance. It is an install,
not a repair — there is deliberately no way to recreate an admin this way once
the instance is in use.

A mistake stops the container instead of starting without the account you are
waiting for: a password under 12 characters, a date that is not `YYYY-MM-DD`,
or one of the four required fields left out. `docker compose logs api` names
the variable to fix.

**That password is readable by anyone who can read the file.** Use it to sign
in the first time, then change it from your profile.

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

Upgrading is deliberate: `compose.stable.yaml` names an exact version, so
download it again before pulling and you can read what you are about to run.

```sh
curl -O https://raw.githubusercontent.com/aileo/pensa/main/compose.stable.yaml
docker compose -f compose.prod.yaml -f compose.stable.yaml pull
docker compose -f compose.prod.yaml -f compose.stable.yaml up -d
```

Pending migrations are applied by the API when it starts, so upgrading is just
pulling a newer image. Migrations only ever add to the schema; still, take a
backup first — see below.

### Which tag to follow

| Tag | Moves when | Good for |
| --- | --- | --- |
| `0.3.0` | never | production. This is what `compose.stable.yaml` names |
| `0.3` | on patch releases | production, accepting fixes without re-reading the file |
| `latest` | anything lands on `main` | trying out what is coming, knowing it is unreleased |

`compose.prod.yaml` alone uses `latest`, which tracks the `main` branch and
therefore carries code that has not been released. `compose.stable.yaml` is a
two-line overlay naming the latest release; it is always used *alongside* the
main file, never on its own:

```sh
docker compose -f compose.prod.yaml -f compose.stable.yaml up -d
```

There is no moving `stable` tag on purpose. A pointer that changes under you
means an unplanned `pull` can bring in a behaviour change you never read about
— and below `1.0`, a minor bump may do exactly that. Every release updates the
two lines of this file instead, so upgrading always starts with a diff.

To pin a version yourself instead, set the image variables in your `.env`:

```sh
API_IMAGE=ghcr.io/aileo/pensa-api:0.3.0
WEB_IMAGE=ghcr.io/aileo/pensa-web:0.3.0
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
