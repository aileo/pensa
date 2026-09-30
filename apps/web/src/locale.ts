export type Locale = 'fr' | 'en'
const preferenceKey = 'giftit-language'
let activeLocale: Locale | undefined

function browserLocale(): Locale {
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language]
  return languages[0]?.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

export function getLocale(): Locale {
  if (activeLocale) return activeLocale
  try {
    const saved = localStorage.getItem(preferenceKey)
    if (saved === 'fr' || saved === 'en') return saved
  } catch { /* Storage may be unavailable in private browsing. */ }
  return browserLocale()
}

export function activateLocale(locale: Locale) { activeLocale = locale }
export function saveLocale(locale: Locale) {
  activeLocale = locale
  try { localStorage.setItem(preferenceKey, locale) } catch { /* Continue without persistence. */ }
}

const english = {
  'Un proche': 'A loved one',
  'Connexion impossible. Vérifiez votre réseau et réessayez.': 'Could not connect. Check your network and try again.',
  'Une erreur est survenue ({status}).': 'An error occurred ({status}).',
  'Réponse du serveur invalide. Réessayez plus tard.': 'Invalid server response. Try again later.',
  'Une erreur inattendue est survenue.': 'An unexpected error occurred.',
  'Réservé': 'Reserved', 'Acheté': 'Purchased', 'Emballé': 'Wrapped', 'Offert': 'Gifted',
  'En attente': 'Pending', 'Acceptée': 'Accepted', 'Refusée': 'Declined',
  'Anniversaire': 'Birthday', 'Fête': 'Name day', 'Noël': 'Christmas',
  'Tableau de bord': 'Dashboard', 'Mes envies': 'My wishes', 'Ma famille': 'My family',
  'Réservations': 'Reservations', 'Historique': 'History', 'Rechercher': 'Search',
  'Mon profil': 'My profile', 'Mes familles': 'My families', 'Menu principal': 'Main menu',
  'Navigation principale': 'Main navigation', 'Fermer le menu': 'Close menu', 'Ouvrir le menu': 'Open menu',
  'Giftit, accueil': 'Giftit, home', 'Masquer l’erreur': 'Dismiss error',
  'Masquer la notification': 'Dismiss notification', 'Fermer': 'Close',
  'Chargement de Giftit…': 'Loading Giftit…', 'Actualisation des données…': 'Refreshing data…',
  'La joie de faire plaisir': 'The joy of giving', 'Partagez vos envies avec ceux qui comptent.': 'Share your wishes with those who matter.',
  'LE BONHEUR SE PARTAGE': 'HAPPINESS IS SHARED', 'Bonjour {name}': 'Hello {name}',
  'vous': 'there',
  'Les plus beaux cadeaux sont ceux qu’on choisit ensemble. Retrouvez les envies de vos proches et partagez les vôtres.': 'The best gifts are the ones we choose together. Discover your loved ones’ wishes and share your own.',
  'Ajouter une envie': 'Add a wish', 'À VENIR': 'COMING UP', 'Les prochaines occasions': 'Upcoming occasions',
  'Aucune date à venir': 'No upcoming dates', 'Les occasions de vos proches apparaîtront ici.': 'Your loved ones’ occasions will appear here.',
  'EN PRÉPARATION': 'IN THE WORKS', 'Les cadeaux partagés': 'Shared gifts',
  '{count} réservation organisée': '{count} reservation organized',
  '{count} réservations organisées': '{count} reservations organized',
  '{count} cadeau auquel vous participez': '{count} gift you’re contributing to',
  '{count} cadeaux auxquels vous participez': '{count} gifts you’re contributing to',
  'Voir les réservations': 'View reservations', 'Encore rien à préparer': 'Nothing to prepare yet',
  'Réservez une envie pour organiser un cadeau.': 'Reserve a wish to organize a gift.',
  'POUR VOUS': 'FOR YOU', 'Les envies de vos proches': 'Your loved ones’ wishes',
  'Voir la famille →': 'View family →', 'À découvrir bientôt': 'More to discover soon',
  'Les envies de vos proches apparaîtront ici dès qu’ils les partageront.': 'Your loved ones’ wishes will appear here when they share them.',
  'Voir ma famille': 'View my family', 'VOTRE LISTE PERSONNELLE': 'YOUR PERSONAL LIST',
  'Vos idées cadeaux, toujours à portée de main.': 'Your gift ideas, always close at hand.',
  'Glissez les envies ou utilisez les flèches pour changer leur priorité.': 'Drag wishes or use the arrows to change their priority.',
  'Une belle idée cadeau': 'A lovely gift idea', 'Monter {title}': 'Move {title} up',
  'Descendre {title}': 'Move {title} down',
  'Modifier les tags de {title}': 'Edit tags for {title}', 'Supprimer {title}': 'Delete {title}',
  'Voir {title} sur le site marchand': 'View {title} on the store website',
  'Votre liste attend ses premières envies': 'Your list is waiting for its first wishes',
  'Collez le lien d’un produit et nous vous aiderons à l’ajouter.': 'Paste a product link and we’ll help you add it.',
  'Réservé par {name}': 'Reserved by {name}', 'Participation possible': 'Contributions welcome',
  'Voir la réservation': 'View reservation', 'Réserver': 'Reserve',
  'CEUX QUI COMPTENT': 'THOSE WHO MATTER', 'Les envies de {name}': '{name}’s wishes',
  '← Retour aux familles': '← Back to families', 'Créer une famille': 'Create a family',
  'Tag': 'Tag', 'Ex. : livres': 'E.g. books', 'Disponibilité': 'Availability',
  'Toutes': 'All', 'Disponibles': 'Available', 'Réservées': 'Reserved',
  'Prix minimum (€)': 'Minimum price (€)', 'Prix maximum (€)': 'Maximum price (€)',
  'Sans limite': 'No limit', 'Aucune envie trouvée': 'No wishes found',
  'Modifiez les filtres pour découvrir d’autres envies.': 'Change the filters to discover more wishes.',
  'VOTRE TRIBU': 'YOUR CIRCLE', 'Découvrez les envies des membres de cette famille.': 'Discover this family’s wishes.',
  'Ajouter une occasion': 'Add an occasion', 'Aucun membre affiché': 'No members to show',
  'Les membres de cette famille apparaîtront ici dès qu’ils seront disponibles.': 'Members of this family will appear here when available.',
  'Famille administrée': 'Family you manage', 'Famille partagée': 'Shared family',
  'Voir la famille': 'View family', 'Créer une occasion pour {name}': 'Create an occasion for {name}',
  'Créez votre première famille': 'Create your first family',
  'Rassemblez les personnes qui comptent et découvrez leurs envies.': 'Bring together those who matter and discover their wishes.',
  'Les personnes à découvrir': 'People to discover', 'CADEAUX EN PRÉPARATION': 'GIFTS IN THE WORKS',
  'Mes réservations': 'My reservations', 'Aucune réservation pour le moment': 'No reservations yet',
  'Explorez les listes de vos proches pour leur préparer une surprise.': 'Explore your loved ones’ lists to plan a surprise.',
  'Découvrir les envies': 'Discover wishes', 'SOUVENIRS PARTAGÉS': 'SHARED MEMORIES',
  'Un cadeau offert': 'A gift given', 'Vos souvenirs commencent ici': 'Your memories start here',
  'L’historique de vos cadeaux et occasions s’affichera ici.': 'Your gift and occasion history will appear here.',
  'TROUVEZ L’INSPIRATION': 'FIND INSPIRATION', 'Personnes et envies': 'People and wishes',
  'Rechercher une personne, une envie…': 'Search for a person or wish…',
  'Envie cadeau': 'Gift wish', 'Personne': 'Person', 'Voir': 'View',
  'Aucun résultat': 'No results', 'Que recherchez-vous ?': 'What are you looking for?',
  'Essayez d’autres mots-clés.': 'Try other keywords.',
  'Retrouvez une personne ou une idée cadeau en quelques lettres.': 'Find a person or gift idea in just a few letters.',
  'VOTRE ESPACE': 'YOUR SPACE', 'Votre compte Giftit': 'Your Giftit account',
  'ADRESSE E-MAIL': 'EMAIL ADDRESS', 'DATE DE NAISSANCE': 'DATE OF BIRTH',
  'Non renseignée': 'Not provided', 'Se déconnecter': 'Log out',
  'GIFTIT': 'GIFTIT', 'Nouvelle occasion': 'New occasion',
  'Modifier les tags': 'Edit tags', 'Réserver une envie': 'Reserve a wish',
  'Nom de la famille': 'Family name', 'Ex. : La famille Martin': 'E.g. the Martin family',
  'Créer la famille': 'Create family', 'Tags séparés par des virgules': 'Comma-separated tags',
  'livre, déco, anniversaire': 'book, decor, birthday', 'Enregistrer les tags': 'Save tags',
  'Supprimer « {title} » de votre liste ?': 'Delete “{title}” from your list?',
  'Envie supprimée.': 'Wish deleted.', 'Ordre enregistré.': 'Order saved.',
  'Déconnexion réussie.': 'Logged out successfully.',
  'LES CADEAUX QUI NOUS RAPPROCHENT': 'GIFTS THAT BRING US CLOSER',
  'Offrir ensemble,': 'Give together,', 'sourire longtemps.': 'smile for longer.',
  'Partagez vos envies, découvrez celles de vos proches et célébrez chaque occasion avec attention.': 'Share your wishes, discover your loved ones’ wishes, and celebrate every occasion thoughtfully.',
  'Des petites attentions, de grands souvenirs.': 'Small gestures, lasting memories.',
  'Giftit. Fait pour partager.': 'Giftit. Made for sharing.',
  'BIENVENUE SUR GIFTIT': 'WELCOME TO GIFTIT',
  'Heureux de vous revoir !': 'Welcome back!', 'Créons votre compte': 'Let’s create your account',
  'Connectez-vous pour retrouver vos proches et vos envies.': 'Sign in to reconnect with loved ones and your wishes.',
  'Quelques informations suffisent pour commencer.': 'Just a few details to get started.',
  'Prénom': 'First name', 'Nom': 'Last name', 'Date de naissance': 'Date of birth',
  'Adresse e-mail': 'Email address', 'Mot de passe': 'Password',
  'vous@exemple.fr': 'you@example.com', 'Code d’invitation': 'Invitation code',
  '(facultatif)': '(optional)', 'Votre code d’invitation': 'Your invitation code',
  'Un proche vous a invité dans son foyer ? Saisissez son code ici.': 'Invited to a household? Enter the code here.',
  'Veuillez patienter…': 'Please wait…', 'Se connecter': 'Sign in',
  'Créer mon compte': 'Create my account', 'Pas encore de compte ?': 'Don’t have an account?',
  'Déjà un compte ?': 'Already have an account?', 'S’inscrire': 'Sign up',
  'Le mot de passe doit contenir au moins 12 caractères.': 'Your password must be at least 12 characters long.',
  'Connexion impossible.': 'Could not sign in.',
  'Lien du produit': 'Product link', 'Chargement…': 'Loading…', 'Prévisualiser': 'Preview',
  'Collez un lien pour préremplir les informations.': 'Paste a link to fill in the details.',
  'Produit trouvé': 'Product found', 'Nom de l’envie': 'Wish name',
  'URL de l’image (obligatoire)': 'Image URL (required)', 'Description': 'Description',
  'Prix (€)': 'Price (€)', 'Tags': 'Tags', 'livre, déco': 'book, decor',
  'Ajouter à ma liste': 'Add to my list', 'Envie ajoutée à votre liste.': 'Wish added to your list.',
  'Nom de l’occasion': 'Occasion name', 'Ex. : Noël': 'E.g. Christmas',
  'Type d’occasion': 'Occasion type', 'Date fixe': 'Fixed date',
  'Anniversaire (date de naissance)': 'Birthday (date of birth)',
  'Fête du prénom': 'Name day', 'Jour': 'Day', 'Mois': 'Month',
  'La date est calculée à partir du profil de la personne lorsqu’elle est disponible.': 'The date is calculated from the person’s profile when available.',
  'Créer l’occasion': 'Create occasion', 'Occasion créée.': 'Occasion created.',
  'Rejoindre une famille': 'Join a family',
  'Vous administrez un foyer ? Saisissez le code d’invitation à la famille reçu de son administrateur pour y rattacher votre foyer.': 'Manage a household? Enter the family invitation code from its administrator to link your household.',
  'Code d’invitation à la famille': 'Family invitation code',
  'Rejoindre la famille': 'Join family', 'Votre foyer a rejoint la famille.': 'Your household joined the family.',
  'Administration de {name}': 'Manage {name}', 'Gérer la famille': 'Manage family',
  'Foyers rattachés': 'Linked households', 'Aucun foyer disponible.': 'No households available.',
  'Inviter un foyer dans cette famille': 'Invite a household to this family',
  'Communiquez ce code à l’administrateur du foyer pour qu’il rejoigne la famille.': 'Share this code with the household administrator to join the family.',
  'Création…': 'Creating…', 'Créer un code d’invitation à la famille': 'Create a family invitation code',
  'Code d’invitation à la famille (visible uniquement maintenant)': 'Family invitation code (only visible now)',
  'Renommer la famille': 'Rename family', 'Renommer': 'Rename',
  'Famille renommée.': 'Family renamed.', 'Famille créée.': 'Family created.',
  'Inviter dans mon foyer': 'Invite to my household',
  'Générez un code valable 7 jours, à communiquer à la personne invitée. L’administration du foyer est requise.': 'Generate a code valid for 7 days to share with your guest. Household administrator access is required.',
  'Créer un code d’invitation au foyer': 'Create a household invitation code',
  'Code d’invitation au foyer pour l’inscription (visible uniquement maintenant)': 'Household sign-up invitation code (only visible now)',
  'Cette envie est réservée par': 'This wish is reserved by',
  'Participants :': 'Participants:', 'Vous participez déjà à ce cadeau.': 'You are already contributing to this gift.',
  'Demander à participer': 'Request to contribute',
  'Cette réservation n’est pas ouverte aux participations.': 'This reservation is not open to contributions.',
  'Demande de participation envoyée.': 'Contribution request sent.',
  'Réservation mise à jour.': 'Reservation updated.', 'Envie réservée !': 'Wish reserved!',
  'Pour': 'For', 'Occasions (au moins une)': 'Occasions (at least one)',
  'Occasion': 'Occasion', 'année {year}': 'year {year}',
  'Aucune occasion datée pour cette personne. Créez une occasion dans une famille commune avant de réserver.': 'No dated occasions for this person. Create an occasion in a shared family before reserving.',
  'Inviter des participants': 'Invite contributors',
  'Autoriser les demandes de participation': 'Allow contribution requests',
  'Enregistrer les modifications': 'Save changes', 'Confirmer la réservation': 'Confirm reservation',
  'Demandes indisponibles.': 'Requests unavailable.', 'Occasions indisponibles.': 'Occasions unavailable.',
  'Réservation #{id}': 'Reservation #{id}', 'Cadeau en préparation': 'Gift in preparation',
  'Annulé': 'Cancelled', 'Organisé par': 'Organized by', 'Aucun': 'None',
  'L’envie a été supprimée.': 'The wish was deleted.',
  'Gérer': 'Manage', 'Statut': 'Status', 'Ouvert aux participations': 'Open to contributions',
  'Participants': 'Contributors',
  'Participants existants conservés ; détails de l’envie indisponibles.': 'Existing contributors kept; wish details unavailable.',
  'Enregistrer': 'Save', 'Annuler la réservation': 'Cancel reservation',
  'Annuler cette réservation ?': 'Cancel this reservation?', 'Réservation annulée.': 'Reservation cancelled.',
  'Demandes de participation': 'Contribution requests', 'Demande acceptée.': 'Request accepted.',
  'Demande refusée.': 'Request declined.', 'Accepter': 'Accept', 'Refuser': 'Decline',
  'Tags mis à jour.': 'Tags updated.',
} as const

export type TranslationKey = keyof typeof english

export function translate(key: TranslationKey, locale: Locale, values: Record<string, string | number> = {}): string {
  const text: string = locale === 'fr' ? key : english[key]
  return text.replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match))
}

// Only known frontend messages are translated; arbitrary API error details remain untouched.
export function localizeMessage(message: string, locale: Locale) {
  const key = (Object.keys(english) as TranslationKey[]).find(candidate => candidate === message || english[candidate] === message)
  if (key) return translate(key, locale)
  const fallback = /^(?:Une erreur est survenue|An error occurred) \((\d{3})\)\.$/.exec(message)
  return fallback ? translate('Une erreur est survenue ({status}).', locale, { status: fallback[1] }) : message
}

type OccasionKind = 'fixed' | 'birthday' | 'name_day'
const predefinedOccasions: Record<string, { label: TranslationKey; kind: OccasionKind }> = {
  Anniversaire: { label: 'Anniversaire', kind: 'birthday' },
  Fête: { label: 'Fête', kind: 'name_day' },
  Noël: { label: 'Noël', kind: 'fixed' },
}

export function occasionName(name: string | undefined | null, locale: Locale, kind?: OccasionKind) {
  if (!name) return ''
  const predefined = Object.prototype.hasOwnProperty.call(predefinedOccasions, name) ? predefinedOccasions[name] : undefined
  return predefined && (!kind || kind === predefined.kind) ? translate(predefined.label, locale) : name
}

export function formatMoney(amount: number | string | undefined, locale: Locale) {
  return amount === undefined || amount === null || amount === '' ? ''
    : new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(amount) || 0)
}

export function formatDate(date: string | undefined | null, locale: Locale) {
  if (!date) return ''
  const value = new Date(date)
  return Number.isNaN(value.getTime()) ? date : new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(value)
}
