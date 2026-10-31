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
| Authentication | `POST /auth/register`, `POST /auth/claim`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Profile, people | `GET/PATCH /profile`, `GET /users`, `GET /users/:id/wishes`, `POST /users/:id/wishes`, `PATCH /users/:id/wishes/order` |
| Households, invitations | `GET /households`, `PATCH /households/:id`, `POST /households/:id/invitations` |
| Managed members | `POST /households/:id/members`, `PATCH/DELETE /households/:id/members/:userId`, `POST /households/:id/members/:userId/invitations`, `POST /households/:id/members/:userId/account`, `POST /households/:id/members/:userId/move-out` |
| Families | `GET/POST /families`, `PATCH /families/:id`, `POST /families/:id/invitations`, `POST /families/join`, `DELETE /families/:id/households/:householdId`, `POST /families/:id/admins`, `DELETE /families/:id/admins/:userId` |
| Occasions | `GET /occasions?recipientId=…`, `POST /families/:id/occasions`, `PATCH/DELETE /occasions/:id` |
| Wishes | `GET/POST /wishes`, `POST /wishes/preview`, `GET/PATCH/DELETE /wishes/:id`, `PATCH /wishes/order` |
| Reservations | `GET/POST /reservations`, `GET/PATCH/DELETE /reservations/:id` |
| Contributions | `GET/POST /reservations/:id/requests`, `PATCH /reservations/:id/requests/:requestId` |
| Overview | `GET /dashboard`, `GET /history`, `GET /search?q=…` |

Rate limiting applies to `/api`: 600 requests per minute, and 20 per 15 minutes on
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

## Managed members

A household administrator can create a person who has no credentials at all:
`POST /households/:id/members` with `firstName`, `lastName`, `birthDate` and an
optional `nameDay`. The person is real everywhere else in the app — occasions,
wishes, reservations — but cannot sign in.

There is no `managed` column: a member is managed when `password_hash IS NULL`,
and a database check keeps `email` and `password_hash` either both set or both
null, so no third state can exist. `POST /auth/login` refuses rows without a
password hash, and the API refuses to make a managed member a household or
family administrator.

Administrators of their own household write their lists through
`POST /users/:id/wishes`, `PATCH /users/:id/wishes/order` and the usual
`PATCH/DELETE /wishes/:id`. `GET /dashboard` adds a `managed_list_empty` todo
while such a list is still empty.

`PATCH …/members/:userId` corrects the whole record — `firstName`, `lastName`,
`birthDate` and `nameDay` — so a name day can be added after the fact. To let
the edit form prefill itself, household member listings carry `nameDay` for
members of the caller's own household only; the family listing keeps the public
projection, which omits it.

Two routes turn a managed member into an independent account:

| Route | Who finishes it | Result |
| --- | --- | --- |
| `POST …/members/:userId/invitations` | the person, with `POST /auth/claim` | a claim code valid 7 days, then they choose their own email and password |
| `POST …/members/:userId/account` | the administrator, on the spot | credentials set directly from `email` and `password` |

Claim codes are stored as invitations bound to a `user_id`, and
`POST /auth/register` ignores them: only `POST /auth/claim` can redeem one.

`DELETE …/members/:userId` removes a managed member entirely, and is refused as
soon as any reservation, participation, request or history entry mentions them.

`POST …/members/:userId/move-out` gives a member their own household, still
attached to every family the origin household belongs to. It requires an
independent account, can be triggered by the person themselves or by an
administrator of their household, and is refused when it would leave the
household empty or without an administrator.

## Reservations

Occasions are attached as `occasionIds: [{ "id": "uuid", "year": 2026 }]`, so
one reservation can cover several occurrences. Only non-cancelled reservations
count as active.

Concurrent reservations of the same wish are prevented structurally, by a
partial unique index plus a row lock on the wish — not by checking first and
inserting after.

**Beneficiaries receive nothing about their own wishes**: reservation endpoints
answer `404` for them, because a `403` would confirm that a reservation exists.
Gifted history is a separate snapshot, readable by members currently sharing a
family with the recipient, **except the recipient**. This deliberately includes
gifts that were private during preparation. It does not grant reservation detail
or management access; active private gifts still require organizer/participant
access. Both the viewer's and recipient's current household memberships are
checked on every history request, so leaving the shared families revokes access
even for former organizers or participants.

Deleting a wish with an active reservation atomically clones its gift data
into a hidden off-list wish and repoints the same reservation. Progress,
participants, requests and occasions remain; `open_to_contributions` becomes
`false`. Only the organizer and existing participants can see the private
gift, including through direct reservation URLs. The organizer may edit it
through the existing off-list lifecycle. A data migration also repairs legacy
active reservations attached to deleted wishes. Completion shares the snapshot
with the recipient's current family circle, excluding the recipient.

## History and search responses

`GET /history` returns only the authorized collection described above. Each
entry returns `id`, `recipientId`, `created_at` and a normalized `snapshot`
containing the gift `id` and optional `title`, `recipient`, `creator` and
`giftedAt`, plus `participants` and `occasions` arrays. Legacy snake_case
identity fields are normalized to `firstName`, `lastName` and `birthDate`.
Historical identities contain only those public fields and `id`; arbitrary
stored user or wish fields are not returned. Missing arrays become empty and
missing optional context is not inferred from current user records.

Recipient filtering and sorting operate on this collection in the UI; no
separate recipient lookup is made. `/history?recipient=<id>&sort=oldest` and
`sort=recipient` preserve selections through browser navigation. The default is
newest first, using `giftedAt` or, when absent, the explicitly labeled record
date. Dates are compared as instants, including timezone offsets. Recipient A-Z
uses the latest snapshot's display name per recipient, then recipient ID, then
newest date, then history ID. Date sorts also break ties by history ID. Missing
recipient names are labeled unavailable, not filled from current user data.
An inaccessible recipient selection produces an empty filter with a generic
unavailable label, never a lookup that reveals their identity.

`GET /search?q=…` returns `{ people, wishes, history }`. Each wish includes an `owner`
public identity so clients can identify its list. Search excludes off-list,
deleted and gifted wishes, and uses the same reservation projection as wish
details: the owner never receives reservation metadata. `history` holds up to
50 entries in the `GET /history` shape, newest first, filtered by the exact same
access rule (never the recipient). Only exposed snapshot fields are matched: the
title, the recipient, creator and participant names, and occasion names. Empty
queries return empty arrays; queries longer than 100 characters return a
validation error.

## Duplicate wishes

`POST /wishes` and `POST /users/:id/wishes` compare the new wish with the
owner's visible list — not deleted, not gifted, not off-list. A wish with the
same normalized link (scheme, `www.`, trailing slash, fragment and tracking
parameters such as `utm_*` ignored; other query parameters sorted) or the same
normalized title (case, accents and whitespace ignored) answers
`409 { error, duplicates }`, where `duplicates` uses the wish detail projection.
Sending `"allowDuplicate": true` saves it anyway. Off-list gifts are never
compared, so the response cannot reveal them to the list owner.

## Joining a household or a family

Family administrators may promote an account-bearing member using
`POST /families/:id/admins` with `{ "userId": "uuid" }`, or demote one using
`DELETE /families/:id/admins/:userId`. Both require current family-admin access
and target membership. Managed members cannot be promoted; concurrent demotions
cannot remove the last administrator. These actions never change household roles
or memberships.

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
