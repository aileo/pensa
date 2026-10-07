# Development setup

**Docker Compose is the only prerequisite.** Node.js, npm and PostgreSQL are
never installed on your machine: every command below runs inside a container.

```sh
cp .env.example .env
docker compose up --build
```

- Interface: http://localhost:5173
- API: http://localhost:3000/api

Sources are mounted into the containers, so Vite and `tsx watch` reload on save.
Dependencies live in separate Docker volumes and are not written to your
working copy. Migrations are applied automatically at startup.

`DATABASE_URL` can stay empty in `.env` to use the Compose database. Set it to
use another PostgreSQL instance reachable from the containers — inside Compose
the database host is `db`. `WEB_ORIGIN` is the browser origin the API accepts
writes from, `http://localhost:5173` by default.

Vite proxies `/api` to the API, so the interface always calls its own origin and
authentication cookies work without any CORS dance. Compose points it at
`http://api:3000`; set `VITE_API_PROXY_TARGET` if the API runs elsewhere. In
production the same job is done by nginx — see [deployment](deployment.md).

## Sample data

```sh
docker compose run --rm api npm run seed
```

Five accounts are created, all with the password **`PensaDemo2026!`**:
`alice@`, `bob@`, `charlie@`, `david@` and `eloise@example.test`. Alice and Bob
share a household and belong to two families; Éloïse is in a separate one, and
cannot see the others. The data covers reservations at different stages, a
pending contribution request, a gifted item in history and two off-list gifts.

The seed does nothing if the accounts already exist. To load a newer version,
reset the database first:

```sh
docker compose down -v
docker compose up --build -d
docker compose run --rm api npm run seed
```

The [testing guide](testing-guide.md) details the data and what to check.

## The documentation site

The documentation is also published as a website, built with VitePress and
deployed to GitHub Pages on every push to `main`. Preview it the same way as
everything else — no Node.js on your machine:

```sh
docker compose up site -d
```

It is on http://localhost:5175, and reloads when a file in `docs/` changes.
The copies are what VitePress renders, so a watcher brings each change over
before Vite sees it. It polls rather than waiting for filesystem events, which
do not survive a bind mount on Docker Desktop.

The site never holds documentation of its own. `site/scripts/collect.mjs` copies
`docs/`, `AGENT.md` and `CHANGELOG.md` into the VitePress source tree and
rewrites the links that point outside `docs/`, so the markdown stays readable on
GitHub and lives in one place only. What `site/` does hold is the two home pages
(`site/index.md` in French, `site/en.md` in English), the theme and
`.vitepress/config.ts`.

The home page is French because the people the app is for read French; the
documentation behind it is English, apart from the user guide. That is also why
the link rewriting is not quite uniform: a link to the project README resolves
to `en.md`, since the README is the English pitch, but the French guide is
given its own rule so its link to the AI disclosure lands on the French home
instead.

Beware that the rewriting is a plain search and replace over the whole file,
code spans included — which is why this paragraph describes those paths rather
than spelling them out.

Adding a page means three edits: the file in `docs/`, a row in
[the index](README.md), and an entry in the sidebar in
`site/.vitepress/config.ts`. The build fails on a dead internal link:

```sh
docker compose run --rm site npm run build
```

## Commands

| Command | Purpose |
| --- | --- |
| `docker compose run --rm api npm test` | API tests — needs the seeded database |
| `docker compose run --rm api npm run lint` | API lint |
| `docker compose run --rm api npm run typecheck` | API type checking |
| `docker compose run --rm api npm run build` | compile the API to `dist/` |
| `docker compose run --rm api npm run generate` | generate a migration after a schema change |
| `docker compose run --rm web npm run lint` | interface lint |
| `docker compose run --rm web npm run build` | build the interface |
| `docker compose run --rm site npm run build` | build the documentation site, failing on dead links |
| `docker compose down` | stop, keep the data |
| `docker compose down -v` | stop and delete the data |

Tests write to the development database. Reset and reseed before manual
testing. Run them **without** any port override: they send requests with the
`http://localhost:5173` origin.

## Changing the schema

Edit `apps/api/src/schema.ts`, then:

```sh
docker compose run --rm api npm run generate
```

The generated SQL lands in `apps/api/drizzle/` and **must be committed** — it is
what upgrades existing installations. It is applied at the next start, in
development and in production images alike, through the same programmatic
migrator.

## Changing dependencies

```sh
docker compose run --rm api npm ci     # or: web
docker compose up --build
```

Both commands keep the PostgreSQL volume.

## Repository layout

```
apps/api/            Express + PostgreSQL
  src/app.ts         application setup, middleware and cross-domain endpoints
  src/routes/        families.ts, wishes.ts, reservations.ts
  src/schema.ts      Drizzle schema
  src/metadata.ts    link preview fetching
  src/migrate.ts     applies drizzle/ at startup
  src/seed.ts        sample data
  drizzle/           generated migrations, committed
apps/web/            React + Vite + Tailwind
  src/App.tsx        authentication check and app entry
  src/AppShell.tsx   authenticated page composition and application state
  src/components/    reusable atoms, molecules and organisms
  src/features/      feature-specific UI and behavior
  src/locale.ts      FR → EN translations
  src/index.css      the theme tokens
packages/contracts/ shared API data types imported by both apps
compose.yaml         development stack
compose.prod.yaml    stack using the published images
docs/                this documentation
site/                the documentation site (home page, theme, VitePress config)
```

API domain routes live in `apps/api/src/routes/`; shared middleware and
cross-domain behavior stay in `app.ts`. The browser imports public data types
through `apps/web/src/api.ts`, while the API uses the same contract types for its
response projections. Database row types remain internal to the API.

The frontend keeps application orchestration in `AppShell.tsx`, with general
building blocks under `components/atoms/`, `components/molecules/` and
`components/organisms/`. Feature-specific forms and panels live under
`features/` and compose those shared building blocks. Use these levels where
they clarify responsibility; simple HTML does not need its own component.
`FormField` pairs a label with an input/control atom and optional help text;
complete feature forms compose these molecules rather than defining generic
form behavior in the app shell.

Development and image builds use the repository root as their Docker context
so both apps can resolve `packages/contracts/`. The API and web apps still have
independent package manifests, lockfiles and dependency installations.

## Why there are no npm workspaces

Each app has its own lockfile and pinned TypeScript version. They are installed
independently, and the root `package.json` holds only repository metadata.
Docker image builds use the repository root as context only to include the
shared contract source; this does not make the app packages an npm workspace.

This is worth stating because the opposite was once declared there. Nothing
noticed, since no one ever ran npm from the root — until CI did, per app: npm
walked up, found a workspace root with no lockfile, refused the app lockfile and
failed. If you add a root-level npm concern, add a root lockfile with it.
