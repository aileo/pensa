# Changelog

All notable changes are recorded here. This project follows
[semantic versioning](https://semver.org/): while the major version is `0`, a
minor bump may change behaviour.

## [Unreleased]

### Added

- **A name day for members without an account.** The field existed on your own
  profile but nowhere for the people your household keeps a list for, so their
  *Fête* occasion could never be announced. *Ajouter un membre sans compte* now
  asks for it, and a new *Modifier la fiche* form reopens the whole record —
  first name, last name, date of birth and name day — so a forgotten date no
  longer means recreating the person. Household member listings carry `nameDay`
  for the caller's own household only, which is what lets the form prefill
  itself; the family listing still omits it.
- **Shortcuts to the lists your household keeps.** Reaching a child's list meant
  walking through *Ma famille*, finding them and opening their page. The
  dashboard now has a *Les listes que je tiens* section, and a row of shortcuts
  sits at the top of *Mes envies* and of any managed list, so one click switches
  between your own list and theirs.
- **Upcoming occasions open the list they concern.** Each occasion on the
  dashboard is now a button leading straight to the wish list of the person
  whose date is approaching, instead of a line of text you then had to go and
  look up by hand.

## [0.4.0] — 2026-09-30

### Added

- **A user guide, in French and English.** The documentation explained how to
  deploy and how to develop, never how to *use* the app. `docs/user-guide.md`
  and `docs/guide-utilisateur.md` walk through writing a list, occasions,
  reserving, the reserved/bought/wrapped/given tracker, off-list gifts,
  contributions, members without an account, history and the rule underneath
  all of it. It is the one bilingual document in the repository — the people it
  is written for are not the ones who read the API reference.
- **A documentation site**, built with VitePress and published to
  [aileo.github.io/pensa](https://aileo.github.io/pensa/) on every push to
  `main`. The home page is in French — the people the app is for read French —
  and carries the pitch already written on the landing page; `site/en.md` is
  the same page in English. The rest is the existing markdown:
  `site/scripts/collect.mjs` copies `docs/`, `AGENT.md` and `CHANGELOG.md` in
  and repairs the links that point outside `docs/`, so nothing is duplicated
  and everything stays readable on GitHub. The build fails on a dead internal
  link, which gives the documentation a check it never had. Preview it with
  `docker compose up site` on http://localhost:5175.

## [0.3.0] — 2026-09-30

### Added

- **Members without an account, managed by the household.** A child now exists
  in Pensa as a real person — date of birth, occasions, wish list — without
  being able to sign in. Any administrator of their household writes and curates
  their list, and the dashboard says so when that list is still empty. Nothing
  changes for the rest of the family: they see an ordinary list and reserve on
  it. Two routes end the arrangement, a claim code the person redeems from the
  sign-in screen, or credentials an administrator sets on the spot; once
  independent, they or an administrator can move them out into their own
  household, automatically attached to the same families.
- **A first account can be created from the environment.** Set the `BOOTSTRAP_*`
  variables and the account, its household and optionally its family exist the
  moment the instance answers — no sign-up form to fill in, so an instance can
  be deployed from a script. It only ever runs on an empty database, so
  restarting or upgrading never touches a live instance.
- **`compose.stable.yaml`**, a two-line overlay naming the latest published
  release. `latest` follows the `main` branch and therefore carries unreleased
  code, so production should not use it. The version is written out rather than
  hidden behind a moving tag: upgrading starts by downloading the file again
  and reading the diff, and every release updates those two lines. Used
  together with the main file:
  `docker compose -f compose.prod.yaml -f compose.stable.yaml up -d`.

### Changed

- **The database connection is built from the `POSTGRES_*` variables** when
  `DATABASE_URL` is not set. `compose.prod.yaml` no longer repeats the
  credentials in a hardcoded URL, so changing `POSTGRES_PASSWORD` is enough —
  previously the database accepted the new password while the API kept sending
  the old one. A generated password containing `@`, `/` or `:` also no longer
  needs percent-encoding. `DATABASE_URL` still takes priority, for managed
  databases.
- **`.env.example` now documents every variable**, for development and
  production alike, with every line commented out so copying it changes nothing.
  The deployment quickstart downloads it alongside the Compose files.
- `docs/deployment.md` lists every environment variable the app reads, grouped
  by what they configure, and the README gained a copy-paste production
  quickstart.

### Fixed

- **Logging in over plain HTTP works.** The session cookie was marked `secure`
  whenever the image ran with `NODE_ENV=production`, which is always, so a
  browser reaching an instance that has no TLS in front of it silently refused
  to send it back: the sign-in appeared to succeed and every page then asked for
  a login again. It now follows the scheme the request actually arrived on.
- **The `arm64` images are published again.** Both images ran their Node build
  step under emulation, and the web build — Vite and Tailwind, which rely on
  native binaries — became slow enough that the release job never finished and
  held every later release behind it. The build stages now run on the builder's
  own architecture, which they can because they only emit JavaScript and static
  files, and the release job gives up after thirty minutes instead of hanging.

## [0.2.0] — 2026-09-30

**Registration is now invitation-only by default.** If you are upgrading an
instance that people were signing up to freely, set `OPEN_REGISTRATION=true` to
keep the previous behaviour. The first account of an empty database is always
allowed, so a new instance can still be set up.

### Fixed

- **Account creation behind a reverse proxy no longer fails with a 403**
  *Origine interdite*. The API now recognises the address a request was actually
  made to, from the headers the proxy already sends, instead of requiring
  `WEB_ORIGIN` to be set to the exact public URL. `WEB_ORIGIN` remains available
  as an optional allowlist, and now accepts several origins separated by commas.
  When an origin is refused, the API logs the one it received next to the one it
  expected.
- **Rate limits count each visitor again.** Behind a proxy they were counted per
  proxy, which meant one person fumbling their password consumed the login
  budget of everyone else. The new `TRUST_PROXY` variable, `1` by default, says
  how many proxies sit in front of the API.
- The web image no longer overwrites `X-Forwarded-Proto`, which made an HTTPS
  site look like plain HTTP to the API.

### Added

- `OPEN_REGISTRATION` opens sign-up to anyone without an invitation code.
- **An invitation code at registration can now be a family code**, not only a
  household one. The newcomer gets a household of their own, already attached to
  the family. Previously a family code could only be used by someone who already
  had an account, which would have made a closed instance impossible to grow.
- `GET /api/config` reports whether registration is open, so the sign-in page
  asks for a code instead of refusing a filled-in form.

## [0.1.0] — 2026-09-30

First public release. The app is usable end to end and the images are published,
but it has not yet run for a full gift season — hence `0.x`.

### Organising gifts

- **Wish lists** with a title, a description, a link, a price and a priority.
  Link previews fetch the title, the image and the price from the merchant page.
- **Households and families.** A household groups the people who live together;
  a family connects households. Two kinds of invitation code, one to join a
  household, one to join a family — and a family join needs the household's
  consent.
- **Occasions**: birthdays, name days and Christmas, each recurring on its own
  date, listed chronologically with the age reached for birthdays.
- **Reservations** with a progress tracker — reserved, bought, wrapped, given —
  each step being a concrete thing left to do. A reservation can cover several
  occurrences at once.
- **Off-list gifts**, for what was thought of outside anyone's list, optionally
  made visible to the family so others can join in.
- **Contributions**: ask to share the cost of a gift someone else reserved; the
  owner of the reservation accepts or declines.
- **History** of what was given, and **search** across the families you belong to.

### The rule the whole app is built on

You never see what is meant for you. The API answers `404` rather than `403`, so
the absence itself gives nothing away — no "you are not allowed to see this",
which would already be a hint.

### Interface

- French and English, switchable, detected from the browser on first visit.
- A warm rosewood, terracotta and sage palette, with every dark step chosen on
  measured WCAG contrast rather than by eye.
- Icons illustrating actions and screens; colour is never the only clue.
- A scrollable landing page that explains what the app is for before asking for
  an account.

### Running it

- Two images published for `linux/amd64` and `linux/arm64`:
  `ghcr.io/aileo/pensa-api` and `ghcr.io/aileo/pensa-web`.
- `compose.prod.yaml` for a one-command deployment; the web image proxies
  `/api`, so a single port is exposed.
- Migrations are applied by the API at startup, in development and production
  alike.
- `GET /api/health` for monitoring, wired to both Docker health checks.

### Documentation

[Features](docs/features.md), [deployment](docs/deployment.md),
[development](docs/development.md), [API](docs/api.md),
[design system](docs/design-system.md), a [manual testing guide](docs/testing-guide.md),
[how to contribute](docs/CONTRIBUTING.md) and the [house rules](AGENT.md).

### Honesty

This release was written by an AI agent under human direction. The
[README](README.md) says so in full, and says what it means for you.

[0.4.0]: https://github.com/aileo/pensa/releases/tag/v0.4.0
[0.3.0]: https://github.com/aileo/pensa/releases/tag/v0.3.0
[0.2.0]: https://github.com/aileo/pensa/releases/tag/v0.2.0
[0.1.0]: https://github.com/aileo/pensa/releases/tag/v0.1.0
