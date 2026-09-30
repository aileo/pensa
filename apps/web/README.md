# Pensa web application

React, TypeScript, Vite and Tailwind CSS frontend with English and French UI. For setup **without Node.js on the host**, use the [repository Docker Compose instructions](../../README.md). Run frontend checks with:

```sh
docker compose run --rm web npm run build
docker compose run --rm web npm run lint
```

Vite proxies `/api` to `http://localhost:3000` by default. Set `VITE_API_PROXY_TARGET` if the API is elsewhere (Compose already sets it to `http://api:3000`). In production, configure the web server to forward `/api` to the backend. Authentication uses browser cookies (`credentials: include`).

The language selector stores the user's English/French preference locally. Without a saved preference, the browser language is used. API requests send the selected language in `Accept-Language`; dates and currency use the same locale. User-entered content is not translated.

Pages consume the API's direct JSON responses. Selected reservation occasions are sent as `{ id, year }`; the form offers the next occurrence and the following year. An occasion without a calculated date cannot be selected. Contribution requests for reservations created by the user are fetched separately.

A family view displays only that family's `members` returned by `GET /families` rather than mixing in members of other families. Family administrators can view `households`, rename the family and generate a family invitation code; household administrators can join via that code. Household invitation codes for registering users are separate.

Another person's wish list supports `tag`, `availability`, `minPrice` and `maxPrice` filters. Empty parameters are omitted, and availability information is never shown for the wish owner.
