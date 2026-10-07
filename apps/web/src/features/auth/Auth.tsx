import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { api, json, type Person } from '../../api'
import { LanguageControl } from '../../language'
import { useTranslation } from '../../language-context'
import { localizeMessage } from '../../locale'
import { Icon, type IconName } from '../../components/atoms/Icon'
import { TextInput } from '../../components/atoms/TextInput'
import { FormField } from '../../components/molecules/FormField'
export function Auth({ mode, setMode, onAuth, error, setError }: { mode: 'login' | 'register'; setMode: (mode: 'login' | 'register') => void; onAuth: (person: Person) => void; error: string; setError: (message: string) => void }) {
  const { locale, t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [claiming, setClaiming] = useState(false)
  // Whether an invitation is required is the server's decision, and the form has to know it
  // before it is submitted: asking someone to fill in six fields only to be told they were
  // never allowed to is the kind of small cruelty that makes people give up. Assumed open
  // until told otherwise, so a failed read never blocks the first account of a new install.
  const [openRegistration, setOpenRegistration] = useState(true)
  useEffect(() => {
    let active = true
    api<{ openRegistration: boolean }>('/config')
      .then(config => { if (active) setOpenRegistration(config.openRegistration) })
      .catch(() => {})
    return () => { active = false }
  }, [])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const data = new FormData(event.currentTarget)
    const fields = claiming
      ? { code: String(data.get('claim') || '').trim(), email: data.get('email'), password: data.get('password') }
      : mode === 'register'
      ? {
          firstName: data.get('firstName'),
          lastName: data.get('lastName'),
          email: data.get('email'),
          password: data.get('password'),
          birthDate: data.get('birthDate'),
          ...(String(data.get('invitation') || '').trim() ? { invitation: String(data.get('invitation')).trim() } : {}),
        }
      : { email: data.get('email'), password: data.get('password') }
    if ((mode === 'register' || claiming) && String(data.get('password')).length < 12) {
      setError(t('Le mot de passe doit contenir au moins 12 caractères.'))
      setBusy(false)
      return
    }
    try {
      await api(`/auth/${claiming ? 'claim' : mode}`, json('POST', fields))
      onAuth(await api<Person>('/auth/me'))
    } catch (problem) { setError(problem instanceof Error ? problem.message : t('Connexion impossible.')) }
    finally { setBusy(false) }
  }
  // The page scrolls so a visitor can understand what the app is for, but the form stays
  // stuck to the side on wide screens and sits right under the hero on narrow ones: reading
  // further is a choice, never a detour to sign in.
  return <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[minmax(0,1fr)_minmax(390px,460px)]">
    <div className="flex flex-col bg-brand-100 p-7 sm:p-12 lg:col-start-1 lg:row-start-1 lg:min-h-screen">
      <div className="flex items-center justify-between gap-2.5"><div className="flex items-center gap-2.5"><span className="flex size-10 items-center justify-center rounded-2xl bg-brand-600 text-white"><Icon name="gift"/></span><span className="font-['Outfit'] text-[27px] font-extrabold tracking-tight">pensa.</span></div><LanguageControl/></div>
      <div className="my-auto max-w-lg py-14">
        <span className="eyebrow">{t('FINI LA CHARGE MENTALE DES CADEAUX')}</span>
        <h1 className="mt-5 font-['Outfit'] text-4xl font-bold leading-[1.13] tracking-tight text-ink-900 sm:text-6xl">{t('Organisez les cadeaux,')} <span className="text-brand-600">{t('l’esprit tranquille.')}</span></h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-500">{t('Les envies de chacun, les dates qui arrivent, qui offre quoi : tout est au même endroit, et personne n’a à tout retenir.')}</p>
        <div className="mt-10 flex items-center gap-3 rounded-2xl bg-white/65 p-4 text-sm font-semibold text-ink-600"><span className="rounded-xl bg-brand-200 p-2.5 text-brand-600"><Icon name="heart"/></span> {t('Plus de doublons, plus de listes dans un coin de la tête.')}</div>
        <p className="muted mt-8 hidden items-center gap-2 lg:flex"><Icon name="chevron" size={15} className="rotate-90"/> {t('Faites défiler pour voir ce que Pensa change au quotidien.')}</p>
      </div>
    </div>
    <div id="auth-panel" className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
      <div className="flex items-center justify-center px-6 py-12 lg:sticky lg:top-0 lg:h-screen lg:flex-col lg:justify-start lg:overflow-y-auto"><div className="w-full max-w-[420px] lg:my-auto">
      <p className="eyebrow mb-3">{t('BIENVENUE SUR PENSA')}</p>
      <h2 className="font-['Outfit'] text-3xl font-bold">{claiming ? t('Reprenez votre liste en main') : mode === 'login' ? t('Reprenez où vous en étiez') : t('Créons votre compte')}</h2>
      <p className="muted mb-8 mt-2">{claiming ? t('Votre foyer tenait votre liste : ce code vous donne votre propre compte, avec vos envies déjà dedans.') : mode === 'login' ? t('Connectez-vous pour retrouver vos listes et vos cadeaux en cours.') : t('Quelques informations suffisent pour commencer.')}</p>
      {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{localizeMessage(error, locale)}</p>}
      <form onSubmit={submit} className="space-y-4">
        {mode === 'register' && !claiming && <>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="firstName" label={t('Prénom')}><TextInput id="firstName" name="firstName" autoComplete="given-name" required/></FormField>
            <FormField id="lastName" label={t('Nom')}><TextInput id="lastName" name="lastName" autoComplete="family-name" required/></FormField>
          </div>
          <FormField id="birthDate" label={t('Date de naissance')}><TextInput id="birthDate" name="birthDate" type="date" required/></FormField>
        </>}
        {claiming && <FormField id="claim" label={t('Code de rattachement')} hint={t('Ce code vous a été donné par un admin de votre foyer.')}><TextInput id="claim" name="claim" type="text" autoComplete="off" placeholder={t('Le code remis par votre foyer')} required/></FormField>}
        <FormField id="email" label={t('Adresse e-mail')}><TextInput id="email" name="email" type="email" autoComplete="email" placeholder={t('vous@exemple.fr')} required/></FormField>
        <FormField id="password" label={t('Mot de passe')}><TextInput id="password" name="password" type="password" autoComplete={mode === 'login' && !claiming ? 'current-password' : 'new-password'} minLength={mode === 'register' || claiming ? 12 : undefined} required/></FormField>
        {mode === 'register' && !claiming && <FormField id="invitation" label={t('Code d’invitation')} optionalText={openRegistration ? t('(facultatif)') : t('(requis)')} hint={openRegistration ? t('Un proche vous a invité dans son foyer ou dans sa famille ? Saisissez son code ici.') : t('Cet espace est sur invitation. Demandez son code à la personne qui vous a invité, dans son foyer ou dans sa famille.')}><TextInput id="invitation" name="invitation" type="text" autoComplete="off" placeholder={t('Votre code d’invitation')} required={!openRegistration}/></FormField>}
        <button disabled={busy} className="primary !mt-6 w-full">{busy ? t('Veuillez patienter…') : claiming ? t('Activer mon compte') : mode === 'login' ? t('Se connecter') : t('Créer mon compte')} <Icon name="arrow" size={17}/></button>
      </form>
      <p className="mt-7 text-center text-sm text-ink-500">{mode === 'login' ? t('Pas encore de compte ?') : t('Déjà un compte ?')} <button className="font-bold text-brand-600 hover:underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setClaiming(false); setError('') }}>{mode === 'login' ? t('S’inscrire') : t('Se connecter')}</button></p>
      <p className="mt-2 text-center text-sm text-ink-500"><button className="font-bold text-brand-600 hover:underline" onClick={() => { setClaiming(!claiming); setError('') }}>{claiming ? t('Revenir à la connexion classique') : t('J’ai un code de rattachement')}</button></p>
    </div></div></div>
    <div className="px-7 pb-14 sm:px-12 lg:col-start-1 lg:row-start-2">
      <LandingSection id="landing-load" kicker={t('CE QUE PERSONNE NE COMPTE')} title={t('Organiser des cadeaux, c’est un travail invisible.')} intro={t('Ce n’est pas l’achat qui pèse. C’est tout ce qu’il faut garder en tête avant.')}>
        <div className="grid gap-7 sm:grid-cols-3">
          <LandingPoint icon="spark" title={t('Les idées arrivent au mauvais moment')} text={t('Une envie glissée dans une conversation en mars est oubliée en décembre.')}/>
          <LandingPoint icon="calendar" title={t('Les dates se rappellent trop tard')} text={t('Un anniversaire vous revient trois jours avant, jamais trois semaines avant.')}/>
          <LandingPoint icon="users" title={t('Personne n’ose demander')} text={t('Sans se concerter, deux personnes achètent le même cadeau, ou chacune attend l’autre.')}/>
        </div>
      </LandingSection>
      <LandingSection id="landing-how" kicker={t('COMMENT ÇA MARCHE')} title={t('Quatre gestes, et vous n’avez plus rien à retenir.')}>
        <div className="grid gap-7 sm:grid-cols-2">
          <LandingPoint step={1} title={t('Chacun note ses envies')} text={t('Collez un lien : le nom, l’image et le prix se remplissent tout seuls. Rien à décrire.')}/>
          <LandingPoint step={2} title={t('Les occasions se placent toutes seules')} text={t('Anniversaires, fêtes et Noël arrivent dans l’ordre, année après année, sans rien saisir.')}/>
          <LandingPoint step={3} title={t('On réserve sans se croiser')} text={t('Réserver une envie la signale aux autres, jamais à la personne concernée.')}/>
          <LandingPoint step={4} title={t('On suit jusqu’au bout')} text={t('Acheté, emballé, offert : chaque étape se coche, et ce qu’il reste à faire apparaît sur votre tableau de bord.')}/>
        </div>
      </LandingSection>
      <LandingSection id="landing-value" kicker={t('CE QUE ÇA CHANGE')} title={t('Une seule place pour tout ce qui concerne les cadeaux.')}>
        <div className="grid gap-7 sm:grid-cols-2 xl:grid-cols-3">
          <LandingPoint icon="check" title={t('Une liste de choses à faire')} text={t('Ce qu’il reste à acheter, à emballer, à confirmer : rassemblé et daté.')}/>
          <LandingPoint icon="gift" title={t('Les cadeaux hors liste aussi')} text={t('Une idée qui ne vient d’aucune liste se gère ici comme les autres.')}/>
          <LandingPoint icon="heart" title={t('À plusieurs sur un même cadeau')} text={t('Rendez un cadeau visible à vos proches et laissez-les demander à participer.')}/>
          <LandingPoint icon="home" title={t('Des foyers, pas seulement des familles')} text={t('Un foyer se gère à part et rejoint plusieurs familles, belle-famille comprise.')}/>
          <LandingPoint icon="clock" title={t('Un historique qui reste')} text={t('Ce qui a déjà été offert reste consultable, pour ne jamais offrir deux fois la même chose.')}/>
          <LandingPoint icon="search" title={t('En français comme en anglais')} text={t('Toute l’interface bascule d’une langue à l’autre en un clic.')}/>
        </div>
      </LandingSection>
      <LandingSection id="landing-surprise" kicker={t('LA SURPRISE D’ABORD')} title={t('Vous ne verrez jamais ce qui vous est destiné.')} intro={t('Ce n’est pas une option à activer : c’est la règle de base de la plateforme.')}>
        <div className="grid gap-7 sm:grid-cols-2">
          <LandingPoint icon="close" title={t('Rien ne filtre sur vos propres envies')} text={t('Ni qui a réservé, ni quoi, ni combien de personnes participent.')}/>
          <LandingPoint icon="user" title={t('On entre par invitation')} text={t('Une famille se rejoint avec un code partagé par un proche, jamais par une recherche.')}/>
        </div>
      </LandingSection>
      <LandingSection id="landing-ai" kicker={t('EN TOUTE TRANSPARENCE')} title={t('Cette application a été entièrement générée par une IA.')} intro={t('Le code, les textes et le design ont été produits par une intelligence artificielle, dirigée par un humain. Autant que vous le sachiez avant de créer un compte.')}>
        <div className="grid gap-7 sm:grid-cols-3">
          <LandingPoint icon="spark" title={t('Ce que cela signifie')} text={t('Chaque ligne de code, chaque phrase et chaque icône de cette interface ont été écrites par une IA, pas par une équipe de développeurs.')}/>
          <LandingPoint icon="check" title={t('Le code est ouvert')} text={t('Le projet est public et sous licence MIT : vous pouvez le lire, le vérifier et l’héberger vous-même.')}/>
          <LandingPoint icon="clock" title={t('À garder en tête')} text={t('C’est un projet personnel, pas un service commercial avec des garanties. N’y mettez que des données que vous pourriez perdre.')}/>
        </div>
      </LandingSection>
      <div className="mt-4 rounded-[26px] bg-brand-100 px-7 py-9 sm:px-10">
        <h2 className="font-['Outfit'] text-2xl font-bold tracking-tight text-ink-900">{t('Prêt à vous libérer la tête ?')}</h2>
        <p className="mt-3 max-w-md leading-relaxed text-ink-500">{t('Créez votre compte, ajoutez une première envie, invitez vos proches. Le reste suit tout seul.')}</p>
        <a className="primary mt-6" href="#auth-panel">{t('Commencer maintenant')} <Icon name="arrow" size={17}/></a>
      </div>
      <p className="mt-10 text-sm text-ink-500">{t('Pensa. L’organisation des cadeaux, en clair.')}</p>
      <p className="mt-2 text-sm text-ink-500">{t('Application entièrement générée par IA. Code ouvert sous licence MIT.')}</p>
    </div>
  </div>
}

function LandingSection({ id, kicker, title, intro, children }: { id: string; kicker: string; title: string; intro?: string; children: ReactNode }) {
  return <section aria-labelledby={id} className="border-t border-line py-12 sm:py-14">
    <p className="eyebrow">{kicker}</p>
    <h2 id={id} className="mt-3 max-w-xl font-['Outfit'] text-2xl font-bold leading-snug tracking-tight text-ink-900 sm:text-[32px]">{title}</h2>
    {intro && <p className="mt-4 max-w-xl leading-relaxed text-ink-500">{intro}</p>}
    <div className="mt-9">{children}</div>
  </section>
}

function LandingPoint({ icon, step, title, text }: { icon?: IconName; step?: number; title: string; text: string }) {
  return <div className="flex gap-4">
    <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-100 font-['Outfit'] font-bold text-brand-600">{step ?? (icon && <Icon name={icon}/>)}</span>
    <div><h3 className="font-['Outfit'] font-semibold text-ink-900">{title}</h3><p className="muted mt-1.5 leading-relaxed">{text}</p></div>
  </div>
}
