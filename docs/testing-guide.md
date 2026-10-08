# Manual testing guide

This guide explains how to run Pensa locally with sample data, which accounts to use, and what to check.

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

All accounts use the password **`PensaDemo2026!`**.

| Account | Household | Families | Birthday | Name day |
|---|---|---|---|---|
| `alice@example.test` | Alice & Bob | A, B | 15 Oct | 16 Dec |
| `bob@example.test` | Alice & Bob | A, B | 18 Apr | 14 Jul |
| `charlie@example.test` | Charlie | A | 8 Jun | 2 Mar |
| `david@example.test` | David | B | 20 Mar | 29 Dec |
| `eloise@example.test` | Éloïse | C | 30 Nov | 11 Mar |
| *no account* (Lucie, managed by Alice & Bob) | Alice & Bob | A, B | 4 May | 13 Dec |

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
| Trottinette | Lucie *(managed)* | — |
| Coffret de peinture | Lucie *(managed)* | — |
| Week-end spa *(off-list)* | for Bob | Organised by David, visible and open to contributions, Noël 2026 |
| Cours de poterie *(off-list)* | for Alice | Organised by Charlie, private, Anniversaire 2026 |

## 3. What to test

Tick each check as you go. "Log in as X" means log out first, then log in with that account.

### 3.1 Dashboard – upcoming occasions

Log in as **Alice** and open *Tableau de bord*.

- [ ] *Les prochaines occasions* shows **no occasion for Alice herself**.
- [ ] No row appears twice (same person, same occasion, same date). Bob's *Noël* appears once, although Bob is in families A and B.
- [ ] Occasions are sorted by date, nearest first.
- [ ] Clicking an occasion opens the wish list of the person it concerns — *Noël · Bob Martin* lands on *Les envies de Bob Martin*.

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
- [ ] **Browser tab:** *Pensa — Organisez les cadeaux, l'esprit tranquille*, and it switches with the language.
- [ ] **Sidebar card:** *Rien à retenir / Pensa suit les dates, les listes et les cadeaux à votre place*.
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
understand what Pensa is for before creating an account.

- [ ] **It scrolls:** below the hero, four sections follow — *Organiser des cadeaux, c'est un travail invisible*, *Quatre gestes, et vous n'avez plus rien à retenir*, *Une seule place pour tout ce qui concerne les cadeaux* and *Vous ne verrez jamais ce qui vous est destiné* — then a closing *Prêt à vous libérer la tête ?*
- [ ] **On a wide screen:** the sign-in form stays pinned on the right while you read; it never scrolls out of sight. A hint under the hero invites you to scroll.
- [ ] **On a narrow screen** (resize below 1024 px): the order is hero, then the form, then the sections — signing in never requires scrolling past the whole pitch.
- [ ] **Long form stays reachable:** switch to *S'inscrire* on a short window; the taller form scrolls inside its own column, with the top of the form still reachable.
- [ ] **Closing call to action:** *Commencer maintenant* jumps back to the form.
- [ ] **Content is accurate:** the sections describe what the app really does — pasted links filling themselves in, occasions arriving in order, reservations hidden from their recipient, off-list gifts, contributions, households, history.
- [ ] **In English:** switch the language from the hero; every section is rewritten English, not a word-for-word translation.
- [ ] **Headings:** a single *Organisez les cadeaux, l'esprit tranquille* as the page title, one heading per section.

### 3.14 Theme, icons and contrast

The interface uses a warm palette — rosewood, terracotta, sage — declared once in the
`@theme` block of `apps/web/src/index.css`. No purple remains anywhere.

- [ ] **No purple is left:** browse every screen. Buttons, links, chips, avatars, the active
      navigation item and the landing hero are all rosewood. If you spot a lilac or violet,
      it is a leftover.
- [ ] **The warmth is consistent:** the app background is a very light sand, not a cold
      off-white. Cards stay white so they lift off the background.
- [ ] **Terracotta means "act soon":** in the *À faire* list, urgent items get a terracotta
      row, icon and *Bientôt* badge. Off-list gift sections also use terracotta.
- [ ] **Sage means "done":** in the reservation tracker, cleared steps and their connector
      turn sage green. The history screen header is sage too.
- [ ] **A screen icon per header:** each section title carries a tinted pill on its left,
      matching its menu entry — heart for *Mes envies*, people for *Ma famille*, gift for
      *Réservations*, clock for *Historique*, magnifier for *Rechercher*, person for
      *Mon profil*. It is hidden on very narrow screens.
- [ ] **Reservation actions are told apart:** in *À faire* and on a reservation, buying shows
      a cart, wrapping a box, and giving a party popper. They no longer share one gift icon.
- [ ] **No typographic arrows:** *Voir la famille*, *Retour aux familles* and the wish
      reorder buttons use drawn arrow icons, aligned with the text, not `→` or `↑` characters.

Accessibility checks, which matter more here because a soft palette loses legibility easily:

- [ ] **Focus is always visible:** tab through a form. Every field, button and link gets a
      rosewood ring with a white halo, readable on white and on tinted pills alike.
      A field must never highlight only by changing its border colour.
- [ ] **Colour is never the only clue** (WCAG 1.4.1): view the reservation tracker in
      greyscale, or squint. Each step still reads through its number, its check mark and its
      label. The urgent rows still say *Bientôt*.
- [ ] **Contrast holds:** body text, buttons and links reach 4.5:1; input borders, the focus
      ring and progress markers reach 3:1. Measured values are listed in
      [the design system](design-system.md). If you change a hue, re-measure before keeping it.

### 3.15 Registration and reverse proxy

The development stack sets `OPEN_REGISTRATION=true`, so section 3 above behaves as
before. This section checks the deployed behaviour, which is different on purpose.

Run the published stack on an empty database:

```bash
docker compose -f compose.prod.yaml up -d
```

- [ ] **The first account gets in:** open the app, register without a code. It succeeds and
      you are an administrator of your own household.
- [ ] **The door then closes:** register a second account without a code. It is refused with
      *Inscription sur invitation uniquement*. Reload the sign-up form: the invitation field
      now reads *(requis)* and the browser will not submit it empty.
- [ ] **A household code still works:** from *Ma famille → Mon foyer*, copy the household
      code and register with it. The new person lands in your household, without admin
      rights.
- [ ] **A family code works too:** create a family, copy its invitation code and register a
      third account with it. That person gets a household of their own, named *Foyer de
      <prénom>*, already listed in the family, and is an admin of it.
- [ ] **Reopening:** set `OPEN_REGISTRATION=true`, restart the API, reload the form. The
      field reads *(facultatif)* again and registering without a code works.

Behind your own reverse proxy, on a real domain over HTTPS:

- [ ] **Sign-up works** without setting `WEB_ORIGIN` to anything. This is the bug that made
      every form submission fail with *Origine interdite*.
- [ ] **A refusal is diagnosable:** `docker compose logs api` prints the origin received and
      the one expected, on one line.

### 3.16 Managed members (children of the household)

Log in as `alice@example.test` (admin of the *Alice & Bob* household).

- [ ] **She is there, without an account:** *Ma famille → Mon foyer* lists Lucie with a
      *Géré par le foyer* badge, and no *Nommer admin* button next to her.
- [ ] **Her list is editable:** open Lucie's page. A banner says you keep her list for her,
      and her two wishes can be re-tagged and deleted. *Ajouter une envie* adds to her list,
      not yours — check *Mes envies* is unchanged afterwards.
- [ ] **Same ordering controls as my wishes:** her list uses the same draggable rows and
      up/down arrows as *Mes envies*. Reorder her two wishes, leave the page and come back:
      the order persists. Set a *Tag* filter that only matches one wish — the controls
      disappear and a note asks you to clear the filters before reordering again.
- [ ] **The household is reminded:** delete both of her wishes. The dashboard *À faire* list
      shows *La liste de Lucie est vide…*; adding a wish back makes it disappear.
- [ ] **Others see an ordinary list:** log in as `charlie@example.test`, open Lucie's page.
      No banner, no edit buttons — her wishes can be reserved like anyone else's.
- [ ] **She cannot sign in:** there is no email to try. Creating a new member through
      *Ajouter un membre sans compte* asks for a name, a date of birth and, optionally,
      a *date de fête*.
- [ ] **Name day on creation:** add a member with a day and a month. A *Fête* occasion
      appears for them on the dashboard on that date. Choosing only a day, or only a
      month, is refused with *Choisissez le jour et le mois de sa fête.*
- [ ] **Editing the record:** *Modifier la fiche* next to Lucie prefills her first name,
      last name, date of birth and her name day (13 December). Change the name day, save,
      and reopen the form: the new value is there, and her *Fête* occasion moved with it.
      Emptying both fields removes the occasion.
- [ ] **Reaching her list quickly:** the dashboard has a *Les listes que je tiens* section
      with Lucie in it, and *Mes envies* shows a row of shortcuts — *Mes envies* plus one
      per managed member. Clicking Lucie opens her list; the row is still there, so one
      click comes back to yours. Log in as `charlie@example.test`: neither the section nor
      the row appears.
- [ ] **Claim code:** as Alice, generate one for your new member, log out, click *J'ai un
      code de rattachement* on the sign-in screen and use it with an email and a password of
      at least 12 characters. You land in the app, in the same household, with the wishes the
      household wrote for you, and the badge is gone.
- [ ] **A claim code is not a registration code:** try the same code on the normal sign-up
      form. It is refused.
- [ ] **Credentials set directly:** as Alice, use *Définir ses identifiants* on another
      managed member, then log in as that person with what you typed.
- [ ] **Removal is protected:** reserve a gift for a managed member from another account,
      then try to remove them. It is refused because gifts are in progress. Removing someone
      with no gift history works and takes their wishes with them.
- [ ] **Moving out:** on a member who now has an account, use *Lui donner son foyer*. They
      get a household named *Foyer de <prénom>*, they administer it, and it appears in the
      same families as before. The action is not offered for managed members.
- [ ] **Leaving on your own:** as that person, *Quitter ce foyer* does the same thing. A
      household is never left without a member or without an administrator — the button is
      disabled when it would be.

### 3.17 URL-based navigation (clean paths, direct links, back/forward)

Every screen now has its own address (`/dashboard`, `/wishes`, `/families`, `/reservations`,
`/history`, `/search`, `/profile`, plus `/families/:id`, `/users/:id/wishes`, `/wishes/:id` and
`/reservations/:id`). The tab bar still works the same, but the address bar is the source of
truth, not just a mirror of it.

- [ ] **Direct load of each main view:** signed in, paste each of `/dashboard`, `/wishes`,
      `/families`, `/reservations`, `/history`, `/search` and `/profile` into the address bar
      and reload. Each one opens the right screen straight away, not the dashboard.
- [ ] **Direct load of a sub-resource:** with a family's id from *Ma famille*, load
      `/families/:id` directly — the family page opens, not the family list. Same for a
      relative's id on `/users/:id/wishes`, a wish's id on `/wishes/:id`, and one of your own
      reservations' id on `/reservations/:id`.
- [ ] **Your own id redirects:** open `/users/<your id>/wishes` directly — you land on *Mes
      envies*, never on a mislabeled "their list" view.
- [ ] **Delayed data:** throttle the network (or simply reload right as the page loads) and
      watch a sub-resource URL: nothing flashes a wrong or empty state while the bulk lists are
      still loading; it either waits or ends on a correct not-found state once loading is done.
- [ ] **Switching between people:** from *Ma famille*, open one relative's list, then another's
      via the back button or a second click — the wishes and off-list gifts shown always match
      the person currently in the address bar, never a flash of the previous person's data.
- [ ] **Auth and sign-out:** while signed out, paste a direct URL such as `/wishes/:id`; after
      signing in you land on that exact page, not the dashboard. Sign out from any page; you
      are returned to the sign-in screen without errors.
- [ ] **Bad or foreign ids:** edit a sub-resource URL to a made-up id, or to an id that belongs
      to someone outside your families — each (`/families/:id`, `/users/:id/wishes`,
      `/wishes/:id`, `/reservations/:id`) shows a plain *not found* message, never an error
      page, a blank screen, or any detail about why it failed.
- [ ] **A reservation's beneficiary never sees it this way either:** as the person a
      reservation is *for*, open `/reservations/:id` with that reservation's own id directly —
      it is *not found*, exactly as it would be from inside the app.
- [ ] **Search stays shareable:** type a search term, copy the address bar's `?q=…` value,
      open it in a fresh tab — the same search re-runs. Clearing the field removes `q` from the
      address instead of leaving a stale value behind.
- [ ] **Back and forward:** click through *Tableau de bord → Ma famille → a relative's list →
      Réservations*, then use the browser's back and forward buttons — each step lands exactly
      back where you were, including the relative's list.
- [ ] **Permalink on a wish:** open any wish's permalink icon from a list; it opens
      `/wishes/:id` with the same reserve/edit/delete actions as the list view — no more, no
      less — and copying that URL to a fresh tab shows the same thing.
- [ ] **Production build serves deep links too:** after `docker compose build web` and running
      the production image, load a sub-resource URL directly (not via a click from `/`) — nginx's
      SPA fallback serves the app instead of a 404.

## 4. The name, the AI disclosure and the published images
### 4.1 The old name is gone

- [ ] Search the repository for the old name, case-insensitively. The only hits allowed are
      these two lines of this guide.
- [ ] The browser tab reads **Pensa — Organisez les cadeaux, l'esprit tranquille**, and the
      sidebar logotype reads `pensa.`.
- [ ] The Postgres credentials changed with the rename. An existing development database
      still carries the old ones, so `docker compose down -v` then reseed, otherwise the API
      cannot connect.
- [ ] The language preference is stored under a renamed key, so the first visit after the
      rename falls back to French and the onboarding panel shows again. That is expected once.

### 4.2 The AI disclosure is honest and visible

The claim is made in three places, and all three must be present in both languages:

- [ ] **Logged out**, on the landing page: a dedicated section states that the application was
      entirely generated by an AI, and warns that it is a personal project without guarantees.
      It sits above the final call to action, so it is read before creating an account.
- [ ] **The landing footer** repeats it in one line, with the MIT licence.
- [ ] **Logged in**, at the bottom of the sidebar: the same one-line mention stays visible on
      every screen.
- [ ] Switch to English and check all three again. A missing translation would have failed the
      build, but check the wording reads naturally, not literally translated.
- [ ] The README carries the same statement in its own section, near the top.

### 4.3 The published images

The development stack (`compose.yaml`) mounts the sources and runs `tsx`. The published images
do not: the API is compiled to `dist/` and the interface is static files behind nginx. Test the
real thing, not the development stack:

```sh
docker build -t pensa-api:local apps/api
docker build -t pensa-web:local apps/web
API_IMAGE=pensa-api:local WEB_IMAGE=pensa-web:local \
  docker compose -p pensaprod -f compose.prod.yaml up -d
docker compose -p pensaprod -f compose.prod.yaml exec api node dist/seed.js
```

- [ ] `docker compose -p pensaprod -f compose.prod.yaml ps` reports the API **healthy**. It
      only becomes healthy after it has migrated its own schema and can query the database.
- [ ] http://localhost:8080/api/health answers `{"status":"ok"}`. Through nginx, not directly:
      this proves the `/api` proxy works, which the interface depends on because it calls
      `/api` relatively.
- [ ] Open http://localhost:8080/ and log in. The browser origin is now port 8080, so this also
      proves `WEB_ORIGIN` is correct; a mismatch fails every write with *Origine interdite*.
- [ ] Reload directly on a deep route such as http://localhost:8080/dashboard. It must return
      the application, not an nginx 404 — that is the single-page fallback.
- [ ] Stop with `docker compose -p pensaprod -f compose.prod.yaml down -v`.

### 4.3.1 First account created from the environment

Bootstrap only runs on an empty database, so this needs a fresh stack. Add to your `.env`, or
pass inline:

```sh
BOOTSTRAP_EMAIL=camille@example.org BOOTSTRAP_PASSWORD=mot-de-passe-solide \
BOOTSTRAP_FIRST_NAME=Camille BOOTSTRAP_LAST_NAME=Durand BOOTSTRAP_BIRTH_DATE=1985-07-24 \
BOOTSTRAP_FAMILY="Famille Durand" API_IMAGE=pensa-api:local WEB_IMAGE=pensa-web:local \
  docker compose -p pensaboot -f compose.prod.yaml up -d
```

- [ ] `docker compose -p pensaboot -f compose.prod.yaml logs api` reports *Premier compte créé*.
- [ ] Log in at http://localhost:8080/ with that address and password. No sign-up needed.
- [ ] **My family** shows *Famille Durand* with its three default occasions — the same ones a
      family created from the interface gets.
- [ ] `docker compose -p pensaboot -f compose.prod.yaml restart api`, then read the logs again:
      *Bootstrap ignoré*. Restarting must never recreate or reset that account.
- [ ] Shorten `BOOTSTRAP_PASSWORD` to under 12 characters on an empty database: the API
      container stops and the log names the variable. It must not start without the account.
- [ ] Stop with `docker compose -p pensaboot -f compose.prod.yaml down -v`.

### 4.3.2 Following releases rather than `latest`

```sh
docker compose -f compose.prod.yaml -f compose.stable.yaml config | grep image
```

- [ ] Both images read the version of the latest release — the same number as the newest
      heading in the changelog, never a moving tag. The overlay only replaces the two image
      names; everything else — ports, variables, volumes — must still come from
      `compose.prod.yaml`.
- [ ] `docker compose -f compose.prod.yaml -f compose.stable.yaml pull` succeeds, which means
      the release workflow published that exact version for your architecture.
- [ ] After a release, the two lines name the new version. This file is updated by hand at
      release time, so a forgotten bump leaves deployments one version behind.

### 4.4 After the first publication to GHCR

- [ ] **Packages published to GHCR are private by default.** Nothing in the workflow can detect
      this and the run still reports success, yet nobody can pull the images. After the first
      release, open each package's settings and switch it to public.
- [ ] Verify from a machine that is not logged in: `docker pull ghcr.io/aileo/pensa-api:latest`.
- [ ] The image name follows the repository name. If the repository is not renamed to `pensa`,
      the images are published under the old name instead.

## 5. The documentation site

```sh
docker compose up site -d
```

- [ ] http://localhost:5175 shows the home page **in French**, in the app's
      colours — rosewood buttons, warm background, not VitePress's default blue.
- [ ] *English version* opens the same page in English at `/en`, and *Lire cette
      page en français* comes back.
- [ ] The first hero button reaches the French user guide, the nav reaches the
      English one, and each guide's first line links to the other.
- [ ] In each guide, the link to the AI disclosure lands on the home page in the
      guide's own language, scrolled to that heading.
- [ ] The sidebar lists every document in `docs/`, and each entry opens.
- [ ] *Working on the repository* and *Changelog* open `AGENT.md` and
      `CHANGELOG.md` — they live outside `docs/` and are copied in.
- [ ] A link that crosses documents works: from the changelog, *house rules*
      reaches the same page as the sidebar entry.
- [ ] Search (the field at the top) finds a phrase from the user guide.
- [ ] Editing a file in `docs/` while the server runs updates the page without
      restarting it.
- [ ] `docker compose run --rm site npm run build` succeeds. It fails on any
      dead internal link, which is the only automated check the documentation
      has — a link renamed in `docs/` but not in `site/.vitepress/config.ts`
      is caught here and nowhere else.
- [ ] Nothing under `site/docs/`, `site/agent.md` or `site/changelog.md` is
      committed: they are copies, regenerated on every build.

After a push to `main`, the *Pages* workflow publishes
https://aileo.github.io/pensa/. It fails until GitHub Pages is set to deploy
from *GitHub Actions* in the repository settings — a one-off manual step.

## 6. Automated checks

```sh
docker compose run --rm api npm test     # requires the seeded database
docker compose run --rm api npm run lint
docker compose run --rm api npm run build
docker compose run --rm web npm run lint
docker compose run --rm web npm run build
docker compose run --rm site npm run build
```

Integration tests add data to the database. Reset with `docker compose down -v` and reseed before manual testing. Run them **without** a port override file: the tests send requests with the `http://localhost:5173` origin.

The same checks run in CI on every push and pull request (`.github/workflows/ci.yml`), against a
Postgres service that is migrated and seeded first. CI also builds both images without pushing,
so a broken Dockerfile is caught before a release. The documentation site is built by its own
workflow (`.github/workflows/pages.yml`), on pull requests too, so a dead link never reaches
`main`.
