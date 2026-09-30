# Contributing

Contributions are welcome — issues, fixes, features, translations, or simply
telling us where the app is confusing.

The conventions this codebase expects — English everywhere, Docker as the only
runtime, lint before committing — are in [AGENT.md](../AGENT.md). Read it once
before your first change.

## About this project being AI-generated

The code was produced by an AI agent under human direction. That changes
nothing about contributing: your pull request is read, discussed and judged on
what it does, by a human. You are not expected to work with an AI, and you are
free to use one.

If something in the codebase looks odd or over-built, say so. Code nobody
hand-wrote gets less scrutiny than code someone had to type, so an outside
reader pointing at it is genuinely useful.

## Getting set up

Docker Compose is all you need — see [the development guide](development.md).
Nothing is installed on your machine.

```sh
cp .env.example .env
docker compose up --build -d
docker compose run --rm api npm run seed
```

## Before opening a pull request

Run what CI runs:

```sh
docker compose run --rm web npm run lint
docker compose run --rm web npm run build
docker compose run --rm api npm run lint
docker compose run --rm api npm run typecheck
docker compose run --rm api npm test
docker compose run --rm site npm run build
```

CI additionally builds both Docker images, so a change to a `Dockerfile` is
checked on every pull request too.

A few things it cannot check for you:

- **Interface changes** — walk through the relevant part of
  [the testing guide](testing-guide.md).
- **Schema changes** — the generated migration in `apps/api/drizzle/` must be
  committed with the change. Without it, existing installations cannot upgrade.
- **New copy** — add both the French and the English string. The build fails on
  a missing English counterpart, but not on an awkward translation.
- **New colours** — use the existing tokens, or measure the contrast of what
  you add. See [the design system](design-system.md).
- **Documentation** — a behaviour change belongs in `docs/`, and one a user can
  see belongs in both [the user guide](user-guide.md) and
  [its French counterpart](guide-utilisateur.md). The site build catches a dead
  link, not a page that quietly went out of date.

## Commits and pull requests

Write the commit message for whoever runs `git log` in a year: what changed,
and why it needed to. One concern per pull request; a fix and a refactor in the
same diff are hard to review and harder to revert.

Explain what you did manually to convince yourself the change works.

## Reporting a bug

Say what you expected, what happened, which language you were using, and
whether you were on the development stack or the published images. If it
involves a link preview, include the link — those failures are usually specific
to one site.

## Security

Do not open a public issue for a vulnerability. Use GitHub's private
vulnerability reporting on the repository instead.

## Licence

Contributions are accepted under the [MIT licence](../LICENSE), like the rest
of the project.
