# Changelog

All notable changes are recorded here. This project follows
[semantic versioning](https://semver.org/): while the major version is `0`, a
minor bump may change behaviour.

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

[0.1.0]: https://github.com/aileo/pensa/releases/tag/v0.1.0
