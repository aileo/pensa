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
sensitive authentication routes. `GET /api/health` is registered before the
limiter so that container probes never consume the budget.

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
registration, to join an existing household.

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
