# Giftit · application web

Interface React, TypeScript, Vite et Tailwind CSS en français.

```sh
cd apps/web
npm install
npm run dev
```

Le serveur Vite relaie les appels `/api` vers `http://localhost:3000` par défaut. Configurez `VITE_API_PROXY_TARGET` si votre API écoute ailleurs. En production, le serveur web doit acheminer `/api` vers le backend. L’authentification utilise les cookies du navigateur (`credentials: include`).

```sh
npm run build
npm run lint
```

Les écrans s’appuient sur les réponses JSON directes de l’API. Les occasions sélectionnées pour une réservation sont envoyées sous forme `{ id, year }` ; le formulaire propose l’occurrence `nextDate` et celle de l’année suivante. Une occasion sans date calculée ne peut pas être sélectionnée. Les demandes de participation d’une réservation organisée sont récupérées séparément.

La vue d’une famille affiche uniquement son tableau `members` renvoyé par `GET /families` ; elle ne mélange pas les personnes d’autres familles.
Les familles administrées affichent aussi `households` et permettent de renommer la famille ou de rattacher un foyer par identifiant. Un administrateur de foyer peut générer un code d’invitation depuis son `householdId` fourni par `/auth/me` ; ce code n’est visible qu’à la génération.
Les listes d’envies d’une personne acceptent les filtres `tag`, `availability`, `minPrice` et `maxPrice` ; les paramètres vides sont omis et la disponibilité n’est pas proposée pour sa propre liste.
