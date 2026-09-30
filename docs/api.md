# API reference

All routes are under `/api`.

Authentication uses an HTTP-only, SameSite cookie. Writes from a browser
validate their `Origin` against `WEB_ORIGIN`. Errors are JSON objects shaped
`{ "error": "..." }` with the usual statuses — 400, 401, 403, 404, 409, 429 —
and their text follows `Accept-Language`, French or English.

## Routes

| Domain | Routes |
| --- | --- |
| Health | `GET /health` |
| Configuration | `GET /config` |
| Authentication | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Profile, people | `GET/PATCH /profile`, `GET /users`, `GET /users/:id/wishes` |
| Households, invitations | `GET /households`, `PATCH /households/:id`, `POST /households/:id/invitations` |
| Families | `GET/POST /families`, `PATCH /families/:id`, `POST /families/:id/invitations`, `POST /families/join`, `DELETE /families/:id/households/:householdId`, `POST /families/:id/admins` |
| Occasions | `GET /occasions?recipientId=…`, `POST /families/:id/occasions`, `PATCH/DELETE /occasions/:id` |
| Wishes | `GET/POST /wishes`, `POST /wishes/preview`, `GET/PATCH/DELETE /wishes/:id`, `PATCH /wishes/order` |
| Reservations | `GET/POST /reservations`, `GET/PATCH/DELETE /reservations/:id` |
| Contributions | `GET/POST /reservations/:id/requests`, `PATCH /reservations/:id/requests/:requestId` |
| Overview | `GET /dashboard`, `GET /history`, `GET /search?q=…` |

Rate limiting applies to `/api`: 300 requests per 15 minutes, and 20 on
sensitive authentication routes. Limits are counted per visitor, which behind a
reverse proxy requires `TRUST_PROXY` to match the number of proxies in front of
the API. `GET /api/health` and `GET /api/config` are registered before the
limiter so that container probes and the sign-in page never consume the budget.

`GET /api/config` is public and answers `{"openRegistration": true|false}`. The
interface reads it to know whether the invitation field is required; the server
enforces the rule regardless.

## Origins

Writes must carry an `Origin` matching the address the request was actually made
to, which the API reconstructs from `X-Forwarded-Proto` and `X-Forwarded-Host`
(falling back to `Host`). A reverse proxy therefore needs no configuration.
`WEB_ORIGIN` adds an optional comma-separated allowlist on top of that. A
refusal answers `403` and logs both the received and the expected origin.

## Registration

Without `OPEN_REGISTRATION=true`, `POST /auth/register` requires an invitation
code — except when the `users` table is empty, so the first account of a new
instance can always be created. That check runs inside the transaction behind an
advisory lock, so two simultaneous first sign-ups cannot both become admins.

The `invitation` field accepts **either** kind of code, since the person holding
one cannot tell which they were given:

| Code | Household | Household admin | Family |
| --- | --- | --- | --- |
| household | the invitation's | no | unchanged |
| family | created automatically | yes | joined |
| none | created automatically | yes | none |

## Reservations

Occasions are attached as `occasionIds: [{ "id": "uuid", "year": 2026 }]`, so
one reservation can cover several occurrences. Only non-cancelled reservations
count as active.

Concurrent reservations of the same wish are prevented structurally, by a
partial unique index plus a row lock on the wish — not by checking first and
inserting after.

**Beneficiaries receive nothing about their own wishes**: reservation endpoints
answer `404` for them, because a `403` would confirm that a reservation exists.
Gifted history is a separate snapshot, readable only by the beneficiary and the
participants.

## Joining a household or a family

A family administrator creates a temporary invitation code, and **an
administrator of the invited household** confirms it with
`POST /families/join` (`{ "code": "…" }`). Knowing a household identifier never
grants access.

Household invitation codes are a different thing: they are used during
registration, to join an existing household. A family code can also be used at
registration, by someone who has no account yet — they get a household of their
own, already attached to the family, without needing anyone to confirm it.

A household taking part in active reservations cannot be removed from a family.

## Occasions

- **Birthday** occasions use the profile's date of birth.
- **Name day** occasions use the optional `nameDay` profile field in `MM-DD`
  format, set through `PATCH /profile`. Until it is set, the occasion has no
  upcoming occurrence.
- **Fixed date** occasions use `month` and `day`.

## Link previews

`POST /wishes/preview` fetches metadata for a URL. It is a server fetching a
user-supplied address, so it is treated as such: private address ranges are
blocked, redirects are bounded, and the verified DNS address is re-pinned on
every hop, so a redirect cannot swing to an internal host after the check.
Time and size limits are enforced, and successful previews are cached in memory
for a day.

Two details that were found the hard way:

- **Requests go over HTTP/2 first**, falling back to HTTP/1.1. A real browser
  always negotiates HTTP/2, so several shops refuse anything announcing a
  browser over HTTP/1.1, whatever its headers say.
- **Addresses are resolved by querying A and AAAA records directly**, because
  `getaddrinfo` hides IPv4 records on IPv6-first hosts.

Sites that still refuse — including those answering `200` with a holding page —
return a readable name derived from the link itself, plus a notice explaining
what happened. The image stays optional, so a wish can always be completed by
hand.
