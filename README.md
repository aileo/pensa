# Giftit

MVP de gestion familiale de cadeaux : React/Vite/TypeScript/Tailwind, API Express/TypeScript, PostgreSQL et migrations Drizzle. **Docker Compose est le seul prérequis** ; aucun Node.js, gestionnaire de paquets ou PostgreSQL ne doit être installé sur l'hôte.

## Démarrage

```sh
cp .env.example .env
docker compose up --build
```

La variable `DATABASE_URL` vide dans `.env.example` utilise la base de développement de Compose. Pour la personnaliser, renseigner une URL PostgreSQL accessible depuis les conteneurs (hôte `db` par défaut). `WEB_ORIGIN` est l'origine autorisée du navigateur (par défaut `http://localhost:5173`). Ne jamais employer le mot de passe de développement en production.

- Frontend : http://localhost:5173
- API JSON : http://localhost:3000/api
- La migration est appliquée automatiquement au démarrage de l'API.

Dans un autre terminal, charger les données de démonstration (réexécution sans doublons) :

```sh
docker compose run --rm api npm run migrate
docker compose run --rm api npm run seed
```

Comptes : `alice@example.test`, `bob@example.test`, `charlie@example.test`, `david@example.test`, `eloise@example.test` ; mot de passe commun **`GiftitDemo2026!`** (développement uniquement). Familles A et B partagent le foyer Alice/Bob ; Éloïse appartient à une famille isolée. Alice voit Charlie et David, Éloïse ne les voit pas. Le seed inclut des réservations, une contribution en attente et un cadeau offert.

## Commandes Docker

```sh
docker compose run --rm api npm test
docker compose run --rm api npm run build
docker compose run --rm api npm run lint
docker compose run --rm web npm run build
docker compose run --rm web npm run lint
docker compose run --rm api npm run generate   # générer une migration après modification du schéma
docker compose down                            # conserver PostgreSQL
docker compose down -v                         # supprimer également les données
```

Le code est monté dans les conteneurs : Vite et `tsx watch` redémarrent automatiquement, les dépendances restent dans des volumes Docker distincts. Après changement de dépendances, exécuter `docker compose run --rm api npm ci` et/ou `docker compose run --rm web npm ci`, puis `docker compose up --build` ; ces commandes ne touchent pas au volume PostgreSQL. Les fichiers de migration générés sous `apps/api/drizzle/` sont versionnés.
Les tests d'intégration utilisent la base de développement chargée avec le seed et créent des données de test ; `docker compose down -v` suivi d'un redémarrage et du seed permet de repartir de zéro.

## API (préfixe `/api`)

La session utilise un cookie HTTP-only SameSite ; les écritures navigateur contrôlent l'origine. Réponses d'erreur JSON `{ "error": "..." }`, codes 400/401/403/404/409.

| Domaine | Routes |
| --- | --- |
| Authentification | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Profil, personnes | `GET/PATCH /profile`, `GET /users`, `GET /users/:id/wishes` |
| Foyers, invitations | `GET /households`, `PATCH /households/:id`, `POST /households/:id/invitations` (code à fournir lors de l'inscription) |
| Familles | `GET/POST /families`, `PATCH /families/:id`, `POST/DELETE /families/:id/households`, `POST /families/:id/admins` |
| Occasions | `GET /occasions?recipientId=…`, `POST /families/:id/occasions`, `PATCH/DELETE /occasions/:id` |
| Souhaits | `GET/POST /wishes`, `POST /wishes/preview`, `GET/PATCH/DELETE /wishes/:id`, `PATCH /wishes/order` |
| Réservations | `GET/POST /reservations`, `GET/PATCH/DELETE /reservations/:id` |
| Contributions | `GET/POST /reservations/:id/requests`, `PATCH /reservations/:id/requests/:requestId` |
| Vue d'ensemble | `GET /dashboard`, `GET /history`, `GET /search?q=…` |

Les occasions des réservations sont un tableau `occasionIds: [{ "id": "uuid", "year": 2026 }]`, autorisant plusieurs occurrences. Une réservation n'est active que si elle n'est pas annulée : un index unique partiel PostgreSQL et le verrouillage de la ligne du souhait empêchent les doubles réservations concurrentes. Le bénéficiaire ne reçoit aucune information de réservation sur ses souhaits et les endpoints de réservation lui répondent 404. L'historique offert est un snapshot JSON indépendant, lisible uniquement par bénéficiaire ou participant.

Les occasions « anniversaire » prennent la date de naissance ; les occasions « fête » prennent `nameDay` au format `MM-DD` renseigné dans le profil (`PATCH /profile`), et n'ont pas de prochaine occurrence tant que cette date n'est pas définie. Les occasions fixes utilisent `month` et `day`.

La récupération de métadonnées HTML bloque les adresses privées et les redirections, épingle l'adresse DNS vérifiée et impose une limite de taille et de temps. L'utilisateur peut corriger les métadonnées avant création. Un souhait existant ne permet de modifier que ses tags ; la suppression est logique.
