# Manual testing guide

This guide explains how to run Giftit locally with sample data, which accounts to use, and what to check.

## 1. Start the app with fresh sample data

The seed is skipped if the sample accounts already exist, so start from an empty database:

```sh
docker compose down -v
docker compose up --build -d
docker compose run --rm api npm run seed
```

Open http://localhost:5173 (API: http://localhost:3000/api).

> Ports 3000 or 5173 already in use (for example by another worktree)? Create a Compose override file **outside the repository** and pass it with `-f`:
>
> ```yaml
> # compose.override.yaml
> services:
>   api:
>     environment:
>       WEB_ORIGIN: http://localhost:5174
>     ports: !override
>       - "3001:3000"
>   web:
>     ports: !override
>       - "5174:5173"
> ```
>
> ```sh
> docker compose -f compose.yaml -f path/to/compose.override.yaml up --build -d
> docker compose -f compose.yaml -f path/to/compose.override.yaml run --rm api npm run seed
> ```
>
> Then open http://localhost:5174.

Stop with `docker compose down` (keeps data) or `docker compose down -v` (deletes data).

## 2. Sample data

All accounts use the password **`GiftitDemo2026!`**.

| Account | Household | Families | Birthday | Name day |
|---|---|---|---|---|
| `alice@example.test` | Alice & Bob | A, B | 15 Oct | 16 Dec |
| `bob@example.test` | Alice & Bob | A, B | 18 Apr | 14 Jul |
| `charlie@example.test` | Charlie | A | 8 Jun | 2 Mar |
| `david@example.test` | David | B | 20 Mar | 29 Dec |
| `eloise@example.test` | Éloïse | C | 30 Nov | 11 Mar |

Each family has three occasions: *Anniversaire* (birthday), *Fête* (name day) and *Noël* (25 Dec). Alice and Bob belong to two families, so their occasions are stored twice in the database. The app must show them only once.

Wishes and reservations:

| Wish | Owner | Reservation |
|---|---|---|
| Console de jeux | Bob | Reserved by Alice, Charlie participates, David's request pending, open to contributions |
| Roman illustré | Bob | Purchased by Charlie |
| Appareil photo | Alice | Gifted by Bob with David (appears in history) |
| Lampe de bureau | Charlie | — |
| Jeu de société | David | — |
| Vélo | Éloïse | — |

## 3. What to test

Tick each check as you go. "Log in as X" means log out first, then log in with that account.

### 3.1 Dashboard – upcoming occasions

Log in as **Alice** and open *Tableau de bord*.

- [ ] *Les prochaines occasions* shows **no occasion for Alice herself**.
- [ ] No row appears twice (same person, same occasion, same date). Bob's *Noël* appears once, although Bob is in families A and B.
- [ ] Occasions are sorted by date, nearest first.

Repeat as **Bob**: no occasion for Bob, no duplicates.

### 3.2 Occasions in the reservation form

Log in as **Alice** and open *Réservations*, then click *Gérer* on *Console de jeux*.

- [ ] Each occasion (Anniversaire, Fête, Noël) is listed once per year, never twice.
- [ ] Occasions already saved on the reservation are checked and not duplicated.
- [ ] Saving the reservation works.

On a wish that is not reserved yet (as **Alice**, go to David's *Jeu de société* and click *Réserver*):

- [ ] The occasion list has no duplicates and one occasion is preselected.
- [ ] Confirming creates the reservation.

### 3.3 Reservations page

Log in as **Alice** and open *Réservations*.

- [ ] Each card shows the **wish title** and its image, not "Réservation #…".
- [ ] Each card shows **"Pour {recipient}"**, e.g. *Pour Bob Martin* on *Console de jeux*.
- [ ] Occasions, status, organiser and participants are still shown.

Log in as **Charlie**: *Console de jeux* (participant) and *Roman illustré* (organiser, purchased) both show the wish and *Pour Bob Martin*.

Switch the language to English: the recipient line reads *For Bob Martin*.

### 3.4 Wish descriptions

Log in as **Alice** and look at *Les envies de vos proches* on the dashboard.

- [ ] Each wish has a real description (e.g. *Console de jeux*: "Une console récente pour jouer en famille le week-end."), not "Un cadeau pour {title}".

### 3.5 Regression checks

- [ ] **Surprise kept:** log in as **Bob**; his *Console de jeux* and *Roman illustré* do not show who reserved them.
- [ ] **Access:** log in as **Éloïse**; she cannot see Alice's, Bob's, Charlie's or David's lists.
- [ ] **Participation request:** log in as **Alice**, open *Réservations*; on *Console de jeux*, accept or refuse David's pending request.
- [ ] **Status flow:** as the organiser, move a reservation *Réservé → Acheté → Emballé → Offert*; once gifted it can no longer be edited and appears in *Historique*.
- [ ] **History:** log in as **Alice**; *Historique* shows *Appareil photo* (Noël 2025).
- [ ] **Custom occasion:** as a family admin, add an occasion in *Ma famille*; it appears in the reservation form for that family's members.

## 4. Automated checks

```sh
docker compose run --rm api npm test     # requires the seeded database
docker compose run --rm api npm run lint
docker compose run --rm api npm run build
docker compose run --rm web npm run lint
docker compose run --rm web npm run build
```

Integration tests add data to the database. Reset with `docker compose down -v` and reseed before manual testing.
