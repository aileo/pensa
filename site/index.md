---
layout: home
description: Organisez les cadeaux de la famille sans tout porter dans votre tête.
hero:
  name: Pensa
  text: Les cadeaux s'organisent, la tête se libère.
  tagline: Les envies de chacun, les dates qui arrivent et qui offre quoi tiennent au même endroit — et personne ne voit jamais ce qui lui est destiné.
  actions:
    - theme: brand
      text: Guide utilisateur
      link: /docs/guide-utilisateur
    - theme: alt
      text: Déployer une instance
      link: /docs/deployment
    - theme: alt
      text: English version
      link: /en
features:
  - title: Chacun écrit sa propre liste
    details: Collez un lien, le nom, l'image et le prix se remplissent tout seuls. Une idée notée en mars est encore là en décembre.
  - title: Les occasions reviennent d'elles-mêmes
    details: Anniversaires, fêtes et dates fixes se présentent dans l'ordre, année après année, sans rien à ressaisir.
  - title: Réserver sans se croiser
    details: Réserver une envie prévient les autres qu'elle est prise, et n'apprend rigoureusement rien à la personne concernée.
  - title: Suivre jusqu'au bout
    details: Réservé, acheté, emballé, offert — chaque étape se coche, et ce qu'il reste à faire remonte sur votre tableau de bord.
---

*[Read this page in English](/en)*

## Organiser les cadeaux est un travail invisible

Ce n'est pas l'achat qui coûte, c'est de se souvenir, et cela retombe toujours
sur la même personne.

- **Les idées arrivent au mauvais moment.** Quelqu'un mentionne ce qui lui
  ferait plaisir en mars, et en décembre plus personne ne s'en souvient.
- **Les dates reviennent trop tard.** Un anniversaire se rappelle à vous trois
  jours avant, jamais trois semaines avant.
- **Le même cadeau est offert deux fois**, parce que personne ne tient la liste
  de ce qui a déjà été donné.
- **Se coordonner oblige à agir dans le dos des gens** — des conversations de
  groupe sans la personne, des messages pour demander *est-ce que quelqu'un l'a
  déjà pris ?*

Pensa porte tout cela à votre place. Les envies restent là où elles ont été
notées, les occasions reviennent seules dans l'ordre, réserver un cadeau
prévient les autres sans rien dire au bénéficiaire, et ce qui a déjà été offert
reste consultable.

## Vous ne voyez jamais ce qui vous est destiné

C'est la règle qui tient toute l'application. Ce n'est pas un réglage : l'API ne
se contente pas de masquer ce qui est réservé pour vous, elle répond comme si
cela n'existait pas — parce que s'entendre dire que l'accès est interdit serait
déjà un indice.

C'est ce qui permet de partager Pensa avec toute la famille sans que personne
n'ait à faire attention à ce sur quoi il clique.

## Foyers, familles, et personnes qui ne peuvent pas se connecter

Un **foyer** rassemble les personnes qui vivent ensemble. Une **famille** relie
plusieurs foyers, et vous pouvez appartenir à plusieurs d'entre elles sans
qu'elles se mélangent jamais. On rejoint toujours par code d'invitation, jamais
par recherche.

Les enfants — et toute personne qui ne doit pas avoir de compte — existent comme
**membres gérés** : une vraie personne, avec une date de naissance, des
occasions et une liste d'envies tenue par un administrateur de son foyer. Un
code de rattachement transforme cela en compte à part entière, le jour où elle
est prête.

[Tout ce que fait Pensa, en détail →](/docs/features) *(en anglais)*

## Ce projet a été entièrement généré par une IA {#generated-by-ai}

Chaque ligne de code, chaque texte, chaque icône et cette page ont été produits
par un agent IA, dirigé par un humain. C'est écrit ici, sur la page de connexion
et dans l'application elle-même, parce que vous devez le savoir avant de confier
quoi que ce soit au projet.

- **Aucun humain n'a écrit ce code ligne à ligne.** Il a été relu et orienté,
  pas rédigé à la main. Jugez-le sur ce qu'il fait, et lisez-le vous-même —
  c'est bien pour cela qu'il est public.
- **C'est un projet personnel, pas un produit.** Il n'y a pas d'entreprise
  derrière, pas de support, pas de garantie. N'y mettez que des données que vous
  pourriez vous permettre de perdre.
- **Il est sous licence MIT.** Lisez-le, forkez-le, hébergez-le vous-même.

## Héberger la vôtre

Deux images sont publiées pour `linux/amd64` et `linux/arm64`. Un seul port à
exposer, aucune étape de build, rien à compiler.

```sh
curl -O https://raw.githubusercontent.com/aileo/pensa/main/compose.prod.yaml
curl -O https://raw.githubusercontent.com/aileo/pensa/main/compose.stable.yaml
curl -o .env https://raw.githubusercontent.com/aileo/pensa/main/.env.example
sed -i "s|^#POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 16)|" .env
docker compose -f compose.prod.yaml -f compose.stable.yaml up -d
```

[Configuration, premier compte, reverse proxy, mises à jour et sauvegarde →](/docs/deployment)
*(en anglais)*

Les signalements, correctifs, fonctionnalités et traductions sont les bienvenus
— dire où l'application est déroutante l'est tout autant.
[Comment contribuer →](/docs/CONTRIBUTING) *(en anglais)*

::: tip La documentation technique est en anglais
Le guide utilisateur existe en français et en anglais. Tout le reste —
déploiement, développement, référence de l'API — n'est rédigé qu'en anglais.
:::
