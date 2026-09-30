# Giftit

A family gift-management MVP built with React, Vite, TypeScript, Tailwind CSS, Express, PostgreSQL and Drizzle migrations. **Docker Compose is the only host prerequisite**: no host installation of Node.js, npm, or PostgreSQL is required.

## Getting started

```sh
cp .env.example .env
docker compose up --build
```

Leave `DATABASE_URL` empty in `.env` to use the Compose development database. To override it, provide a PostgreSQL connection URL accessible from the containers (the default database host is `db`). `WEB_ORIGIN` controls the browser origin accepted by the API (default `http://localhost:5173`). Never use development credentials in production.

- Frontend: http://localhost:5173
- JSON API: http://localhost:3000/api
- API migrations run automatically at startup.

In a second terminal, load the sample data (safe to rerun):

```sh
docker compose run --rm api npm run migrate
docker compose run --rm api npm run seed
```

Development accounts: `alice@example.test`, `bob@example.test`, `charlie@example.test`, `david@example.test`, `eloise@example.test`; shared password: **`GiftitDemo2026!`** (development only). Families A and B share Alice and Bob's household; Eloise belongs to a separate family. Alice can access Charlie's and David's lists; Eloise cannot. The seed includes reservations, a pending contribution request and a gifted item. The seed is skipped if the sample accounts already exist: to load updated sample data, run `docker compose down -v`, start Compose again, and rerun the seed.

See [docs/testing-guide.md](docs/testing-guide.md) for what to test manually and how.

## Language

The app supports **English and French**. Select a language in the interface; the preference is saved in the browser. Without a saved preference, the browser language determines the initial language. Dates, currency, interface text and API errors follow the selected language. User-entered content and sample seed data (names, wishes and custom occasions) are not automatically translated.

## Docker commands

```sh
docker compose run --rm api npm test
docker compose run --rm api npm run build
docker compose run --rm api npm run lint
docker compose run --rm web npm run build
docker compose run --rm web npm run lint
docker compose run --rm api npm run generate   # generate a migration after changing the schema
docker compose down                            # retain PostgreSQL data
docker compose down -v                         # also delete PostgreSQL data
```

Source code is mounted into the containers for Vite and `tsx watch` hot reload. Dependencies stay in separate Docker volumes. After changing dependencies, run `docker compose run --rm api npm ci` and/or `docker compose run --rm web npm ci`, then `docker compose up --build`; these commands preserve the PostgreSQL volume. Generated migrations in `apps/api/drizzle/` are tracked in Git.

Integration tests use the seeded development database and create test data. To reset it, run `docker compose down -v`, start Compose again, and rerun the seed.

## API (prefix `/api`)

Authentication uses an HTTP-only SameSite cookie; browser writes validate their origin. Errors are JSON objects of the form `{ "error": "..." }`, with HTTP statuses including 400/401/403/404/409. The API selects French or English error text from `Accept-Language`.

| Domain | Routes |
| --- | --- |
| Authentication | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Profile, people | `GET/PATCH /profile`, `GET /users`, `GET /users/:id/wishes` |
| Households, invitations | `GET /households`, `PATCH /households/:id`, `POST /households/:id/invitations` (use the code on registration) |
| Families | `GET/POST /families`, `PATCH /families/:id`, `POST /families/:id/invitations`, `POST /families/join`, `DELETE /families/:id/households/:householdId`, `POST /families/:id/admins` |
| Occasions | `GET /occasions?recipientId=…`, `POST /families/:id/occasions`, `PATCH/DELETE /occasions/:id` |
| Wishes | `GET/POST /wishes`, `POST /wishes/preview`, `GET/PATCH/DELETE /wishes/:id`, `PATCH /wishes/order` |
| Reservations | `GET/POST /reservations`, `GET/PATCH/DELETE /reservations/:id` |
| Contributions | `GET/POST /reservations/:id/requests`, `PATCH /reservations/:id/requests/:requestId` |
| Overview | `GET /dashboard`, `GET /history`, `GET /search?q=…` |

Reservation occasions use `occasionIds: [{ "id": "uuid", "year": 2026 }]`, allowing multiple occurrences in one reservation. Only non-cancelled reservations are active. A partial unique PostgreSQL index and a row lock on the wish prevent concurrent double reservations. Beneficiaries receive no reservation information for their own wishes, and reservation endpoints respond with 404 for them. Gifted history is an independent JSON snapshot accessible only to the beneficiary and participants.

To connect a household to a family, a family administrator creates a temporary invitation code; **an administrator of the invited household** confirms it with `POST /families/join` (`{ "code": "…" }`). A household ID alone never grants access. Active reservations block removal of a household involved in those reservations.

Birthday occasions use the profile's date of birth. Name-day occasions use the optional `nameDay` profile field in `MM-DD` format (`PATCH /profile`) and have no upcoming occurrence until it is set. Fixed-date occasions use `month` and `day`.

External HTML metadata previews block private addresses, follow a bounded number of redirects while revalidating and pinning the verified DNS address on every hop, and enforce time and size limits. Requests are made over HTTP/2 first and fall back to HTTP/1.1: a real browser always negotiates HTTP/2, so several shops refuse anything that announces a browser over HTTP/1.1 regardless of its headers. Addresses are resolved by querying A and AAAA records directly, because `getaddrinfo` hides IPv4 records for IPv6-first hosts. Successful previews are cached in memory for a day. Sites that still refuse, including ones answering with a 200 holding page, return a readable name derived from the link itself along with an explanatory notice; the image stays optional, so a wish can always be completed by hand. Previews run automatically as soon as a valid link is entered. Users can correct metadata before creating a wish. Afterwards only its tags are editable; deletion is logical.
