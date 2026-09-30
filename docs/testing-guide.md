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
| Week-end spa *(off-list)* | for Bob | Organised by David, visible and open to contributions, Noël 2026 |
| Cours de poterie *(off-list)* | for Alice | Organised by Charlie, private, Anniversaire 2026 |

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
- [ ] Occasions are listed **in chronological order**, each with its full date (e.g. *Noël 25 décembre 2026*, *36 ans 18 avril 2027*, *Fête 14 juillet 2027*, *Noël 25 décembre 2027*…), including those already saved on the reservation.
- [ ] Birthdays are labelled with the **age reached** (*36 ans*, EN *36 years old*) instead of *Anniversaire*: in the forms, on the reservation cards, on the dashboard (upcoming occasions and À faire) and in history.
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

### 3.5 Profile menu

Log in as **Alice**.

- [ ] The profile is reachable **only** from the avatar at the top right. The sidebar has no profile button and no language selector.
- [ ] Clicking the avatar opens a menu with *Mon profil*, the language selector and *Se déconnecter*. `Esc` or a click outside closes it.
- [ ] Switching to English from the menu translates the whole UI.
- [ ] *Mon profil* lets you change first name, last name and name day (day + month). After saving, the avatar shows the new name and the *Fête* occasion moves to the new date for the other members.
- [ ] *Se déconnecter* returns to the login screen.

### 3.6 Dashboard guidance

Log in as **Alice** and open *Tableau de bord*.

- [ ] A **getting-started checklist** shows progress (add a wish, join a family shared with another household, set your name day, reserve a gift). All steps are done for Alice; each step links to the right page.
- [ ] The checklist can be dismissed and stays hidden after reload.
- [ ] The **À faire** list shows *1 demande de participation à traiter pour « Console de jeux »* (David's request), with a *Répondre* button opening *Réservations*.
- [ ] It also shows *Acheter « Console de jeux » pour Bob Martin* with the linked occasion and date, a *C'est acheté* button and a *Voir* button.
- [ ] Items whose occasion is close (≤ 14 days to buy, ≤ 7 to wrap, ≤ 3 to give) are highlighted with a *Bientôt* badge and listed first.
- [ ] Occasions within 30 days for which you have no gift yet appear as *… : aucun cadeau prévu* items with a *Voir ses envies* button (depends on today's date).
- [ ] When nothing is due, the list shows *Rien d'urgent pour le moment…*.

Register a new account: the checklist starts at 0 and the À faire list is empty.

### 3.7 Ma famille

Log in as **Alice** and open *Ma famille*. The page has three sections, in this order:

1. **Mon foyer**: the household name (renamable), its members with an *Admin du foyer* badge, the *Nommer admin* / *Retirer l'admin* buttons and the household invitation code.
2. **Mes familles**: each family with its households and members; badges show *Admin du foyer* and *Admin de la famille*. *Gérer* opens the family (occasions, invitation code, rename, households).
3. **Les autres foyers**: households of the other families (Charlie, David), with their members.

Checks:

- [ ] The last household admin cannot be demoted (button disabled, API refuses).
- [ ] As **Alice**, click *Retirer l'admin* on **Bob**. Log in as **Bob**: *Mon foyer* has no admin buttons, *Créer une famille* and *Rejoindre une famille* are replaced by the note *Seul un admin du foyer peut rejoindre ou créer une famille.*
- [ ] Log back in as **Alice** and click *Nommer admin* on Bob to restore the sample data.
- [ ] As **Éloïse**, *Les autres foyers* is empty (her family has no other household).

### 3.8 Reservation progress

Log in as **Charlie**.

- [ ] On the dashboard, *Emballer « Roman illustré » pour Bob Martin* is listed. *Voir* opens *Réservations*, scrolls to the card and highlights it.
- [ ] Each reservation card shows the steps *Réservé → Acheté → Emballé → Offert*, with completed steps ticked and the current one highlighted.
- [ ] The organiser sees one main button (*Marquer comme emballé*) and a *Revenir à Réservé* button. Clicking them moves the step immediately, without opening *Gérer*.
- [ ] *Marquer comme offert* asks for confirmation; once confirmed, the gift is marked *Offert*, can no longer be edited and appears in *Historique* (irreversible).
- [ ] *Gérer* no longer has a status field; it keeps occasions, participants, contributions and cancellation.
- [ ] On *Console de jeux* (organised by Alice), Charlie sees the steps read-only and the note *Seul l'organisateur peut faire avancer ce cadeau.* No buy/wrap/give item appears for it in Charlie's À faire list.
- [ ] From the dashboard, *C'est emballé* moves *Roman illustré* to *Emballé*; the item becomes *Offrir « Roman illustré » à Bob Martin*.
- [ ] Log in as **Bob**: no buy/wrap/give item about his own wishes.

To restore the sample data, use *Revenir à …* or reseed.

### 3.9 Off-list gifts

An off-list gift is planned for an occasion but does not come from the recipient's wish list. The recipient never sees it before it is given. With *Visible et ouvert aux participations*, the recipient's relatives can see it and ask to contribute; otherwise only the organiser and invited participants see it.

Sample data: *Week-end spa* (for Bob, organised by David, visible, Noël 2026) and *Cours de poterie* (for Alice, organised by Charlie, private).

Log in as **Charlie**.

- [ ] The dashboard shows a *Cadeaux ouverts aux participations* section with *Week-end spa* for Bob Martin, organised by David, and a *Participer* button.
- [ ] *Réservations* shows *Cours de poterie* with the *Hors liste* and *Privé* badges, its price and description, and the usual steps.
- [ ] On Bob's page (*Ma famille* → Bob), *Cadeaux prévus hors liste* lists *Week-end spa*. *Prévoir un cadeau hors liste* opens the form with Bob preselected.
- [ ] From *Réservations*, *Prévoir un cadeau hors liste* opens the form with a *Pour qui ?* selector. Occasions load once a person is chosen, and the first one is preselected. Only the title is required.
- [ ] Create a visible gift for Bob: it appears in *Réservations* with *Visible par la famille*, and in the À faire list (*Acheter …*).
- [ ] Click *Participer* on *Week-end spa*: the card shows *Demande envoyée, en attente de réponse.*
- [ ] Log in as **David**, open *Réservations* and accept Charlie's request. Log back in as **Charlie**: *Week-end spa* is now in his reservations as participant, and no longer in the dashboard section.
- [ ] As organiser, *Gérer* on an off-list gift allows editing the title, description, price, link and image, as well as toggling visibility. Cancelling the reservation removes the gift entirely.
- [ ] Log in as **Alice**: she sees *Week-end spa* (she shares family B with Bob and David) but not *Cours de poterie*, which is private and planned for her. Her page shows no off-list section for herself.
- [ ] Log in as **Bob**: no trace of off-list gifts anywhere (dashboard, his wishes, reservations, search for *spa*).
- [ ] Once an off-list gift is marked *Offert*, the recipient sees it in *Historique*.

### 3.10 Product copy

The wording is built around one promise: **organizing gifts without the mental load**. Warmth
stays, but every screen names the task it moves forward rather than the emotion.

- [ ] **Sign-in page:** *Fini la charge mentale des cadeaux* / *Organisez les cadeaux, l'esprit tranquille* (EN *No more gift-planning overload* / *Gifts organized, mind at ease*), followed by the scrollable pitch described in §3.13.
- [ ] **Browser tab:** *Giftit — Organisez les cadeaux, l'esprit tranquille*, and it switches with the language.
- [ ] **Sidebar card:** *Rien à retenir / Giftit suit les dates, les listes et les cadeaux à votre place*.
- [ ] **Dashboard hero:** *VOTRE ORGANISATION DU JOUR*, followed by what is coming up and what is left to do.
- [ ] **Historique:** framed as *DÉJÀ OFFERT*; when empty it explains that it prevents giving the same gift twice.
- [ ] Switch to English and check the same screens: the English is rewritten, not translated word for word.

### 3.11 Regression checks

- [ ] **Surprise kept:** log in as **Bob**; his *Console de jeux* and *Roman illustré* do not show who reserved them.
- [ ] **Access:** log in as **Éloïse**; she cannot see Alice's, Bob's, Charlie's or David's lists.
- [ ] **Participation request:** log in as **Alice**, open *Réservations*; on *Console de jeux*, accept or refuse David's pending request.
- [ ] **Status flow:** as the organiser, move a reservation *Réservé → Acheté → Emballé → Offert* with the step buttons; once gifted it can no longer be edited and appears in *Historique*.
- [ ] **History:** log in as **Alice**; *Historique* shows *Appareil photo* (Noël 2025).
- [ ] **Custom occasion:** as a family admin, add an occasion in *Ma famille*; it appears in the reservation form for that family's members.

### 3.12 Link previews when adding a wish

Paste a product URL in *Mes envies → Ajouter une envie*. There is no button: the preview starts on its own shortly after a valid link is typed or pasted, and *Lecture du lien…* appears under the field while it runs.

- [ ] **Automatic preview:** paste a product page (for example a Prusa, Kubii, Domadoo, Fnac or Cdiscount page) without clicking anything — the name, description, image and, when the site publishes it, the price fill themselves in.
- [ ] **Typing an address:** type a URL character by character; the lookup only runs once you stop typing, not at every keystroke.
- [ ] **Changing your mind:** paste a first link, then immediately replace it with another — the form shows the second product, never the first.
- [ ] **Second paste is instant:** clear the field and paste the same link again — the preview appears immediately (it is cached for a day).
- [ ] **Redirected link:** a URL that redirects (a shortened link, or a domain without `www.`) still resolves to the final page.
- [ ] **Heavy page:** a very large product page still returns its metadata instead of failing.
- [ ] **Protected site:** Amazon rejects anything that is not a real browser (it answers *page not found* even for a valid product). The form shows an amber message **and still fills the name from the link itself** (for example `…/Lego-Architecture-Tour-Eiffel/dp/…` becomes *Lego architecture tour eiffel*). The form is never blocked.
- [ ] **Manual fallback:** with the preview refused, adjust the name and save: the wish is created without an image (the image field is marked *facultatif*).
- [ ] **Unknown domain:** a link to a domain that does not exist is refused with *Site introuvable* and fills nothing.
- [ ] **Rejected addresses:** a URL pointing to a local address (`http://localhost:3000`) is refused with *Adresse non autorisée*.
- [ ] **No lockout:** after several failed previews you can still sign out and sign back in — previews have their own rate limit.

### 3.13 Landing page

Log out to reach the sign-in page. It doubles as the landing page: it scrolls so a visitor can
understand what Giftit is for before creating an account.

- [ ] **It scrolls:** below the hero, four sections follow — *Organiser des cadeaux, c'est un travail invisible*, *Quatre gestes, et vous n'avez plus rien à retenir*, *Une seule place pour tout ce qui concerne les cadeaux* and *Vous ne verrez jamais ce qui vous est destiné* — then a closing *Prêt à vous libérer la tête ?*
- [ ] **On a wide screen:** the sign-in form stays pinned on the right while you read; it never scrolls out of sight. A hint under the hero invites you to scroll.
- [ ] **On a narrow screen** (resize below 1024 px): the order is hero, then the form, then the sections — signing in never requires scrolling past the whole pitch.
- [ ] **Long form stays reachable:** switch to *S'inscrire* on a short window; the taller form scrolls inside its own column, with the top of the form still reachable.
- [ ] **Closing call to action:** *Commencer maintenant* jumps back to the form.
- [ ] **Content is accurate:** the sections describe what the app really does — pasted links filling themselves in, occasions arriving in order, reservations hidden from their recipient, off-list gifts, contributions, households, history.
- [ ] **In English:** switch the language from the hero; every section is rewritten English, not a word-for-word translation.
- [ ] **Headings:** a single *Organisez les cadeaux, l'esprit tranquille* as the page title, one heading per section.

## 4. Automated checks

```sh
docker compose run --rm api npm test     # requires the seeded database
docker compose run --rm api npm run lint
docker compose run --rm api npm run build
docker compose run --rm web npm run lint
docker compose run --rm web npm run build
```

Integration tests add data to the database. Reset with `docker compose down -v` and reseed before manual testing. Run them **without** a port override file: the tests send requests with the `http://localhost:5173` origin.
