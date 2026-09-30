# Working on this repository

Instructions for anyone — human or AI agent — writing code here. They are the
house rules; the reasoning behind each one lives in [docs/](docs/README.md).

## Everything you write is in English

Code, identifiers, comments, commit messages, documentation and pull request
descriptions: English, always. The project is public and contributors do not
all read French.

The one exception is **user-facing copy**, which is French-first by design.
`apps/web/src/locale.ts` maps a French string to its English translation, so
the French text *is* the key:

```ts
'Réserver ce cadeau': 'Reserve this gift',
```

Add both. The build fails on a French string with no English counterpart — it
will not save you from an awkward translation.

## Docker is the only runtime

Nothing is installed on the machine: no Node.js, no npm, no PostgreSQL. Every
command runs in a container.

```sh
cp .env.example .env
docker compose up --build -d
docker compose run --rm api npm run seed
```

Run tools through Compose, never directly:

```sh
docker compose run --rm web npm run lint
docker compose run --rm api npm test
```

If you need a one-off script, run it in a container too
(`docker run --rm -v "$PWD:/w" -w /w node:22-alpine node script.js`). A command
that assumes a local toolchain will fail for the next person even if it works
for you.

Dependencies live in Docker volumes, not in your working copy. `node_modules/`
is never committed and is not there to read.

## Lint before every commit

Run what CI runs, and run it before committing — not after being told it broke:

```sh
docker compose run --rm web npm run lint
docker compose run --rm web npm run build
docker compose run --rm api npm run lint
docker compose run --rm api npm run typecheck
docker compose run --rm api npm test
```

Tests need the seeded database and send requests with the
`http://localhost:5173` origin, so run them without port overrides. They write
to the development database: reset and reseed before manual testing.

## Things CI cannot catch

- **Schema changes** — after editing `apps/api/src/schema.ts`, run
  `docker compose run --rm api npm run generate` and **commit the generated SQL**
  in `apps/api/drizzle/`. Without it, existing installations cannot upgrade.
- **Colours** — use the tokens in `apps/web/src/index.css`. A new hue has to be
  measured against [the contrast table](docs/design-system.md) before it stays.
- **Interface behaviour** — walk the relevant part of
  [the testing guide](docs/testing-guide.md) and say in the pull request what
  you checked by hand.
- **The privacy rule** — nobody ever sees what is reserved for them. The API
  answers `404`, not `403`, so the absence itself gives nothing away. Any new
  route touching reservations must keep that true.

## Repository conventions

- **Never publish a release on your own initiative.** Tagging a version,
  creating a GitHub release or bumping the version numbers happens only when a
  human explicitly asks for it. Pushing to `main` is enough to publish `latest`
  images; a tag publishes the version images that real deployments follow, and
  that decision belongs to a person. Write the changelog entry under
  *Unreleased* and stop there.
- **A release updates `compose.stable.yaml`.** It names the published version
  explicitly — there is no moving `stable` tag — so the release commit bumps
  those two image lines together with the three `package.json` versions and the
  changelog heading. Forgetting it leaves every deployment on the previous
  version.
- **No npm workspaces.** The two apps are independent: separate lockfiles,
  separate build contexts, different pinned TypeScript versions. The root
  `package.json` holds metadata only. Declaring workspaces without a root
  lockfile breaks `npm ci` in CI — it already happened once.
- **Comment only what needs explaining.** Prefer a name that makes the comment
  unnecessary.
- **One concern per commit and per pull request.** Write the message for
  whoever runs `git log` in a year: what changed, and why it had to.
- **Documentation lives in `docs/`.** The README answers only *why this app*,
  *how to deploy it* and *how to contribute*; reference material goes in a
  `docs/` file and is linked from [the index](docs/README.md).
- **The site is built from `docs/`, never written in `site/`.** `site/` holds
  the home page, the theme and the VitePress configuration; a prebuild script
  copies the documentation in and repairs the links that point outside `docs/`.
  Adding a page means adding it to `docs/`, to the index and to the sidebar in
  `site/.vitepress/config.ts`. The build fails on a dead internal link, which
  is the only check the documentation has.
- **The user guide is the one bilingual document.** `docs/user-guide.md` and
  `docs/guide-utilisateur.md` are written for people who use the app, not for
  contributors, and a change to one belongs in the same commit as the change to
  the other. Everything else stays English-only.

## Where things are

| Path | What it holds |
| --- | --- |
| `apps/api/src/app.ts` | every route and rule |
| `apps/api/src/schema.ts` | Drizzle schema |
| `apps/api/drizzle/` | generated migrations, committed |
| `apps/web/src/App.tsx` | the whole interface |
| `apps/web/src/locale.ts` | FR → EN translations |
| `apps/web/src/index.css` | theme tokens |
| `docs/` | the documentation |
| `site/` | the documentation site: home page, theme, VitePress config |

The full tour is in [the development guide](docs/development.md).
