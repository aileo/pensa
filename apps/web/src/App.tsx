import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { api, ApiError, dateOf, initials, json, list, money, nameOf, type Family, type Household, type Id, type Occasion, type OccasionSelection, type Onboarding, type ParticipationRequest, type Person, type Reservation, type Todo, type Wish } from './api'
import { LanguageControl } from './language'
import { useTranslation } from './language-context'
import { localizeMessage, occasionLabel, occasionName, type Locale, type TranslationKey } from './locale'
import './index.css'

type Page = 'dashboard' | 'wishes' | 'families' | 'reservations' | 'history' | 'search' | 'profile'
type Modal = 'wish' | 'family' | 'occasion' | 'reservation' | 'tags' | 'offList' | null
type IconName = 'home' | 'heart' | 'users' | 'gift' | 'clock' | 'search' | 'user' | 'plus' | 'arrow' | 'arrowLeft' | 'arrowUp' | 'arrowDown' | 'link' | 'calendar' | 'trash' | 'edit' | 'check' | 'close' | 'menu' | 'logout' | 'spark' | 'grip' | 'chevron' | 'external' | 'cart' | 'box' | 'party'

const paths: Record<IconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-7h6v7"/></>,
  heart: <path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.5a5.5 5.5 0 0 0 0-7.8z"/>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></>,
  gift: <><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M2 8h20M12 8v13M12 8H8a3 3 0 1 1 3-3c0 1.5 1 3 1 3zm0 0h4a3 3 0 1 0-3-3c0 1.5-1 3-1 3z"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
  arrowLeft: <path d="M19 12H5m6 6-6-6 6-6"/>,
  arrowUp: <path d="M12 19V5m-6 6 6-6 6 6"/>,
  arrowDown: <path d="M12 5v14m6-6-6 6-6-6"/>,
  link: <><path d="M10 13a5 5 0 0 0 7.1 0l2.1-2.1a5 5 0 0 0-7.1-7.1L11 5"/><path d="M14 11a5 5 0 0 0-7.1 0l-2.1 2.1a5 5 0 0 0 7.1 7.1L13 19"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></>,
  trash: <><path d="M4 7h16M9 7V4h6v3m4 0-1 14H6L5 7"/><path d="M10 11v6m4-6v6"/></>,
  edit: <><path d="m4 17 12-12 3 3L7 20H4zM14 7l3 3"/></>,
  check: <path d="m4 12 5 5L20 6"/>,
  close: <path d="M5 5 19 19M19 5 5 19"/>,
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
  logout: <><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M14 8l4 4-4 4m4-4H9"/></>,
  spark: <><path d="m12 2 2 7 7 3-7 2-2 8-2-8-7-2 7-3z"/></>,
  grip: <><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  external: <><path d="M13 4h7v7m0-7-9 9"/><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/></>,
  cart: <><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12h11L21 7H6"/></>,
  box: <><path d="M3 8h18v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 8l2-4h14l2 4"/><path d="M12 4v17M8.5 8c-1.4 0-2.5-.9-2.5-2s1.1-2 2.5-2S12 5.5 12 8m3.5 0c1.4 0 2.5-.9 2.5-2s-1.1-2-2.5-2S12 5.5 12 8"/></>,
  party: <><path d="m3 21 5-14 9 9z"/><path d="M14 3.5c1.2.6 1.6 2 1 3.2M18 2c1.8.9 2.5 3 1.6 4.8M20.5 11c-.6-1.2-2-1.6-3.2-1M22 15c-.9-1.8-3-2.5-4.8-1.6"/></>,
}
function Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
function Avatar({ person, size = 'md' }: { person?: Person | null; size?: 'sm' | 'md' | 'lg' }) {
  return <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-600 ${size === 'sm' ? 'size-8 text-xs' : size === 'lg' ? 'size-16 text-xl' : 'size-10 text-sm'}`}>{initials(person)}</span>
}
// The lists an administrator maintains for the members of their household who cannot sign in.
// Shown wherever one of those lists is being written, so switching between them — and back to
// one's own — is a single click instead of a walk through the family tree.
function ManagedListsBar({ me, managed, activeId, onSelf, onPerson }: {
  me: Person; managed: Person[]; activeId: Id | null; onSelf: () => void; onPerson: (person: Person) => void
}) {
  const { t } = useTranslation()
  if (!managed.length) return null
  const chip = (active: boolean) => `flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${active ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-500 hover:border-brand-200 hover:text-brand-600'}`
  return <nav aria-label={t('Les listes que je tiens')} className="mb-7">
    <p className="eyebrow mb-2">{t('LES LISTES QUE JE TIENS')}</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className={chip(activeId === null)} aria-current={activeId === null ? 'true' : undefined} onClick={onSelf}><Avatar person={me} size="sm"/>{t('Mes envies')}</button>
      {managed.map(person => {
        const active = String(person.id) === String(activeId)
        return <button key={person.id} type="button" className={chip(active)} aria-current={active ? 'true' : undefined} onClick={() => onPerson(person)}><Avatar person={person} size="sm"/>{nameOf(person)}</button>
      })}
    </div>
  </nav>
}
function Empty({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
  return <div className="card flex flex-col items-center px-5 py-14 text-center"><span className="mb-4 rounded-2xl bg-brand-50 p-4 text-brand-600"><Icon name={icon} size={28} /></span><h3 className="font-['Outfit'] text-xl font-semibold">{title}</h3><p className="muted mt-2 max-w-sm">{text}</p>{action && <div className="mt-5">{action}</div>}</div>
}
const sectionTones = {
  brand: 'bg-brand-100 text-brand-600',
  clay: 'bg-clay-100 text-clay-600',
  sage: 'bg-sage-100 text-sage-600',
} as const
function SectionTitle({ kicker, title, action, icon, tone = 'brand' }: { kicker?: string; title: string; action?: ReactNode; icon?: IconName; tone?: keyof typeof sectionTones }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div className="flex items-center gap-3">{icon && <span className={`hidden shrink-0 rounded-2xl p-2.5 sm:block ${sectionTones[tone]}`}><Icon name={icon} size={22}/></span>}<div>{kicker && <p className="eyebrow mb-1">{kicker}</p>}<h2 className="font-['Outfit'] text-2xl font-semibold tracking-tight text-ink-900">{title}</h2></div></div>{action}</div>
}
function WishCard({ wish, mine, curated, onReserve, onTags, onDelete }: { wish: Wish; mine: boolean; curated?: boolean; onReserve: () => void; onTags?: () => void; onDelete?: () => void }) {
  const { t } = useTranslation()
  return <article className="card group flex h-full flex-col overflow-hidden">
    <div className="relative flex h-44 items-center justify-center bg-surface-soft">
      {wish.image ? <img src={wish.image} alt="" className="h-full w-full object-cover" loading="lazy" onError={event => { event.currentTarget.style.display = 'none' }} /> : <Icon name="gift" size={45} className="text-brand-300" />}
      {wish.reservation && !mine && <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-brand-600">{t('Réservé')}</span>}
    </div>
    <div className="flex flex-1 flex-col p-4">
      <div className="flex items-start justify-between gap-2"><h3 className="font-['Outfit'] text-base font-semibold leading-snug">{wish.title}</h3>{wish.price !== undefined && wish.price !== null && <span className="shrink-0 text-sm font-bold text-brand-600">{money(wish.price)}</span>}</div>
      {wish.description && <p className="mt-2 line-clamp-2 text-sm text-ink-500">{wish.description}</p>}
      {!!wish.tags?.length && <div className="mt-3 flex flex-wrap gap-1.5">{wish.tags.map(tag => <span className="chip" key={tag}>#{tag}</span>)}</div>}
      {!mine && wish.reservation && <p className="mt-3 text-xs text-ink-500">{t('Réservé par {name}', { name: nameOf(wish.reservation.creator) })}{wish.reservation.openToContributions ? ` · ${t('Participation possible')}` : ''}</p>}
      <div className="mt-auto flex items-center gap-1 border-t border-line-soft pt-3" style={{ marginTop: 'auto', paddingTop: 12 }}>
        {wish.url && <a className="icon-button" href={wish.url} target="_blank" rel="noopener noreferrer" aria-label={t('Voir {title} sur le site marchand', { title: wish.title })}><Icon name="external" size={17} /></a>}
        {mine || curated ? <div className="ml-auto flex items-center gap-1"><button className="icon-button" onClick={onTags} aria-label={t('Modifier les tags de {title}', { title: wish.title })}><Icon name="edit" size={17}/></button><button className="icon-button hover:!text-red-600" onClick={onDelete} aria-label={t('Supprimer {title}', { title: wish.title })}><Icon name="trash" size={17}/></button>{curated && <button className="secondary !px-3 !py-1.5 text-xs" onClick={onReserve}>{wish.reservation ? t('Voir la réservation') : t('Réserver')} <Icon name="arrow" size={14}/></button>}</div>
          : <button className="secondary ml-auto !px-3 !py-1.5 text-xs" onClick={onReserve}>{wish.reservation ? t('Voir la réservation') : t('Réserver')} <Icon name="arrow" size={14}/></button>}
      </div>
    </div>
  </article>
}

const nav: { page: Page; label: TranslationKey; icon: IconName }[] = [
  { page: 'dashboard', label: 'Tableau de bord', icon: 'home' },
  { page: 'wishes', label: 'Mes envies', icon: 'heart' },
  { page: 'families', label: 'Ma famille', icon: 'users' },
  { page: 'reservations', label: 'Réservations', icon: 'gift' },
  { page: 'history', label: 'Historique', icon: 'clock' },
  { page: 'search', label: 'Rechercher', icon: 'search' },
]
const titleByPage: Record<Page, TranslationKey> = {
  dashboard: 'Tableau de bord', wishes: 'Mes envies', families: 'Ma famille',
  reservations: 'Réservations', history: 'Historique', search: 'Rechercher', profile: 'Mon profil',
}
type WishFilters = { tag: string; availability: string; minPrice: string; maxPrice: string }
const emptyWishFilters: WishFilters = { tag: '', availability: '', minPrice: '', maxPrice: '' }

function App() {
  const { t } = useTranslation()
  const [account, setAccount] = useState<{ person: Person; session: number } | null>(null)
  const session = useRef(0)
  const [authChecked, setAuthChecked] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState('')
  const onAuth = (person: Person) => { setAccount({ person, session: ++session.current }); setError('') }

  useEffect(() => {
    let active = true
    api<Person>('/auth/me').then(person => { if (active) onAuth(person) }).catch(problem => {
      if (active && !(problem instanceof ApiError && problem.status === 401)) setError(problem instanceof Error ? problem.message : t('Une erreur inattendue est survenue.'))
    }).finally(() => { if (active) setAuthChecked(true) })
    return () => { active = false }
  }, [t])

  if (!authChecked) return <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-brand-600"><LanguageControl/><p role="status">{t('Chargement de Pensa…')}</p></div>
  if (!account) return <Auth mode={authMode} setMode={setAuthMode} onAuth={onAuth} error={error} setError={setError} />
  return <AuthenticatedApp key={account.session} me={account.person} onLogout={() => setAccount(null)} onProfile={person => setAccount(current => current && { ...current, person })} />
}

function AuthenticatedApp({ me, onLogout, onProfile }: { me: Person; onLogout: () => void; onProfile: (person: Person) => void }) {
  const { locale, t } = useTranslation()
  const [page, setPage] = useState<Page>('dashboard')
  const [mobileNav, setMobileNav] = useState(false)
  const [families, setFamilies] = useState<Family[]>([])
  const [households, setHouseholds] = useState<Household[]>([])
  const [users, setUsers] = useState<Person[]>([])
  const [wishes, setWishes] = useState<Wish[]>([])
  const [sharedWishes, setSharedWishes] = useState<Wish[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [dashboard, setDashboard] = useState<Record<string, unknown>>({})
  const [history, setHistory] = useState<unknown[]>([])
  const [searchResults, setSearchResults] = useState<unknown[]>([])
  const [searchText, setSearchText] = useState('')
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null)
  const [personWishes, setPersonWishes] = useState<Wish[]>([])
  const [personFilterState, setPersonFilterState] = useState<WishFilters & { personId: string }>({ ...emptyWishFilters, personId: '' })
  const personFilters = personFilterState.personId === String(selectedPerson?.id) ? personFilterState : emptyWishFilters
  const [modal, setModal] = useState<Modal>(null)
  const [selectedWish, setSelectedWish] = useState<Wish | null>(null)
  const [wishOwner, setWishOwner] = useState<Person | null>(null)
  const [occasions, setOccasions] = useState<Occasion[]>([])
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [focusedReservation, setFocusedReservation] = useState<Id | null>(null)
  const [offListRecipient, setOffListRecipient] = useState<Person | null>(null)
  const [personGifts, setPersonGifts] = useState<Reservation[]>([])
  const refresh = () => { setLoading(true); setRevision(value => value + 1) }
  const handleError = useCallback((problem: unknown) => setError(problem instanceof Error ? problem.message : t('Une erreur inattendue est survenue.')), [t])

  useEffect(() => {
    let active = true
    Promise.all([
      api<unknown>('/dashboard'), api<Family[]>('/families'), api<Person[]>('/users'),
      api<Wish[]>('/wishes'), api<Reservation[]>('/reservations'), api<Household[]>('/households'),
    ]).then(([dash, familyList, people, wishList, bookings, householdList]) => {
      if (!active) return
      setDashboard(dash && typeof dash === 'object' && !Array.isArray(dash) ? dash as Record<string, unknown> : {})
      setFamilies(list<Family>(familyList)); setUsers(list<Person>(people)); setHouseholds(list<Household>(householdList))
      setWishes(list<Wish>(wishList)); setReservations(list<Reservation>(bookings))
      const relatives = list<Person>(people).filter(relative => relative.id !== me.id)
      void Promise.allSettled(relatives.map(relative => api<Wish[]>(`/users/${encodeURIComponent(String(relative.id))}/wishes`)))
        .then(results => {
          if (active) setSharedWishes(results.flatMap(result => result.status === 'fulfilled' ? list<Wish>(result.value) : []))
        })
    }).catch(problem => { if (active) handleError(problem) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [me, revision, handleError])
  useEffect(() => {
    if (page !== 'history') return
    let active = true
    api<unknown[]>('/history').then(data => { if (active) setHistory(list(data)) }).catch(problem => { if (active) handleError(problem) })
    return () => { active = false }
  }, [me, page, revision, handleError])
  useEffect(() => {
    if (page !== 'search') return
    let active = true
    const timer = window.setTimeout(() => {
      api<unknown>(`/search?q=${encodeURIComponent(searchText.trim())}`).then(data => {
        if (active) setSearchResults(Array.isArray(data) ? data : data && typeof data === 'object' ? [...list<unknown>((data as Record<string, unknown>).people), ...list<unknown>((data as Record<string, unknown>).wishes)] : [])
      }).catch(problem => { if (active) handleError(problem) })
    }, 300)
    return () => { active = false; window.clearTimeout(timer) }
  }, [me, page, searchText, revision, handleError])
  useEffect(() => {
    if (!selectedPerson) return
    let active = true
    const query = new URLSearchParams()
    if (personFilters.tag.trim()) query.set('tag', personFilters.tag.trim())
    if (selectedPerson.id !== me?.id && personFilters.availability) query.set('availability', personFilters.availability)
    if (personFilters.minPrice.trim()) query.set('minPrice', personFilters.minPrice.trim())
    if (personFilters.maxPrice.trim()) query.set('maxPrice', personFilters.maxPrice.trim())
    const suffix = query.size ? `?${query}` : ''
    api<Wish[]>(`/users/${encodeURIComponent(String(selectedPerson.id))}/wishes${suffix}`).then(data => { if (active) setPersonWishes(list(data)) }).catch(problem => { if (active) handleError(problem) })
    return () => { active = false }
  }, [selectedPerson, me?.id, personFilters.tag, personFilters.availability, personFilters.minPrice, personFilters.maxPrice, revision, handleError])
  useEffect(() => {
    if (!selectedPerson || String(selectedPerson.id) === String(me.id)) return
    let active = true
    api<Reservation[]>(`/users/${encodeURIComponent(String(selectedPerson.id))}/off-list`).then(data => { if (active) setPersonGifts(list(data)) }).catch(problem => { if (active) handleError(problem) })
    return () => { active = false }
  }, [selectedPerson, me.id, revision, handleError])

  async function perform(action: () => Promise<unknown>, success: string, close = true) {
    setBusy(true); setError('')
    try {
      await action()
      if (close) setModal(null)
      setNotice(success); refresh()
      return true
    } catch (problem) { handleError(problem); return false }
    finally { setBusy(false) }
  }
  function go(next: Page) { setPage(next); setSelectedPerson(null); setSelectedFamily(null); setMobileNav(false); setError(''); setNotice(''); setFocusedReservation(null) }
  function openReservation(id: Id) { go('reservations'); setFocusedReservation(id) }
  async function changeStatus(id: Id, status: ReservationStatus, title?: string) {
    if (status === 'gifted' && !window.confirm(t('Marquer « {title} » comme offert ? Cette étape est définitive.', { title: title ?? '' }))) return false
    return perform(() => api(`/reservations/${id}`, json('PATCH', { status })), t(statusNotices[status]), false)
  }
  function openReserve(wish: Wish) {
    setSelectedWish(wish); setError(''); setModal('reservation')
    api<Occasion[]>(`/occasions?recipientId=${encodeURIComponent(String(wish.ownerId ?? ''))}`).then(data => setOccasions(list(data))).catch(handleError)
  }
  function openOccasion(family: Family) { setSelectedFamily(family); setModal('occasion'); setError('') }
  function openOffList(person?: Person | null) { setOffListRecipient(person ?? null); setModal('offList'); setError('') }
  const requestGift = (gift: Reservation) => perform(() => api(`/reservations/${gift.id}/requests`, json('POST', {})), t('Demande de participation envoyée.'), false)
  async function removeWish(wish: Wish) {
    if (window.confirm(t('Supprimer « {title} » de votre liste ?', { title: wish.title }))) await perform(() => api(`/wishes/${wish.id}`, { method: 'DELETE' }), t('Envie supprimée.'))
  }
  async function reorder(from: number, to: number) {
    if (from === to || to < 0 || to >= myWishes.length) return
    const reordered = [...myWishes]
    const [item] = reordered.splice(from, 1)
    reordered.splice(to, 0, item)
    const previous = wishes
    setWishes([...reordered, ...wishes.filter(wish => String(wish.ownerId) !== String(me?.id))])
    const ok = await perform(() => api('/wishes/order', json('PATCH', { ids: reordered.map(wish => wish.id) })), t('Ordre enregistré.'), false)
    if (!ok) setWishes(previous)
  }
  const myWishes = wishes.filter(wish => String(wish.ownerId) === String(me?.id) || wish.ownerId == null)
  const allPeople = users
  const activeFamily = selectedFamily && (families.find(family => String(family.id) === String(selectedFamily.id)) || selectedFamily)
  const dashboardOccasions = list<Occasion>(dashboard.occasions)
  const dashboardReservations = list<Reservation>(dashboard.reservations)
  const dashboardParticipating = list<Reservation>(dashboard.participating)
  const dashboardTodos = list<Todo>(dashboard.todos)
  const dashboardOpenGifts = list<Reservation>(dashboard.openGifts)
  const onboarding = dashboard.onboarding as Onboarding | undefined
  const myHousehold = households.find(household => household.mine)
  const isHouseholdAdmin = myHousehold?.members?.find(member => String(member.id) === String(me.id))?.householdAdmin ?? !!me.householdAdmin
  const otherHouseholds = households.filter(household => !household.mine)
  const curating = isHouseholdAdmin && !!selectedPerson && !!myHousehold?.members?.some(member => String(member.id) === String(selectedPerson.id) && member.managed)
  const managedMembers = isHouseholdAdmin ? (myHousehold?.members ?? []).filter(member => member.managed) : []
  const openWish = (owner: Person | null = null) => { setWishOwner(owner); setModal('wish'); setError('') }
  const openPerson = (person: Person) => {
    if (String(person.id) === String(me.id)) { go('wishes'); return }
    setPage('families'); setSelectedFamily(null); setSelectedPerson(person); setPersonWishes([]); setPersonGifts([]); setError(''); setNotice('')
  }
  const logout = async () => { const ok = await perform(() => api('/auth/logout', { method: 'POST' }), t('Déconnexion réussie.')); if (ok) onLogout() }
  const setPersonFilter = (key: keyof WishFilters, value: string) => {
    if (!selectedPerson) return
    setPersonFilterState({ ...personFilters, personId: String(selectedPerson.id), [key]: value })
  }

  return <div className="min-h-screen bg-surface lg:flex">
    {mobileNav && <button className="fixed inset-0 z-30 bg-ink-900/40 lg:hidden" aria-label={t('Fermer le menu')} onClick={() => setMobileNav(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-line bg-white px-4 py-7 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}>
      <button className="mb-11 flex items-center gap-2.5 px-3 text-left" onClick={() => go('dashboard')} aria-label={t('Pensa, accueil')}><span className="flex size-10 items-center justify-center rounded-2xl bg-brand-600 text-white"><Icon name="gift" size={23}/></span><span className="font-['Outfit'] text-[27px] font-extrabold tracking-[-.06em] text-ink-900">pensa<span className="text-brand-400">.</span></span></button>
      <span className="eyebrow mb-3 px-3">{t('Menu principal')}</span>
      <nav aria-label={t('Navigation principale')} className="space-y-1">
        {nav.map(item => <button key={item.page} onClick={() => go(item.page)} aria-current={page === item.page ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${page === item.page ? 'bg-brand-50 text-brand-600' : 'text-ink-500 hover:bg-brand-50 hover:text-brand-600'}`}><Icon name={item.icon} size={19}/>{t(item.label)}</button>)}
      </nav>
      <div className="mt-auto px-2">
        <div className="mb-5 rounded-2xl bg-brand-50 p-4"><Icon name="spark" size={20} className="mb-2 text-brand-500"/><p className="font-['Outfit'] text-sm font-bold">{t('Rien à retenir')}</p><p className="mt-1 text-xs leading-relaxed text-ink-500">{t('Pensa suit les dates, les listes et les cadeaux à votre place.')}</p></div>
        <p className="mb-2 px-1 text-xs leading-relaxed text-ink-500">{t('Application entièrement générée par IA. Code ouvert sous licence MIT.')}</p>
      </div>
    </aside>
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex h-[74px] items-center justify-between border-b border-line bg-white/95 px-5 backdrop-blur md:px-9">
        <div className="flex items-center gap-3"><button className="icon-button lg:hidden" aria-label={t('Ouvrir le menu')} onClick={() => setMobileNav(true)}><Icon name="menu"/></button><p className="font-['Outfit'] text-lg font-semibold">{selectedPerson ? nameOf(selectedPerson) : selectedFamily ? selectedFamily.name : t(titleByPage[page])}</p></div>
        <div className="flex items-center gap-3"><button className="icon-button" aria-label={t('Rechercher')} onClick={() => go('search')}><Icon name="search"/></button><span className="hidden h-7 w-px bg-line sm:block"/><ProfileMenu me={me} busy={busy} onProfile={() => go('profile')} onLogout={() => void logout()}/></div>
      </header>
      <main className="mx-auto max-w-[1300px] px-5 pb-16 pt-8 md:px-9 md:pt-10">
        {error && <div role="alert" className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{localizeMessage(error, locale)}<button aria-label={t('Masquer l’erreur')} onClick={() => setError('')}><Icon name="close" size={16}/></button></div>}
        {notice && <div role="status" className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{localizeMessage(notice, locale)}<button aria-label={t('Masquer la notification')} onClick={() => setNotice('')}><Icon name="close" size={16}/></button></div>}
        {loading && <p role="status" className="muted mb-3">{t('Actualisation des données…')}</p>}
        {page === 'dashboard' && <><div className="relative mb-8 overflow-hidden rounded-[26px] bg-brand-100 px-7 py-9 sm:px-10 sm:py-11"><div className="relative z-10 max-w-[580px]"><p className="eyebrow mb-3">{t('VOTRE ORGANISATION DU JOUR')}</p><h1 className="font-['Outfit'] text-3xl font-bold leading-tight tracking-tight text-ink-900 sm:text-[42px]">{t('Bonjour {name}', { name: me.firstName || t('vous') })} <span aria-hidden="true">👋</span></h1><p className="mt-3 max-w-md text-sm leading-relaxed text-ink-500 sm:text-base">{t('Voici ce qui arrive et ce qu’il reste à faire. Le reste vous attend ici, vous n’avez rien à retenir.')}</p><button className="primary mt-6" onClick={() => openWish()}><Icon name="plus" size={18}/> {t('Ajouter une envie')}</button></div><div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-20 size-72 rounded-full border-[38px] border-white/20 sm:right-0"/><div aria-hidden="true" className="pointer-events-none absolute -bottom-36 right-20 size-72 rounded-full bg-white/25"/></div>
          <div className="mb-9 grid gap-4 sm:grid-cols-3">{[
            { label: t('Mes envies'), count: myWishes.length, icon: 'heart' as IconName, color: 'bg-brand-50 text-brand-500', target: 'wishes' as Page },
            { label: t('Mes familles'), count: families.length, icon: 'users' as IconName, color: 'bg-clay-50 text-clay-500', target: 'families' as Page },
            { label: t('Réservations'), count: reservations.length, icon: 'gift' as IconName, color: 'bg-sage-50 text-sage-600', target: 'reservations' as Page },
          ].map(stat => <button key={stat.target} onClick={() => go(stat.target)} className="card flex items-center gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md"><span className={`rounded-2xl p-3 ${stat.color}`}><Icon name={stat.icon} size={23}/></span><span><strong className="block font-['Outfit'] text-2xl">{stat.count}</strong><span className="muted">{stat.label}</span></span><Icon name="chevron" size={17} className="ml-auto text-ink-400"/></button>)}</div>
          <Guidance me={me} onboarding={onboarding} todos={dashboardTodos} busy={busy} onAddWish={() => openWish()} onGo={go} onPerson={openPerson} onReservation={openReservation} onStatus={changeStatus}/>
          {managedMembers.length > 0 && <div className="mb-9"><SectionTitle icon="heart" tone="sage" kicker={t('LES LISTES QUE JE TIENS')} title={t('Les listes gérées par mon foyer')}/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{managedMembers.map(member => <button key={member.id} onClick={() => openPerson(member)} className="card flex items-center gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"><Avatar person={member}/><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{nameOf(member)}</span><span className="muted">{t('Voir et compléter sa liste')}</span></span><Icon name="chevron" size={17} className="shrink-0 text-ink-400"/></button>)}</div></div>}
          {dashboardOpenGifts.length > 0 && <div className="mb-9"><SectionTitle icon="spark" tone="clay" kicker={t('HORS LISTE')} title={t('Cadeaux ouverts aux participations')}/><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{dashboardOpenGifts.map(gift => <OffListGiftCard key={gift.id} gift={gift} me={me} busy={busy} showRecipient onRequest={() => void requestGift(gift)} onOpen={() => openReservation(gift.id)} onRecipient={gift.recipient ? () => openPerson(gift.recipient!) : undefined}/>)}</div></div>}
          <div className="mb-9 grid gap-5 lg:grid-cols-2">
            <div><SectionTitle icon="calendar" kicker={t('À VENIR')} title={t('Les prochaines occasions')}/>{dashboardOccasions.length ? <div className="card divide-y divide-line-soft">{dashboardOccasions.slice(0, 4).map(occasion => {
              const label = occasionLabel(occasion.name, locale, { kind: occasion.kind, year: occasion.nextDate ? Number(occasion.nextDate.slice(0, 4)) : null, birthDate: occasion.person?.birthDate })
              const entry = <><span className="rounded-xl bg-brand-50 p-2 text-brand-600"><Icon name="calendar" size={19}/></span><div className="min-w-0 flex-1 text-left"><p className="truncate font-semibold">{label} · {nameOf(occasion.person)}</p><p className="muted">{dateOf(occasion.nextDate)}</p></div></>
              const person = occasion.person
              return person
                ? <button key={`${occasion.id}-${person.id}`} type="button" className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-brand-50" onClick={() => openPerson(person)} aria-label={t('Voir les envies de {name}', { name: nameOf(person) })}>{entry}<Icon name="chevron" size={17} className="shrink-0 text-ink-400"/></button>
                : <div key={occasion.id} className="flex items-center gap-3 p-4">{entry}</div>
            })}</div> : <Empty icon="calendar" title={t('Aucune date à venir')} text={t('Les occasions de vos proches apparaîtront ici.')}/>}</div>
            <div><SectionTitle icon="gift" kicker={t('EN PRÉPARATION')} title={t('Les cadeaux partagés')}/>{dashboardReservations.length || dashboardParticipating.length ? <div className="card p-6"><p className="text-lg font-semibold">{t(dashboardReservations.length === 1 ? '{count} réservation organisée' : '{count} réservations organisées', { count: dashboardReservations.length })}</p><p className="muted mt-2">{t(dashboardParticipating.length === 1 ? '{count} cadeau auquel vous participez' : '{count} cadeaux auxquels vous participez', { count: dashboardParticipating.length })}</p><button className="secondary mt-5" onClick={() => go('reservations')}>{t('Voir les réservations')} <Icon name="arrow" size={16}/></button></div> : <Empty icon="gift" title={t('Encore rien à préparer')} text={t('Réservez une envie pour organiser un cadeau.')}/>}</div>
          </div>
          <SectionTitle icon="heart" kicker={t('POUR VOUS')} title={t('Les envies de vos proches')} action={<button className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline" onClick={() => go('families')}>{t('Voir la famille')} <Icon name="arrow" size={15}/></button>}/>
          {sharedWishes.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{sharedWishes.slice(0, 4).map(wish => <WishCard key={wish.id} wish={wish} mine={false} onReserve={() => openReserve(wish)}/>)}</div> : <Empty icon="users" title={t('Aucune envie partagée pour l’instant')} text={t('Les envies de vos proches apparaîtront ici dès qu’ils les partageront.')} action={<button className="secondary" onClick={() => go('families')}>{t('Voir ma famille')}</button>}/>}
        </>}
        {page === 'wishes' && <><ManagedListsBar me={me} managed={managedMembers} activeId={null} onSelf={() => go('wishes')} onPerson={openPerson}/><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow mb-2">{t('VOTRE LISTE PERSONNELLE')}</p><h1 className="font-['Outfit'] text-3xl font-bold">{t('Mes envies')} <span className="text-brand-500">({myWishes.length})</span></h1><p className="muted mt-2">{t('Notez vos idées une fois : vos proches sauront quoi offrir.')}</p></div><button className="primary" onClick={() => openWish()}><Icon name="plus" size={18}/> {t('Ajouter une envie')}</button></div>{myWishes.length ? <><p className="muted mb-4">{t('Glissez les envies ou utilisez les flèches pour changer leur priorité.')}</p><div className="space-y-3">{myWishes.map((wish, index) => <div key={wish.id} draggable onDragStart={event => event.dataTransfer.setData('text/plain', String(index))} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const from = Number(event.dataTransfer.getData('text/plain')); if (Number.isInteger(from)) void reorder(from, index) }} className="card flex items-center gap-3 p-3 sm:gap-5 sm:p-4"><span className="hidden cursor-grab text-ink-400 sm:block"><Icon name="grip"/></span><div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-soft sm:size-20">{wish.image ? <img src={wish.image} alt="" className="h-full w-full object-cover"/> : <Icon name="gift" className="text-brand-300"/>}</div><div className="min-w-0 flex-1"><h2 className="truncate font-['Outfit'] font-semibold">{wish.title}</h2><p className="muted mt-1 truncate">{wish.description || wish.url || t('Sans description')}</p><div className="mt-1 flex flex-wrap gap-1">{wish.tags?.map(tag => <span className="chip" key={tag}>#{tag}</span>)}</div></div><strong className="hidden text-sm text-brand-600 sm:block">{money(wish.price)}</strong><div className="flex shrink-0 flex-col items-center gap-1 sm:flex-row"><button className="icon-button !size-7" disabled={index === 0 || busy} onClick={() => reorder(index, index - 1)} aria-label={t('Monter {title}', { title: wish.title })}><Icon name="arrowUp" size={16}/></button><button className="icon-button !size-7" disabled={index === myWishes.length - 1 || busy} onClick={() => reorder(index, index + 1)} aria-label={t('Descendre {title}', { title: wish.title })}><Icon name="arrowDown" size={16}/></button><button className="icon-button" onClick={() => { setSelectedWish(wish); setModal('tags') }} aria-label={t('Modifier les tags de {title}', { title: wish.title })}><Icon name="edit" size={17}/></button><button className="icon-button hover:!text-red-600" onClick={() => removeWish(wish)} aria-label={t('Supprimer {title}', { title: wish.title })}><Icon name="trash" size={17}/></button></div></div>)}</div></> : <Empty icon="heart" title={t('Votre liste est encore vide')} text={t('Collez le lien d’un produit et nous vous aiderons à l’ajouter.')} action={<button className="primary" onClick={() => openWish()}><Icon name="plus" size={18}/> {t('Ajouter une envie')}</button>}/>}</>}
        {page === 'families' && <><SectionTitle icon="users" kicker={t('VOS PROCHES')} title={selectedPerson ? t('Les envies de {name}', { name: nameOf(selectedPerson) }) : selectedFamily ? selectedFamily.name : t('Ma famille')} action={selectedPerson || selectedFamily ? <button className="secondary" onClick={() => { setSelectedPerson(null); setSelectedFamily(null) }}><Icon name="arrowLeft" size={16}/> {t('Retour aux familles')}</button> : undefined}/>
          {selectedPerson ? <>
            {curating && <ManagedListsBar me={me} managed={managedMembers} activeId={selectedPerson.id} onSelf={() => go('wishes')} onPerson={openPerson}/>}
            {curating && <div className="card mb-6 flex flex-wrap items-center justify-between gap-3 border-sage-200 bg-sage-50 p-4"><div><p className="eyebrow">{t('LISTE GÉRÉE PAR VOTRE FOYER')}</p><p className="muted mt-1">{t('{name} n’a pas de compte : vous tenez sa liste à sa place.', { name: nameOf(selectedPerson) })}</p></div><button className="primary" onClick={() => openWish(selectedPerson)}><Icon name="plus" size={17}/> {t('Ajouter une envie')}</button></div>}
            <div className="card mb-6 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div><label className="label" htmlFor="filter-tag">{t('Tag')}</label><input className="field" id="filter-tag" value={personFilters.tag} onChange={event => setPersonFilter('tag', event.target.value)} placeholder={t('Ex. : livres')}/></div>
              {String(selectedPerson.id) !== String(me.id) && <div><label className="label" htmlFor="filter-availability">{t('Disponibilité')}</label><select className="field" id="filter-availability" value={personFilters.availability} onChange={event => setPersonFilter('availability', event.target.value)}><option value="">{t('Toutes')}</option><option value="available">{t('Disponibles')}</option><option value="reserved">{t('Réservées')}</option></select></div>}
              <div><label className="label" htmlFor="filter-min-price">{t('Prix minimum (€)')}</label><input className="field" id="filter-min-price" type="number" min="0" step="0.01" value={personFilters.minPrice} onChange={event => setPersonFilter('minPrice', event.target.value)} placeholder="0"/></div>
              <div><label className="label" htmlFor="filter-max-price">{t('Prix maximum (€)')}</label><input className="field" id="filter-max-price" type="number" min="0" step="0.01" value={personFilters.maxPrice} onChange={event => setPersonFilter('maxPrice', event.target.value)} placeholder={t('Sans limite')}/></div>
            </div>
            {personWishes.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{personWishes.map(wish => <WishCard key={wish.id} wish={wish} mine={String(wish.ownerId) === String(me.id)} curated={curating} onReserve={() => openReserve(wish)} onTags={() => { setSelectedWish(wish); setModal('tags') }} onDelete={() => removeWish(wish)}/>)}</div> : <Empty icon="heart" title={t('Aucune envie trouvée')} text={curating ? t('Ajoutez ses idées de cadeaux pour que vos proches sachent quoi offrir.') : t('Modifiez les filtres pour découvrir d’autres envies.')} action={curating ? <button className="primary" onClick={() => openWish(selectedPerson)}><Icon name="plus" size={18}/> {t('Ajouter une envie')}</button> : undefined}/>}
            {String(selectedPerson.id) !== String(me.id) && <div className="mt-9"><SectionTitle icon="spark" tone="clay" kicker={t('SANS PASSER PAR LA LISTE')} title={t('Cadeaux prévus hors liste')} action={<button className="secondary" onClick={() => openOffList(selectedPerson)}><Icon name="plus" size={17}/> {t('Prévoir un cadeau hors liste')}</button>}/>{personGifts.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{personGifts.map(gift => <OffListGiftCard key={gift.id} gift={gift} me={me} busy={busy} onRequest={() => void requestGift(gift)} onOpen={() => openReservation(gift.id)}/>)}</div> : <p className="muted rounded-xl bg-brand-50 p-4">{t('Aucun cadeau hors liste partagé pour {name}. Une idée qui n’est pas sur sa liste ? Prévoyez-la ici, sans qu’il ou elle ne le voie.', { name: nameOf(selectedPerson) })}</p>}</div>}
          </>
            : activeFamily ? <><div className="card mb-6 flex flex-wrap items-center justify-between gap-3 p-5"><div><p className="eyebrow">{t('LES MEMBRES')}</p><p className="muted mt-1">{t('Découvrez les envies des membres de cette famille.')}</p></div>{activeFamily.admin && <button className="secondary" onClick={() => openOccasion(activeFamily)}><Icon name="calendar" size={18}/> {t('Ajouter une occasion')}</button>}</div>{activeFamily.households?.length ? <FamilyHouseholds family={activeFamily} me={me} onPerson={openPerson}/> : activeFamily.members?.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{activeFamily.members.map(person => <button key={person.id} onClick={() => openPerson(person)} className="card flex items-center gap-4 p-5 text-left hover:border-brand-200"><Avatar person={person}/><span className="flex-1 font-semibold">{nameOf(person)}</span><Icon name="chevron" size={17}/></button>)}</div> : <Empty icon="users" title={t('Aucun membre affiché')} text={t('Les membres de cette famille apparaîtront ici dès qu’ils seront disponibles.')}/ >}{activeFamily.admin && <FamilyManagement key={activeFamily.id} family={activeFamily} busy={busy} perform={perform} handleError={handleError} onRename={name => setSelectedFamily({ ...activeFamily, name })}/>}</>
            : <>
              {myHousehold && <HouseholdPanel household={myHousehold} me={me} isAdmin={isHouseholdAdmin} busy={busy} perform={perform} handleError={handleError} onPerson={openPerson}/>}
              <div className="mt-9"><SectionTitle icon="home" kicker={t('LES FAMILLES DE MON FOYER')} title={t('Mes familles')} action={isHouseholdAdmin ? <button className="primary" onClick={() => setModal('family')}><Icon name="plus" size={18}/> {t('Créer une famille')}</button> : undefined}/>
              {families.length ? <div className="grid gap-5 lg:grid-cols-2">{families.map(family => <article className="card flex flex-col p-6" key={family.id}><div className="flex items-start gap-4"><div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><Icon name="users" size={25}/></div><div className="min-w-0 flex-1"><h3 className="font-['Outfit'] text-xl font-semibold">{family.name}</h3><p className="muted mt-1">{family.admin ? t('Famille administrée') : t('Famille partagée')}</p></div></div>{!!family.households?.length && <ul className="mt-5 space-y-3">{family.households.map(household => <li key={household.id} className="rounded-xl bg-brand-50 p-3"><p className="text-sm font-semibold text-ink-700">{household.name}</p><ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">{household.members?.map(member => <li key={member.id} className="flex flex-wrap items-center gap-1.5 text-sm"><span>{nameOf(member)}</span><RoleBadges person={member}/></li>)}</ul></li>)}</ul>}<div className="mt-5 flex gap-2"><button className="secondary flex-1 !px-2" onClick={() => { setSelectedFamily(family); setSelectedPerson(null) }}>{t('Voir la famille')} <Icon name="arrow" size={16}/></button>{family.admin && <button className="icon-button" onClick={() => openOccasion(family)} aria-label={t('Créer une occasion pour {name}', { name: family.name })}><Icon name="calendar" size={19}/></button>}</div></article>)}</div> : <Empty icon="users" title={isHouseholdAdmin ? t('Créez votre première famille') : t('Votre foyer ne fait partie d’aucune famille')} text={isHouseholdAdmin ? t('Réunissez les foyers avec qui vous organisez les cadeaux.') : t('Un admin de votre foyer peut créer une famille ou en rejoindre une.')} action={isHouseholdAdmin ? <button className="primary" onClick={() => setModal('family')}>{t('Créer une famille')}</button> : undefined}/>}
              {isHouseholdAdmin ? <JoinFamily busy={busy} perform={perform}/> : <p className="muted mt-6 rounded-xl bg-brand-50 p-4">{t('Seul un admin du foyer peut rejoindre ou créer une famille.')}</p>}</div>
              {otherHouseholds.length > 0 && <div className="mt-9"><SectionTitle icon="users" kicker={t('DANS VOS FAMILLES')} title={t('Les autres foyers')}/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{otherHouseholds.map(household => <HouseholdCard key={household.id} household={household} me={me} onPerson={openPerson}/>)}</div></div>}
            </>}
        </>}
        {page === 'reservations' && <><SectionTitle icon="gift" kicker={t('CADEAUX EN PRÉPARATION')} title={t('Mes réservations')} action={<button className="secondary" onClick={() => openOffList()}><Icon name="plus" size={17}/> {t('Prévoir un cadeau hors liste')}</button>}/>{reservations.length ? <div className="space-y-4">{reservations.map(reservation => <ReservationRow key={reservation.id} reservation={reservation} me={me} users={allPeople} busy={busy} perform={perform} onStatus={changeStatus} focused={String(focusedReservation) === String(reservation.id)}/>)}</div> : <Empty icon="gift" title={t('Aucune réservation pour le moment')} text={t('Explorez les listes de vos proches pour leur préparer une surprise.')} action={<button className="primary" onClick={() => go('families')}>{t('Découvrir les envies')} <Icon name="arrow" size={17}/></button>}/>}</>}
        {page === 'history' && <><SectionTitle icon="clock" tone="sage" kicker={t('DÉJÀ OFFERT')} title={t('Historique')}/>{history.length ? <div className="card divide-y divide-line-soft">{history.map((entry, index) => { const item = entry as { id?: Id; snapshot?: { title?: string; recipient?: { birthDate?: string; birth_date?: string }; occasions?: { name: string; kind?: Occasion['kind']; year: number }[] }; created_at?: string }; const birthDate = item.snapshot?.recipient?.birthDate ?? item.snapshot?.recipient?.birth_date; return <div className="flex items-start gap-4 p-5" key={String(item.id ?? index)}><span className="rounded-xl bg-brand-50 p-2.5 text-brand-600"><Icon name="clock" size={19}/></span><div><p className="font-semibold">{item.snapshot?.title || t('Un cadeau offert')}</p><p className="muted mt-1">{item.snapshot?.occasions?.map(occasion => occasionWithYear(occasion, locale, birthDate)).join(', ')} · {dateOf(item.created_at)}</p></div></div> })}</div> : <Empty icon="clock" title={t('Rien d’offert pour l’instant')} text={t('Les cadeaux déjà offerts s’afficheront ici, pour éviter d’offrir deux fois la même chose.')}/>}</>}
        {page === 'search' && <><SectionTitle icon="search" kicker={t('RECHERCHE')} title={t('Rechercher')}/><label htmlFor="global-search" className="label">{t('Personnes et envies')}</label><div className="relative mb-7"><Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-500"/><input id="global-search" autoComplete="off" className="field !py-3 !pl-12" placeholder={t('Rechercher une personne, une envie…')} value={searchText} onChange={event => setSearchText(event.target.value)}/></div>{searchResults.length ? <div className="space-y-3">{searchResults.map((result, index) => { const item = result as Record<string, unknown>; const person = item as Person; const wish = item as Wish; const isWish = typeof item.title === 'string'; return <div key={String(item.id ?? index)} className="card flex items-center gap-4 p-4">{isWish ? <span className="rounded-xl bg-brand-50 p-3 text-brand-600"><Icon name="heart"/></span> : <Avatar person={person}/>}<div className="min-w-0 flex-1"><p className="truncate font-semibold">{isWish ? wish.title : nameOf(person)}</p><p className="muted">{isWish ? money(wish.price) || t('Envie cadeau') : t('Personne')}</p></div><button className="secondary !px-3 !py-2 text-sm" onClick={() => isWish ? String(wish.ownerId) === String(me.id) ? go('wishes') : openReserve(wish) : (setSelectedPerson(person), setPage('families'))}>{t('Voir')} <Icon name="arrow" size={15}/></button></div> })}</div> : <Empty icon="search" title={searchText ? t('Aucun résultat') : t('Que recherchez-vous ?')} text={searchText ? t('Essayez d’autres mots-clés.') : t('Retrouvez une personne ou une idée cadeau en quelques lettres.')}/>}</>}
        {page === 'profile' && <><SectionTitle icon="user" kicker={t('VOTRE ESPACE')} title={t('Mon profil')}/><div className="card max-w-2xl p-6 sm:p-8"><div className="flex items-center gap-4 border-b border-line pb-6"><Avatar person={me} size="lg"/><div><h2 className="font-['Outfit'] text-xl font-semibold">{nameOf(me)}</h2><p className="muted">{t('Votre compte Pensa')}</p></div></div><dl className="space-y-5 py-6"><div><dt className="eyebrow mb-1">{t('ADRESSE E-MAIL')}</dt><dd>{me.email || t('Non renseignée')}</dd></div><div><dt className="eyebrow mb-1">{t('DATE DE NAISSANCE')}</dt><dd>{dateOf(me.birthDate) || t('Non renseignée')}</dd></div></dl><ProfileForm me={me} busy={busy} perform={perform} onSaved={onProfile}/></div></>}
      </main>
    </div>
    {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setModal(null) }}><div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[24px] bg-white p-6 shadow-2xl sm:p-8"><div className="mb-6 flex items-start justify-between gap-3"><div><p className="eyebrow mb-1">{t('PENSA')}</p><h2 id="modal-title" className="font-['Outfit'] text-2xl font-bold">{t(modal === 'wish' ? 'Ajouter une envie' : modal === 'family' ? 'Créer une famille' : modal === 'occasion' ? 'Nouvelle occasion' : modal === 'tags' ? 'Modifier les tags' : modal === 'offList' ? 'Prévoir un cadeau hors liste' : 'Réserver une envie')}</h2></div><button className="icon-button" onClick={() => setModal(null)} aria-label={t('Fermer')}><Icon name="close"/></button></div>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {modal === 'wish' && <WishForm owner={wishOwner} busy={busy} perform={perform} handleError={handleError}/>}
      {modal === 'family' && <form onSubmit={event => { event.preventDefault(); const name = String(new FormData(event.currentTarget).get('name')).trim(); if (name) void perform(() => api('/families', json('POST', { name })), t('Famille créée.')) }}><label className="label" htmlFor="family-name">{t('Nom de la famille')}</label><input className="field" id="family-name" name="name" placeholder={t('Ex. : La famille Martin')} required/><button disabled={busy} className="primary mt-5 w-full">{t('Créer la famille')}</button></form>}
      {modal === 'occasion' && selectedFamily && <OccasionForm family={selectedFamily} busy={busy} perform={perform}/>}
      {modal === 'tags' && selectedWish && <form onSubmit={event => { event.preventDefault(); const tags = String(new FormData(event.currentTarget).get('tags')).split(',').map(tag => tag.trim()).filter(Boolean); void perform(() => api(`/wishes/${selectedWish.id}`, json('PATCH', { tags })), t('Tags mis à jour.')) }}><label htmlFor="wish-tags" className="label">{t('Tags séparés par des virgules')}</label><input id="wish-tags" name="tags" className="field" defaultValue={selectedWish.tags?.join(', ')} placeholder={t('livre, déco, anniversaire')}/><button disabled={busy} className="primary mt-5 w-full">{t('Enregistrer les tags')}</button></form>}
      {modal === 'reservation' && selectedWish && <ReservationForm wish={selectedWish} reservations={reservations} occasions={occasions} people={allPeople} me={me} busy={busy} perform={perform}/>}
      {modal === 'offList' && <OffListForm recipient={offListRecipient} people={allPeople} me={me} busy={busy} perform={perform}/>}
    </div></div>}
  </div>
}

function Auth({ mode, setMode, onAuth, error, setError }: { mode: 'login' | 'register'; setMode: (mode: 'login' | 'register') => void; onAuth: (person: Person) => void; error: string; setError: (message: string) => void }) {
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
            <div><label className="label" htmlFor="firstName">{t('Prénom')}</label><input className="field" id="firstName" name="firstName" autoComplete="given-name" required/></div>
            <div><label className="label" htmlFor="lastName">{t('Nom')}</label><input className="field" id="lastName" name="lastName" autoComplete="family-name" required/></div>
          </div>
          <div><label className="label" htmlFor="birthDate">{t('Date de naissance')}</label><input className="field" id="birthDate" name="birthDate" type="date" required/></div>
        </>}
        {claiming && <div><label className="label" htmlFor="claim">{t('Code de rattachement')}</label><input className="field" id="claim" name="claim" type="text" autoComplete="off" placeholder={t('Le code remis par votre foyer')} required/><p className="muted mt-1.5">{t('Ce code vous a été donné par un admin de votre foyer.')}</p></div>}
        <div><label className="label" htmlFor="email">{t('Adresse e-mail')}</label><input className="field" id="email" name="email" type="email" autoComplete="email" placeholder={t('vous@exemple.fr')} required/></div>
        <div><label className="label" htmlFor="password">{t('Mot de passe')}</label><input className="field" id="password" name="password" type="password" autoComplete={mode === 'login' && !claiming ? 'current-password' : 'new-password'} minLength={mode === 'register' || claiming ? 12 : undefined} required/></div>
        {mode === 'register' && !claiming && <div><label className="label" htmlFor="invitation">{t('Code d’invitation')} <span className="font-normal">{openRegistration ? t('(facultatif)') : t('(requis)')}</span></label><input className="field" id="invitation" name="invitation" type="text" autoComplete="off" placeholder={t('Votre code d’invitation')} required={!openRegistration}/><p className="muted mt-1.5">{openRegistration ? t('Un proche vous a invité dans son foyer ou dans sa famille ? Saisissez son code ici.') : t('Cet espace est sur invitation. Demandez son code à la personne qui vous a invité, dans son foyer ou dans sa famille.')}</p></div>}
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

function WishForm({ owner, busy, perform, handleError }: { owner?: Person | null; busy: boolean; perform: (action: () => Promise<unknown>, success: string) => Promise<boolean>; handleError: (error: unknown) => void }) {
  const { locale, t } = useTranslation()
  const [url, setUrl] = useState('')
  const [preview, setPreview] = useState<Partial<Wish> | null>(null)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const reportError = useRef(handleError)
  useEffect(() => { reportError.current = handleError })
  // Pasting a link should be enough, like in a messaging app: we look the page up on our own,
  // after a short pause so an address typed by hand is not queried at every keystroke.
  useEffect(() => {
    const candidate = url.trim()
    if (!/^https?:\/\/[^\s/]+\.[^\s/]{2,}/i.test(candidate)) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      void (async () => {
        try {
          const found = await api<Partial<Wish> & { notice?: string }>('/wishes/preview', { ...json('POST', { url: candidate }), signal: controller.signal })
          if (controller.signal.aborted) return
          setNotice(found.notice || '')
          setPreview(found)
        } catch (problem) {
          if (controller.signal.aborted) return
          if (problem instanceof ApiError && problem.status === 400) setNotice(problem.message)
          else reportError.current(problem)
        } finally { if (!controller.signal.aborted) setLoading(false) }
      })()
    }, 600)
    return () => { clearTimeout(timer); controller.abort() }
  }, [url])
  return <form onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); void perform(() => api(owner ? `/users/${owner.id}/wishes` : '/wishes', json('POST', { url, title: data.get('title'), image: data.get('image') || '', description: data.get('description') || undefined, price: data.get('price') ? Number(data.get('price')) : undefined, tags: String(data.get('tags') || '').split(',').map(tag => tag.trim()).filter(Boolean) })), owner ? t('Envie ajoutée à la liste de {name}.', { name: nameOf(owner) }) : t('Envie ajoutée à votre liste.')) }}>
    <label className="label" htmlFor="product-url">{t('Lien du produit')}</label><input className="field" id="product-url" type="url" placeholder="https://example.com/product" value={url} onChange={event => { setUrl(event.target.value); setPreview(null); setNotice(''); setLoading(false) }} required/><p className="muted mt-1.5">{loading ? t('Lecture du lien…') : t('Collez un lien : les informations se remplissent toutes seules.')}</p>
    {notice && <p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><span className="font-semibold">{localizeMessage(notice, locale)}.</span> {preview ? t('Nous avons repris le nom depuis le lien : vérifiez-le et complétez si besoin.') : t('Vous pouvez remplir les champs à la main : seul le nom est nécessaire.')}</p>}
    {preview && <div className="mt-4 flex items-center gap-3 rounded-xl bg-brand-50 p-3">{preview.image && <img src={preview.image} alt="" className="size-14 rounded-lg object-cover"/>}<span className="text-sm font-semibold">{preview.title || t('Produit trouvé')}</span></div>}
    <div className="mt-5 space-y-4" key={preview?.url || preview?.title || 'empty'}><div><label className="label" htmlFor="product-title">{t('Nom de l’envie')}</label><input className="field" id="product-title" name="title" defaultValue={preview?.title || ''} required/></div><div><label className="label" htmlFor="product-image">{t('URL de l’image')} <span className="font-normal">{t('(facultatif)')}</span></label><input className="field" id="product-image" name="image" type="url" defaultValue={preview?.image || ''} placeholder="https://…"/></div><div><label className="label" htmlFor="product-description">{t('Description')} <span className="font-normal">{t('(facultatif)')}</span></label><textarea className="field min-h-20" id="product-description" name="description" defaultValue={preview?.description || ''}/></div><div className="grid grid-cols-2 gap-3"><div><label className="label" htmlFor="product-price">{t('Prix (€)')}</label><input className="field" id="product-price" name="price" type="number" min="0" step="0.01" defaultValue={preview?.price ?? ''}/></div><div><label className="label" htmlFor="product-tags">{t('Tags')}</label><input className="field" id="product-tags" name="tags" defaultValue={preview?.tags?.join(', ') || ''} placeholder={t('livre, déco')}/></div></div></div><button disabled={busy} className="primary mt-6 w-full"><Icon name="plus" size={17}/> {owner ? t('Ajouter à sa liste') : t('Ajouter à ma liste')}</button>
  </form>
}

function OccasionForm({ family, busy, perform }: { family: Family; busy: boolean; perform: (action: () => Promise<unknown>, success: string) => Promise<boolean> }) {
  const { t } = useTranslation()
  const [kind, setKind] = useState<Occasion['kind']>('fixed')
  return <form onSubmit={event => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const body = { name: String(data.get('name')).trim(), kind, ...(kind === 'fixed' ? { month: Number(data.get('month')), day: Number(data.get('day')) } : {}) }
    void perform(() => api(`/families/${family.id}/occasions`, json('POST', body)), t('Occasion créée.'))
  }}>
    <label className="label" htmlFor="occasion-name">{t('Nom de l’occasion')}</label>
    <input className="field mb-4" id="occasion-name" name="name" placeholder={t('Ex. : Noël')} required/>
    <label className="label" htmlFor="occasion-kind">{t('Type d’occasion')}</label>
    <select className="field mb-4" id="occasion-kind" value={kind} onChange={event => setKind(event.target.value as Occasion['kind'])}>
      <option value="fixed">{t('Date fixe')}</option><option value="birthday">{t('Anniversaire (date de naissance)')}</option><option value="name_day">{t('Fête du prénom')}</option>
    </select>
    {kind === 'fixed' && <div className="grid grid-cols-2 gap-3"><div><label className="label" htmlFor="occasion-day">{t('Jour')}</label><input className="field" id="occasion-day" name="day" type="number" min="1" max="31" required/></div><div><label className="label" htmlFor="occasion-month">{t('Mois')}</label><input className="field" id="occasion-month" name="month" type="number" min="1" max="12" required/></div></div>}
    {kind !== 'fixed' && <p className="muted">{t('La date est calculée à partir du profil de la personne lorsqu’elle est disponible.')}</p>}
    <button disabled={busy} className="primary mt-5 w-full">{t('Créer l’occasion')}</button>
  </form>
}

function JoinFamily({ busy, perform }: { busy: boolean; perform: (action: () => Promise<unknown>, success: string, close?: boolean) => Promise<boolean> }) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  return <section className="card mt-8 p-5 sm:p-6">
    <h3 className="font-['Outfit'] text-xl font-semibold">{t('Rejoindre une famille')}</h3>
    <p className="muted mt-2">{t('Saisissez le code d’invitation à la famille reçu de son administrateur pour y rattacher votre foyer.')}</p>
    <form className="mt-4 flex flex-wrap gap-2" onSubmit={event => {
      event.preventDefault()
      void perform(() => api<{ familyId: Id; householdId: Id }>('/families/join', json('POST', { code: code.trim() })), t('Votre foyer a rejoint la famille.'), false).then(ok => { if (ok) setCode('') })
    }}>
      <label className="sr-only" htmlFor="join-family-code">{t('Code d’invitation à la famille')}</label>
      <input className="field min-w-0 flex-1" id="join-family-code" value={code} onChange={event => setCode(event.target.value)} placeholder={t('Code d’invitation à la famille')} required/>
      <button className="secondary" disabled={busy || !code.trim()}>{t('Rejoindre la famille')}</button>
    </form>
  </section>
}

function FamilyManagement({ family, busy, perform, handleError, onRename }: {
  family: Family; busy: boolean;
  perform: (action: () => Promise<unknown>, success: string, close?: boolean) => Promise<boolean>;
  handleError: (error: unknown) => void; onRename: (name: string) => void
}) {
  const { t } = useTranslation()
  const [familyCode, setFamilyCode] = useState('')
  const [generatingFamily, setGeneratingFamily] = useState(false)
  async function inviteFamily() {
    setGeneratingFamily(true); setFamilyCode('')
    try {
      const result = await api<{ code: string }>(`/families/${family.id}/invitations`, json('POST', {}))
      setFamilyCode(result.code)
    } catch (problem) { handleError(problem) }
    finally { setGeneratingFamily(false) }
  }
  return <section className="card mt-8 p-5 sm:p-6" aria-label={t('Administration de {name}', { name: family.name })}>
    <h3 className="font-['Outfit'] text-xl font-semibold">{t('Gérer la famille')}</h3>
    <div className="mt-5 grid gap-6 lg:grid-cols-2">
      <div>
        <p className="label">{t('Inviter un foyer dans cette famille')}</p>
        <p className="muted mb-3">{t('Communiquez ce code à l’administrateur du foyer pour qu’il rejoigne la famille.')}</p>
        <button type="button" disabled={generatingFamily} className="secondary" onClick={() => void inviteFamily()}>{generatingFamily ? t('Création…') : t('Créer un code d’invitation à la famille')}</button>
        {familyCode && <div role="status" className="mt-3 rounded-xl bg-brand-50 p-3"><p className="mb-1 text-sm font-semibold">{t('Code d’invitation à la famille (visible uniquement maintenant)')}</p><output className="block break-all font-mono text-sm text-brand-700">{familyCode}</output></div>}
      </div>
      <form onSubmit={event => {
        event.preventDefault()
        const name = String(new FormData(event.currentTarget).get('name')).trim()
        void perform(() => api(`/families/${family.id}`, json('PATCH', { name })), t('Famille renommée.'), false).then(ok => { if (ok) onRename(name) })
      }}>
        <label className="label" htmlFor="rename-family">{t('Renommer la famille')}</label>
        <div className="flex flex-wrap gap-2"><input key={family.name} className="field min-w-0 flex-1" id="rename-family" name="name" defaultValue={family.name} required/><button disabled={busy} className="secondary">{t('Renommer')}</button></div>
      </form>
    </div>
  </section>
}

function RoleBadges({ person }: { person: Person }) {
  const { t } = useTranslation()
  return <>
    {person.householdAdmin && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">{t('Admin du foyer')}</span>}
    {person.familyAdmin && <span className="rounded-full bg-clay-50 px-2 py-0.5 text-[11px] font-bold text-clay-600">{t('Admin de la famille')}</span>}
    {person.managed && <span className="rounded-full bg-sage-50 px-2 py-0.5 text-[11px] font-bold text-sage-700">{t('Géré par le foyer')}</span>}
  </>
}

function PersonRow({ person, me, onPerson, children }: { person: Person; me: Person; onPerson: (person: Person) => void; children?: ReactNode }) {
  const { t } = useTranslation()
  const self = String(person.id) === String(me.id)
  return <li className="flex flex-wrap items-center gap-3 py-3">
    <button className="flex min-w-0 flex-1 items-center gap-3 text-left hover:text-brand-700" onClick={() => onPerson(person)} aria-label={self ? t('Voir mes envies') : t('Voir les envies de {name}', { name: nameOf(person) })}>
      <Avatar person={person} size="sm"/>
      <span className="min-w-0"><span className="block truncate font-semibold">{nameOf(person)}{self && <span className="muted font-normal"> {t('(vous)')}</span>}</span><span className="mt-1 flex flex-wrap gap-1"><RoleBadges person={person}/></span></span>
    </button>
    {children}
  </li>
}

function FamilyHouseholds({ family, me, onPerson }: { family: Family; me: Person; onPerson: (person: Person) => void }) {
  return <div className="grid gap-4 lg:grid-cols-2">{family.households?.map(household => <HouseholdCard key={household.id} household={household} me={me} onPerson={onPerson}/>)}</div>
}

function HouseholdCard({ household, me, onPerson }: { household: Household; me: Person; onPerson: (person: Person) => void }) {
  const { t } = useTranslation()
  return <article className="card p-5">
    <div className="flex items-center gap-3"><span className="rounded-xl bg-brand-50 p-2 text-brand-600"><Icon name="home" size={19}/></span><h3 className="font-['Outfit'] text-lg font-semibold">{household.name}</h3></div>
    {household.members?.length ? <ul className="mt-2 divide-y divide-line-soft">{household.members.map(member => <PersonRow key={member.id} person={member} me={me} onPerson={onPerson}/>)}</ul> : <p className="muted mt-3">{t('Aucun membre affiché')}</p>}
  </article>
}

function ManagedMemberActions({ household, member, busy, perform, handleError }: {
  household: Household; member: Person; busy: boolean;
  perform: (action: () => Promise<unknown>, success: string, close?: boolean) => Promise<boolean>; handleError: (error: unknown) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState<'' | 'code' | 'account' | 'edit'>('')
  const [code, setCode] = useState('')
  const path = `/households/${household.id}/members/${member.id}`
  async function claimCode() {
    setOpen('code'); setCode('')
    try { setCode((await api<{ code: string }>(`${path}/invitations`, json('POST', {}))).code) }
    catch (problem) { handleError(problem) }
  }
  return <div className="w-full space-y-3">
    <div className="flex flex-wrap gap-2">
      <button className="secondary !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => setOpen(open === 'edit' ? '' : 'edit')}>{t('Modifier la fiche')}</button>
      <button className="secondary !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => void claimCode()}>{t('Créer un code de rattachement')}</button>
      <button className="secondary !px-3 !py-1.5 text-xs" disabled={busy} onClick={() => setOpen(open === 'account' ? '' : 'account')}>{t('Définir ses identifiants')}</button>
      <button className="secondary !px-3 !py-1.5 text-xs hover:!text-red-600" disabled={busy}
        onClick={() => { if (window.confirm(t('Retirer {name} du foyer ? Sa liste sera supprimée.', { name: nameOf(member) }))) void perform(() => api(path, { method: 'DELETE' }), t('Membre retiré du foyer.'), false) }}>{t('Retirer du foyer')}</button>
    </div>
    {open === 'code' && code && <div role="status" className="rounded-xl bg-brand-50 p-3"><p className="mb-1 text-sm font-semibold">{t('Code de rattachement (visible uniquement maintenant)')}</p><output className="block break-all font-mono text-sm text-brand-700">{code}</output><p className="muted mt-1 text-xs">{t('À saisir sur l’écran de connexion, rubrique « J’ai un code de rattachement ».')}</p></div>}
    {open === 'edit' && <form className="space-y-3 rounded-xl bg-brand-50 p-3" onSubmit={event => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      void perform(async () => {
        await api(path, json('PATCH', {
          firstName: String(data.get('firstName')).trim(), lastName: String(data.get('lastName')).trim(),
          birthDate: String(data.get('birthDate')),
          nameDay: readNameDay(data, t('Choisissez le jour et le mois de sa fête.')),
        }))
        setOpen('')
      }, t('Fiche mise à jour.'), false)
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor={`first-name-${member.id}`}>{t('Prénom')}</label><input className="field" id={`first-name-${member.id}`} name="firstName" defaultValue={member.firstName} required/></div>
        <div><label className="label" htmlFor={`last-name-${member.id}`}>{t('Nom')}</label><input className="field" id={`last-name-${member.id}`} name="lastName" defaultValue={member.lastName} required/></div>
      </div>
      <div><label className="label" htmlFor={`birth-date-${member.id}`}>{t('Date de naissance')}</label><input className="field" id={`birth-date-${member.id}`} name="birthDate" type="date" defaultValue={member.birthDate ?? ''} required/></div>
      <NameDayFields idPrefix={`member-${member.id}`} value={member.nameDay} hint={t('Facultative. Sans elle, l’occasion « Fête » ne sera pas annoncée pour cette personne.')}/>
      <div className="flex gap-2"><button className="primary" disabled={busy}>{t('Enregistrer')}</button><button type="button" className="secondary" onClick={() => setOpen('')}>{t('Annuler')}</button></div>
    </form>}
    {open === 'account' && <form className="flex flex-wrap items-end gap-2 rounded-xl bg-brand-50 p-3" onSubmit={event => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      void perform(() => api(`${path}/account`, json('POST', { email: String(data.get('email')).trim(), password: String(data.get('password')) })), t('Compte créé : cette personne peut se connecter.'), false)
    }}>
      <div className="min-w-0 flex-1"><label className="label" htmlFor={`email-${member.id}`}>{t('Adresse e-mail')}</label><input className="field" id={`email-${member.id}`} name="email" type="email" required/></div>
      <div className="min-w-0 flex-1"><label className="label" htmlFor={`password-${member.id}`}>{t('Mot de passe')}</label><input className="field" id={`password-${member.id}`} name="password" type="password" minLength={12} required/></div>
      <button className="secondary" disabled={busy}>{t('Créer le compte')}</button>
    </form>}
  </div>
}

function HouseholdPanel({ household, me, isAdmin, busy, perform, handleError, onPerson }: {
  household: Household; me: Person; isAdmin: boolean; busy: boolean;
  perform: (action: () => Promise<unknown>, success: string, close?: boolean) => Promise<boolean>;
  handleError: (error: unknown) => void; onPerson: (person: Person) => void
}) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [generating, setGenerating] = useState(false)
  const [adding, setAdding] = useState(false)
  const members = household.members ?? []
  const adminCount = members.filter(member => member.householdAdmin).length
  async function invite() {
    setGenerating(true); setCode('')
    try { setCode((await api<{ code: string }>(`/households/${household.id}/invitations`, json('POST', {}))).code) }
    catch (problem) { handleError(problem) }
    finally { setGenerating(false) }
  }
  const moveOut = (member: Person) => {
    const self = String(member.id) === String(me.id)
    const question = self
      ? t('Créer votre propre foyer et le quitter ? Vous resterez dans les mêmes familles.')
      : t('Donner son propre foyer à {name} ? Ce foyer restera dans les mêmes familles.', { name: nameOf(member) })
    if (window.confirm(question)) void perform(() => api(`/households/${household.id}/members/${member.id}/move-out`, json('POST', {})), t('Nouveau foyer créé.'), false)
  }
  return <section aria-labelledby="my-household-title">
    <div className="mb-5"><p className="eyebrow mb-1">{t('MON FOYER')}</p><h2 id="my-household-title" className="font-['Outfit'] text-2xl font-semibold tracking-tight text-ink-900">{household.name}</h2><p className="muted mt-1">{t('Les personnes qui vivent avec vous. Votre foyer rejoint les familles ensemble.')}</p></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="card p-5 sm:p-6">
        <h3 className="label">{t('Membres du foyer')}</h3>
        <ul className="divide-y divide-line-soft">{members.map(member => {
          const lastAdmin = member.householdAdmin && adminCount <= 1
          const self = String(member.id) === String(me.id)
          return <PersonRow key={member.id} person={member} me={me} onPerson={onPerson}>
            {isAdmin && !member.managed && <button className="secondary !px-3 !py-1.5 text-xs" disabled={busy || lastAdmin} title={lastAdmin ? t('Un foyer doit conserver un administrateur') : undefined}
              onClick={() => void perform(() => api(`/households/${household.id}/members/${member.id}`, json('PATCH', { admin: !member.householdAdmin })), member.householdAdmin ? t('Droits d’admin retirés.') : t('Droits d’admin accordés.'), false)}>
              {member.householdAdmin ? t('Retirer l’admin') : t('Nommer admin')}</button>}
            {!member.managed && (self || isAdmin) && members.length > 1 && <button className="secondary !px-3 !py-1.5 text-xs" disabled={busy || lastAdmin} title={lastAdmin ? t('Un foyer doit conserver un administrateur') : undefined} onClick={() => moveOut(member)}>
              {self ? t('Quitter ce foyer') : t('Lui donner son foyer')}</button>}
            {isAdmin && member.managed && <ManagedMemberActions household={household} member={member} busy={busy} perform={perform} handleError={handleError}/>}
          </PersonRow>
        })}</ul>
        {isAdmin && <div className="mt-4 border-t border-line-soft pt-4">
          {adding ? <form className="space-y-3" onSubmit={event => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            void perform(async () => {
              await api(`/households/${household.id}/members`, json('POST', {
                firstName: String(data.get('firstName')).trim(), lastName: String(data.get('lastName')).trim(),
                birthDate: String(data.get('birthDate')),
                nameDay: readNameDay(data, t('Choisissez le jour et le mois de sa fête.')),
              }))
              setAdding(false)
            }, t('Membre ajouté au foyer.'), false)
          }}>
            <p className="muted">{t('Pour un enfant ou toute personne sans compte : votre foyer tient sa liste à sa place.')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label" htmlFor="member-first-name">{t('Prénom')}</label><input className="field" id="member-first-name" name="firstName" required/></div>
              <div><label className="label" htmlFor="member-last-name">{t('Nom')}</label><input className="field" id="member-last-name" name="lastName" required/></div>
            </div>
            <div><label className="label" htmlFor="member-birth-date">{t('Date de naissance')}</label><input className="field" id="member-birth-date" name="birthDate" type="date" required/></div>
            <NameDayFields idPrefix="member" hint={t('Facultative. Sans elle, l’occasion « Fête » ne sera pas annoncée pour cette personne.')}/>
            <div className="flex gap-2"><button className="primary" disabled={busy}>{t('Ajouter au foyer')}</button><button type="button" className="secondary" onClick={() => setAdding(false)}>{t('Annuler')}</button></div>
          </form> : <button className="secondary" onClick={() => setAdding(true)}><Icon name="plus" size={17}/> {t('Ajouter un membre sans compte')}</button>}
        </div>}
      </div>
      {isAdmin ? <div className="card space-y-6 p-5 sm:p-6">
        <form onSubmit={event => {
          event.preventDefault()
          const name = String(new FormData(event.currentTarget).get('name')).trim()
          if (name) void perform(() => api(`/households/${household.id}`, json('PATCH', { name })), t('Foyer renommé.'), false)
        }}>
          <label className="label" htmlFor="rename-household">{t('Renommer le foyer')}</label>
          <div className="flex flex-wrap gap-2"><input key={household.name} className="field min-w-0 flex-1" id="rename-household" name="name" defaultValue={household.name} required/><button disabled={busy} className="secondary">{t('Renommer')}</button></div>
        </form>
        <div>
          <p className="label">{t('Inviter dans mon foyer')}</p>
          <p className="muted mb-3">{t('Générez un code valable 7 jours, à communiquer à la personne invitée pour son inscription.')}</p>
          <button type="button" disabled={generating} className="secondary" onClick={() => void invite()}>{generating ? t('Création…') : t('Créer un code d’invitation au foyer')}</button>
          {code && <div role="status" className="mt-3 rounded-xl bg-brand-50 p-3"><p className="mb-1 text-sm font-semibold">{t('Code d’invitation au foyer pour l’inscription (visible uniquement maintenant)')}</p><output className="block break-all font-mono text-sm text-brand-700">{code}</output></div>}
        </div>
      </div> : <div className="card p-5 sm:p-6"><p className="muted">{t('Seuls les admins du foyer peuvent le renommer, inviter des personnes ou rejoindre une famille.')}</p></div>}
    </div>
  </section>
}

function ProfileMenu({ me, busy, onProfile, onLogout }: { me: Person; busy: boolean; onProfile: () => void; onLogout: () => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }
    const onClick = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('keydown', onKey); document.addEventListener('mousedown', onClick)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick) }
  }, [open])
  return <div className="relative" ref={ref}>
    <button ref={trigger} className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-brand-50" aria-haspopup="true" aria-expanded={open} aria-controls="account-menu" aria-label={t('Menu du compte')} onClick={() => setOpen(value => !value)}>
      <Avatar person={me} size="sm"/><span className="hidden max-w-[140px] truncate text-sm font-semibold sm:block">{nameOf(me)}</span><Icon name="chevron" size={14} className={`transition ${open ? '-rotate-90' : 'rotate-90'}`}/>
    </button>
    {open && <div id="account-menu" className="absolute right-0 top-12 z-30 w-64 rounded-2xl border border-line bg-white p-2 shadow-xl">
      <div className="border-b border-line-soft px-3 pb-3 pt-2"><p className="truncate font-semibold">{nameOf(me)}</p>{me.email && <p className="muted truncate">{me.email}</p>}</div>
      <button className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-brand-50" onClick={() => { setOpen(false); onProfile() }}><Icon name="user" size={18}/>{t('Mon profil')}</button>
      <div className="px-3 py-2.5"><LanguageControl/></div>
      <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-brand-50" disabled={busy} onClick={() => { setOpen(false); onLogout() }}><Icon name="logout" size={18}/>{t('Se déconnecter')}</button>
    </div>}
  </div>
}

// A name day is a day in the year, stored as MM-DD: it repeats, so it carries no year. The two
// halves travel together in the form, which is why reading them back is shared too.
function NameDayFields({ idPrefix, value, hint }: { idPrefix: string; value?: string | null; hint: string }) {
  const { locale, t } = useTranslation()
  const months = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, index, 1))))
  const [month, day] = value ? value.split('-') : ['', '']
  return <fieldset>
    <legend className="label">{t('Date de fête')}</legend>
    <p className="muted mb-2">{hint}</p>
    <div className="flex flex-wrap gap-2">
      <label className="sr-only" htmlFor={`${idPrefix}-name-day-day`}>{t('Jour')}</label>
      <select className="field !w-auto" id={`${idPrefix}-name-day-day`} name="nameDayDay" defaultValue={day}><option value="">{t('Jour')}</option>{Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0')).map(value => <option key={value} value={value}>{Number(value)}</option>)}</select>
      <label className="sr-only" htmlFor={`${idPrefix}-name-day-month`}>{t('Mois')}</label>
      <select className="field !w-auto" id={`${idPrefix}-name-day-month`} name="nameDayMonth" defaultValue={month}><option value="">{t('Mois')}</option>{months.map((label, index) => <option key={label} value={String(index + 1).padStart(2, '0')}>{label}</option>)}</select>
    </div>
  </fieldset>
}

// Both halves or neither: a day without its month would never match an occasion.
function readNameDay(data: FormData, incomplete: string) {
  const month = String(data.get('nameDayMonth') ?? ''), day = String(data.get('nameDayDay') ?? '')
  if (!!month !== !!day) throw new Error(incomplete)
  return month ? `${month}-${day}` : null
}

function ProfileForm({ me, busy, perform, onSaved }: {
  me: Person; busy: boolean;
  perform: (action: () => Promise<unknown>, success: string, close?: boolean) => Promise<boolean>; onSaved: (person: Person) => void
}) {
  const { t } = useTranslation()
  return <form className="space-y-4 border-t border-line pt-6" onSubmit={event => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    void perform(async () => {
      const person = await api<Person>('/profile', json('PATCH', {
        firstName: String(data.get('firstName')).trim(), lastName: String(data.get('lastName')).trim(),
        nameDay: readNameDay(data, t('Choisissez le jour et le mois de votre fête.')),
      }))
      onSaved(person)
    }, t('Profil mis à jour.'), false)
  }}>
    <h3 className="font-['Outfit'] text-lg font-semibold">{t('Modifier mon profil')}</h3>
    <div className="grid gap-4 sm:grid-cols-2">
      <div><label className="label" htmlFor="profile-first-name">{t('Prénom')}</label><input className="field" id="profile-first-name" name="firstName" defaultValue={me.firstName} required/></div>
      <div><label className="label" htmlFor="profile-last-name">{t('Nom')}</label><input className="field" id="profile-last-name" name="lastName" defaultValue={me.lastName} required/></div>
    </div>
    <NameDayFields idPrefix="profile" value={me.nameDay} hint={t('Utilisée pour l’occasion « Fête » dans vos familles.')}/>
    <button disabled={busy} className="primary">{t('Enregistrer')}</button>
  </form>
}

const onboardingKey = (me: Person) => `pensa-onboarding-dismissed-${me.id}`
function Guidance({ me, onboarding, todos, busy, onAddWish, onGo, onPerson, onReservation, onStatus }: {
  me: Person; onboarding?: Onboarding; todos: Todo[]; busy: boolean; onAddWish: () => void; onGo: (page: Page) => void; onPerson: (person: Person) => void
  onReservation: (id: Id) => void; onStatus: (id: Id, status: ReservationStatus, title?: string) => Promise<boolean>
}) {
  const { locale, t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(onboardingKey(me)) === '1' } catch { return false } })
  const steps = onboarding ? [
    { done: onboarding.hasWishes, label: t('Ajouter une première envie'), action: t('Ajouter'), run: onAddWish },
    { done: onboarding.hasNameDay, label: t('Renseigner votre date de fête'), action: t('Mon profil'), run: () => onGo('profile') },
    { done: onboarding.hasSharedFamily, label: t('Créer ou rejoindre une famille avec d’autres foyers'), action: t('Ma famille'), run: () => onGo('families') },
    { done: onboarding.hasReservation, label: t('Réserver un premier cadeau pour un proche'), action: t('Découvrir les envies'), run: () => onGo('families') },
  ] : []
  const doneCount = steps.filter(step => step.done).length
  const showChecklist = !dismissed && steps.length > 0 && doneCount < steps.length
  const dismiss = () => { try { localStorage.setItem(onboardingKey(me), '1') } catch { /* Keep dismissal for this session only. */ } setDismissed(true) }
  const statusTodos: Partial<Record<Todo['type'], { verb: TranslationKey; done: TranslationKey; next: ReservationStatus; icon: IconName }>> = {
    reservation_to_buy: { verb: 'Acheter « {title} » pour {name}', done: 'C’est acheté', next: 'purchased', icon: 'cart' },
    reservation_to_wrap: { verb: 'Emballer « {title} » pour {name}', done: 'C’est emballé', next: 'wrapped', icon: 'box' },
    reservation_to_give: { verb: 'Offrir « {title} » à {name}', done: 'C’est offert', next: 'gifted', icon: 'party' },
  }
  const describe = (todo: Todo) => {
    const name = nameOf(todo.person), occasion = occasionLabel(todo.occasion, locale, { year: todo.date ? Number(todo.date.slice(0, 4)) : null, birthDate: todo.person?.birthDate }), date = dateOf(todo.date), title = todo.reservation?.wishTitle ?? ''
    if (todo.type === 'occasion_without_gift') return { text: t('{occasion} de {name} le {date} : aucun cadeau prévu', { occasion: occasionName(todo.occasion, locale), name, date }), action: t('Voir ses envies'), icon: 'calendar' as IconName, run: () => todo.person && onPerson(todo.person) }
    if (todo.type === 'managed_list_empty') return { text: t('La liste de {name} est vide : votre foyer la tient à jour', { name }), action: t('Compléter sa liste'), icon: 'heart' as IconName, run: () => todo.person && onPerson(todo.person) }
    const step = statusTodos[todo.type]
    if (step && todo.reservation) {
      const reservation = todo.reservation
      return { text: t(step.verb, { title, name }), detail: todo.date ? t('{occasion} le {date}', { occasion, date }) : undefined,
        action: t('Voir'), icon: step.icon, run: () => onReservation(reservation.id),
        primary: step.next === 'gifted' && reservation.wishDeleted ? undefined : { label: t(step.done), run: () => void onStatus(reservation.id, step.next, title) } }
    }
    return { text: t(todo.count === 1 ? '{count} demande de participation à traiter pour « {title} »' : '{count} demandes de participation à traiter pour « {title} »', { count: todo.count ?? 0, title }), action: t('Répondre'), icon: 'users' as IconName, run: () => todo.reservation ? onReservation(todo.reservation.id) : onGo('reservations') }
  }
  return <div className={`mb-9 grid gap-5 ${showChecklist ? 'lg:grid-cols-2' : ''}`}>
    {showChecklist && <section className="card p-5 sm:p-6" aria-labelledby="onboarding-title">
      <div className="mb-4 flex items-start justify-between gap-3"><div><p className="eyebrow mb-1">{t('BIEN DÉMARRER')}</p><h2 id="onboarding-title" className="font-['Outfit'] text-xl font-semibold">{t('{done} étapes sur {total}', { done: doneCount, total: steps.length })}</h2></div><button className="icon-button" onClick={dismiss} aria-label={t('Masquer le guide de démarrage')}><Icon name="close" size={16}/></button></div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-brand-50" aria-hidden="true"><div className="h-full rounded-full bg-brand-600" style={{ width: `${(doneCount / steps.length) * 100}%` }}/></div>
      <ul className="space-y-2">{steps.map(step => <li key={step.label} className="flex items-center gap-3 rounded-xl px-2 py-2">
        <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${step.done ? 'bg-sage-600 text-white' : 'border-2 border-brand-400'}`}>{step.done && <Icon name="check" size={14}/>}</span>
        <span className={`flex-1 text-sm ${step.done ? 'text-ink-500 line-through' : 'font-semibold'}`}>{step.label}{step.done && <span className="sr-only"> ({t('terminé')})</span>}</span>
        {!step.done && <button className="secondary !px-3 !py-1.5 text-xs" onClick={step.run}>{step.action}</button>}
      </li>)}</ul>
    </section>}
    <section className="card p-5 sm:p-6" aria-labelledby="todo-title">
      <p className="eyebrow mb-1">{t('PROCHAINES ÉTAPES')}</p><h2 id="todo-title" className="mb-4 font-['Outfit'] text-xl font-semibold">{t('À faire')}</h2>
      {todos.length ? <ul className="divide-y divide-line-soft">{todos.map((todo, index) => { const item: { text: string; detail?: string; action: string; icon: IconName; run: () => void; primary?: { label: string; run: () => void } } = describe(todo); return <li key={`${todo.type}-${todo.person?.id ?? ''}-${todo.reservation?.id ?? ''}-${index}`} className={`flex flex-wrap items-center gap-3 py-3 ${todo.urgent ? '-mx-2 rounded-xl bg-clay-50 px-2' : ''}`}>
        <span className={`rounded-xl p-2 ${todo.urgent ? 'bg-clay-100 text-clay-600' : 'bg-brand-50 text-brand-600'}`}><Icon name={item.icon} size={18}/></span>
        <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 text-sm font-semibold">{item.text}{todo.urgent && <span className="rounded-full bg-clay-600 px-2 py-0.5 text-[11px] font-bold text-white">{t('Bientôt')}</span>}</span>{item.detail && <span className="muted block text-xs">{item.detail}</span>}</span>
        <span className="flex gap-2">{item.primary && <button className="primary !px-3 !py-1.5 text-xs" disabled={busy} onClick={item.primary.run}><Icon name="check" size={14}/> {item.primary.label}</button>}
        <button className="secondary !px-3 !py-1.5 text-xs" onClick={item.run}>{item.action} <Icon name="arrow" size={14}/></button></span>
      </li> })}</ul> : <p className="muted">{t('Rien à faire dans l’immédiat. Vous pouvez en profiter pour compléter votre liste d’envies.')}</p>}
    </section>
  </div>
}

const selectionOf = (occasion: Occasion): OccasionSelection | null => {
  const year = occasion.year ?? (occasion.nextDate ? Number(occasion.nextDate.slice(0, 4)) : NaN)
  return Number.isInteger(year) ? { id: occasion.id, year } : null
}
type OccasionOption = { occasion: Occasion; selection: OccasionSelection; date: string | null }
const occurrenceDate = (occasion: Occasion, year: number) => {
  if (!occasion.nextDate) return null
  const month = Number(occasion.nextDate.slice(5, 7)), day = Number(occasion.nextDate.slice(8, 10))
  const exists = new Date(Date.UTC(year, month - 1, day)).getUTCDate() === day
  return `${year}-${String(month).padStart(2, '0')}-${String(exists ? day : 28).padStart(2, '0')}`
}
const byDate = (a: OccasionOption, b: OccasionOption) => (a.date ?? `${a.selection.year}-99`).localeCompare(b.date ?? `${b.selection.year}-99`)
  || String(a.occasion.name ?? a.occasion.title ?? '').localeCompare(String(b.occasion.name ?? b.occasion.title ?? ''))
// Next occurrence and the following year of each occasion, merged with already saved ones, in chronological order.
const occurrences = (occasions: Occasion[], saved: Occasion[] = []): OccasionOption[] => {
  const available = occasions.flatMap(occasion => {
    const first = selectionOf(occasion)
    if (!first) return []
    return [first, { id: first.id, year: first.year + 1 }]
      .filter(selection => selection.year <= 2200)
      .map(selection => ({ occasion, selection, date: occurrenceDate(occasion, selection.year) }))
  })
  const kept = saved.flatMap(occasion => {
    const selection = selectionOf(occasion)
    if (!selection) return []
    const match = occasions.find(item => String(item.id) === String(occasion.id)) ?? occasions.find(item => (item.name ?? item.title) === (occasion.name ?? occasion.title))
    return [{ occasion: { ...occasion, kind: occasion.kind ?? match?.kind }, selection, date: match ? occurrenceDate(match, selection.year) : null }]
  })
  return [...kept, ...available.filter(item => !isSaved(item, saved))].sort(byDate)
}
const sameSelection = (a: OccasionSelection, b: OccasionSelection) => String(a.id) === String(b.id) && a.year === b.year
const occasionWithYear = (occasion: { name?: string; kind?: Occasion['kind']; year?: number }, locale: Locale, birthDate?: string | null) => {
  const label = occasionLabel(occasion.name, locale, { kind: occasion.kind, year: occasion.year, birthDate })
  return label === occasionName(occasion.name, locale, occasion.kind) && occasion.year ? `${label} ${occasion.year}` : label
}
const isSaved = (item: { occasion: Occasion; selection: OccasionSelection }, saved: Occasion[] = []) => saved.some(occasion => occasion.year === item.selection.year &&
  (String(occasion.id) === String(item.selection.id) || (occasion.name ?? occasion.title) === (item.occasion.name ?? item.occasion.title)))
function OccasionPicker({ options, selected, person, onToggle }: { options: OccasionOption[]; selected: OccasionSelection[]; person?: Person | null; onToggle: (selection: OccasionSelection) => void }) {
  const { locale, t } = useTranslation()
  return <div className="max-h-36 space-y-2 overflow-y-auto">{options.map(({ occasion, selection, date }) => <label key={`${selection.id}-${selection.year}`} className="flex items-center gap-2 text-sm">
    <input type="checkbox" className="accent-brand-600" checked={selected.some(value => sameSelection(value, selection))} onChange={() => onToggle(selection)}/>
    {occasionLabel(occasion.name || occasion.title, locale, { kind: occasion.kind, year: selection.year, birthDate: person?.birthDate }) || t('Occasion')} <span className="text-ink-500">{date ? dateOf(date) : t('année {year}', { year: selection.year })}</span>
  </label>)}</div>
}
type ReservationStatus = 'reserved' | 'purchased' | 'wrapped' | 'gifted'
const statusOrder: ReservationStatus[] = ['reserved', 'purchased', 'wrapped', 'gifted']
const statusLabels: Record<string, TranslationKey> = { reserved: 'Réservé', purchased: 'Acheté', wrapped: 'Emballé', gifted: 'Offert' }
const requestLabels: Record<string, TranslationKey> = { pending: 'En attente', accepted: 'Acceptée', refused: 'Refusée' }
const statusNotices: Record<ReservationStatus, TranslationKey> = { reserved: 'Cadeau repassé en réservé.', purchased: 'Cadeau marqué comme acheté.', wrapped: 'Cadeau marqué comme emballé.', gifted: 'Cadeau marqué comme offert !' }
const nextActions: Partial<Record<ReservationStatus, TranslationKey>> = { purchased: 'Marquer comme acheté', wrapped: 'Marquer comme emballé', gifted: 'Marquer comme offert' }
const backActions: Partial<Record<ReservationStatus, TranslationKey>> = { reserved: 'Revenir à Réservé', purchased: 'Revenir à Acheté' }

function StatusStepper({ status, cancelled }: { status: string; cancelled?: boolean }) {
  const { t } = useTranslation()
  const current = Math.max(0, statusOrder.indexOf(status as ReservationStatus))
  return <ol className={`flex items-center gap-1 ${cancelled ? 'opacity-50' : ''}`} aria-label={t('Avancement du cadeau')}>
    {statusOrder.map((step, index) => {
      const done = index < current || (index === current && step === 'gifted'), active = index === current
      return <li key={step} className="flex flex-1 items-center gap-1" aria-current={active ? 'step' : undefined}>
        <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${done ? 'bg-sage-600 text-white' : active ? 'bg-brand-600 text-white ring-4 ring-brand-100' : 'border-2 border-brand-400 text-ink-500'}`}>{done ? <Icon name="check" size={13}/> : index + 1}</span>
        <span className={`truncate text-xs ${active ? 'font-bold text-ink-700' : done ? 'text-sage-600' : 'text-ink-500'}`}>{t(statusLabels[step])}</span>
        {index < statusOrder.length - 1 && <span aria-hidden="true" className={`mx-1 h-0.5 min-w-3 flex-1 rounded-full ${index < current ? 'bg-sage-600' : 'bg-line'}`}/>}
      </li>
    })}
  </ol>
}

function ReservationForm({ wish, reservations, occasions, people, me, busy, perform }: { wish: Wish; reservations: Reservation[]; occasions: Occasion[]; people: Person[]; me: Person; busy: boolean; perform: (action: () => Promise<unknown>, success: string, close?: boolean) => Promise<boolean> }) {
  const { t } = useTranslation()
  const existing = reservations.find(item => String(item.wishId) === String(wish.id) && !item.cancelled && item.status !== 'gifted') || wish.reservation
  const mine = existing && String(existing.creator?.id) === String(me.id)
  const [selectedOccasions, setSelectedOccasions] = useState<OccasionSelection[]>(existing?.occasionIds || existing?.occasions?.map(selectionOf).filter((item): item is OccasionSelection => item !== null) || [])
  const changedOccasions = useRef(false)
  const [selectedParticipants, setSelectedParticipants] = useState<Id[]>(existing?.participantIds || existing?.participants?.map(person => person.id) || [])
  const [open, setOpen] = useState(existing?.openToContributions ?? false)
  const togglePerson = (id: Id) => setSelectedParticipants(values => values.some(value => String(value) === String(id)) ? values.filter(value => String(value) !== String(id)) : [...values, id])
  useEffect(() => {
    const first = occasions.map(selectionOf).find((item): item is OccasionSelection => item !== null)
    if (!existing && !changedOccasions.current && first) {
      setSelectedOccasions(current => current.length || changedOccasions.current ? current : [first])
    }
  }, [occasions, existing])
  if (existing && !mine) return <div><p className="mb-4 text-sm text-ink-500">{t('Cette envie est réservée par')} <strong>{nameOf(existing.creator)}</strong>.</p>{existing.participants?.length ? <p className="muted mb-4">{t('Participants :')} {existing.participants.map(nameOf).join(', ')}</p> : null}{existing.participants?.some(person => String(person.id) === String(me.id)) ? <p className="muted">{t('Vous participez déjà à ce cadeau.')}</p> : existing.openToContributions ? <button disabled={busy} className="primary w-full" onClick={() => { void perform(() => api(`/reservations/${existing.id}/requests`, json('POST', {})), t('Demande de participation envoyée.')) }}>{t('Demander à participer')}</button> : <p className="muted">{t('Cette réservation n’est pas ouverte aux participations.')}</p>}</div>
  const options = occurrences(occasions, existing?.occasions)
  const owner = people.find(person => String(person.id) === String(wish.ownerId))
  return <form onSubmit={event => { event.preventDefault(); const body = { occasionIds: selectedOccasions, participantIds: selectedParticipants, openToContributions: open }; void perform(() => existing ? api(`/reservations/${existing.id}`, json('PATCH', body)) : api('/reservations', json('POST', { wishId: wish.id, ...body })), existing ? t('Réservation mise à jour.') : t('Envie réservée !')) }}>
    <p className="muted mb-5">{t('Pour')} <strong className="text-ink-700">{wish.title}</strong></p>
    <fieldset className="mb-5"><legend className="label">{t('Occasions (au moins une)')}</legend>    {options.length ? <OccasionPicker options={options} selected={selectedOccasions} person={owner} onToggle={selection => { changedOccasions.current = true; setSelectedOccasions(values => values.some(value => sameSelection(value, selection)) ? values.filter(value => !sameSelection(value, selection)) : [...values, selection]) }}/> : <p className="muted">{t('Aucune occasion datée pour cette personne. Créez une occasion dans une famille commune avant de réserver.')}</p>}</fieldset>
    <fieldset className="mb-5"><legend className="label">{t('Inviter des participants')}</legend><div className="max-h-32 space-y-2 overflow-y-auto">{people.filter(person => String(person.id) !== String(me.id) && String(person.id) !== String(wish.ownerId)).map(person => <label key={person.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-600" checked={selectedParticipants.some(id => String(id) === String(person.id))} onChange={() => togglePerson(person.id)}/>{nameOf(person)}</label>)}</div></fieldset>
    <label className="mb-5 flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-600" checked={open} onChange={event => setOpen(event.target.checked)}/>{t('Autoriser les demandes de participation')}</label>
    <button disabled={busy || selectedOccasions.length === 0} className="primary w-full">{existing ? t('Enregistrer les modifications') : t('Confirmer la réservation')}</button>
  </form>
}

const giftBody = (data: FormData) => {
  const text = (key: string) => String(data.get(key) ?? '').trim() || null
  const price = text('price')
  return { title: text('title') ?? '', description: text('description'), price: price === null ? null : Number(price), url: text('url'), image: text('image') }
}
function GiftFields({ gift }: { gift?: Wish }) {
  const { t } = useTranslation()
  const id = useId()
  return <div className="space-y-4">
    <div><label className="label" htmlFor={`${id}-title`}>{t('Nom du cadeau')}</label><input className="field" id={`${id}-title`} name="title" defaultValue={gift?.title ?? ''} maxLength={200} placeholder={t('Ex. : Un week-end surprise')} required/></div>
    <div><label className="label" htmlFor={`${id}-description`}>{t('Description')} <span className="font-normal">{t('(facultatif)')}</span></label><textarea className="field min-h-20" id={`${id}-description`} name="description" defaultValue={gift?.description ?? ''}/></div>
    <div className="grid grid-cols-2 gap-3"><div><label className="label" htmlFor={`${id}-price`}>{t('Prix (€)')} <span className="font-normal">{t('(facultatif)')}</span></label><input className="field" id={`${id}-price`} name="price" type="number" min="0" step="0.01" defaultValue={gift?.price ?? ''}/></div><div><label className="label" htmlFor={`${id}-url`}>{t('Lien')} <span className="font-normal">{t('(facultatif)')}</span></label><input className="field" id={`${id}-url`} name="url" type="url" defaultValue={gift?.url ?? ''} placeholder="https://…"/></div></div>
    <div><label className="label" htmlFor={`${id}-image`}>{t('URL de l’image')} <span className="font-normal">{t('(facultatif)')}</span></label><input className="field" id={`${id}-image`} name="image" type="url" defaultValue={gift?.image ?? ''} placeholder="https://…"/></div>
  </div>
}

function OffListForm({ recipient, people, me, busy, perform }: { recipient: Person | null; people: Person[]; me: Person; busy: boolean; perform: (action: () => Promise<unknown>, success: string, close?: boolean) => Promise<boolean> }) {
  const { locale, t } = useTranslation()
  const [recipientId, setRecipientId] = useState(recipient ? String(recipient.id) : '')
  const [occasions, setOccasions] = useState<Occasion[]>([])
  const [loadError, setLoadError] = useState('')
  const [selectedOccasions, setSelectedOccasions] = useState<OccasionSelection[]>([])
  const [selectedParticipants, setSelectedParticipants] = useState<Id[]>([])
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!recipientId) return
    let active = true
    api<Occasion[]>(`/occasions?recipientId=${encodeURIComponent(recipientId)}`).then(data => {
      if (!active) return
      const loaded = list<Occasion>(data)
      setOccasions(loaded); setLoadError('')
      const first = loaded.map(selectionOf).find((item): item is OccasionSelection => item !== null)
      setSelectedOccasions(first ? [first] : [])
    }).catch(problem => { if (active) setLoadError(problem instanceof Error ? problem.message : t('Occasions indisponibles.')) })
    return () => { active = false }
  }, [recipientId, t])
  const candidates = people.filter(person => String(person.id) !== String(me.id))
  const options = recipientId ? occurrences(occasions) : []
  const toggle = <T,>(values: T[], value: T, same: (a: T, b: T) => boolean) => values.some(item => same(item, value)) ? values.filter(item => !same(item, value)) : [...values, value]
  return <form onSubmit={event => { event.preventDefault(); const body = { recipientId, ...giftBody(new FormData(event.currentTarget)), occasionIds: selectedOccasions, participantIds: selectedParticipants, openToContributions: open }; void perform(() => api('/reservations/off-list', json('POST', body)), t('Cadeau hors liste prévu !')) }}>
    <p className="muted mb-5">{t('Un cadeau qui n’est pas sur la liste : le bénéficiaire ne le verra jamais avant qu’il soit offert.')}</p>
    {recipient ? <p className="mb-5 text-sm">{t('Pour')} <strong className="text-ink-700">{nameOf(recipient)}</strong></p>
      : <div className="mb-5"><label className="label" htmlFor="off-list-recipient">{t('Pour qui ?')}</label><select className="field" id="off-list-recipient" value={recipientId} onChange={event => { setRecipientId(event.target.value); setOccasions([]); setSelectedOccasions([]); setSelectedParticipants(values => values.filter(value => String(value) !== event.target.value)) }} required><option value="">{t('Choisir une personne')}</option>{candidates.map(person => <option key={person.id} value={String(person.id)}>{nameOf(person)}</option>)}</select></div>}
    <GiftFields/>
    <fieldset className="my-5"><legend className="label">{t('Occasions (au moins une)')}</legend>{!recipientId ? <p className="muted">{t('Choisissez d’abord une personne.')}</p> : loadError ? <p role="alert" className="text-sm text-red-700">{localizeMessage(loadError, locale)}</p>     : options.length ? <OccasionPicker options={options} selected={selectedOccasions} person={people.find(person => String(person.id) === recipientId) ?? recipient} onToggle={selection => setSelectedOccasions(values => toggle(values, selection, sameSelection))}/> : <p className="muted">{t('Aucune occasion datée pour cette personne. Créez une occasion dans une famille commune avant de réserver.')}</p>}</fieldset>
    {recipientId && <fieldset className="mb-5"><legend className="label">{t('Inviter des participants')}</legend><div className="max-h-32 space-y-2 overflow-y-auto">{candidates.filter(person => String(person.id) !== recipientId).map(person => <label key={person.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-600" checked={selectedParticipants.some(id => String(id) === String(person.id))} onChange={() => setSelectedParticipants(values => toggle(values, person.id, (a, b) => String(a) === String(b)))}/>{nameOf(person)}</label>)}</div></fieldset>}
    <label className="mb-1 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 accent-brand-600" checked={open} onChange={event => setOpen(event.target.checked)}/><span>{t('Visible et ouvert aux participations')}<span className="muted block">{t('Les proches du bénéficiaire le verront et pourront demander à participer. Sinon, seuls vous et les participants invités le voient.')}</span></span></label>
    <button disabled={busy || !recipientId || selectedOccasions.length === 0} className="primary mt-5 w-full">{t('Prévoir ce cadeau')}</button>
  </form>
}

function OffListGiftCard({ gift, me, busy, showRecipient, onRequest, onOpen, onRecipient }: { gift: Reservation; me: Person; busy: boolean; showRecipient?: boolean; onRequest: () => void; onOpen: () => void; onRecipient?: () => void }) {
  const { locale, t } = useTranslation()
  const involved = String(gift.creator?.id) === String(me.id) || !!gift.participants?.some(person => String(person.id) === String(me.id))
  return <article className="card flex flex-col p-5">
    <div className="flex items-start gap-3">{gift.wish?.image ? <img src={gift.wish.image} alt="" className="size-12 shrink-0 rounded-xl object-cover"/> : <span className="rounded-xl bg-clay-50 p-2.5 text-clay-500"><Icon name="gift" size={21}/></span>}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-['Outfit'] font-semibold">{gift.wish?.title}</h3>{!gift.openToContributions && <span className="chip">{t('Privé')}</span>}</div>{showRecipient && gift.recipient && <p className="text-sm font-medium text-ink-700">{t('Pour')} {onRecipient ? <button className="font-semibold text-brand-600 hover:underline" onClick={onRecipient}>{nameOf(gift.recipient)}</button> : nameOf(gift.recipient)}</p>}{gift.wish?.price != null && <p className="text-sm font-semibold text-brand-600">{money(gift.wish.price)}</p>}</div></div>
    {gift.wish?.description && <p className="muted mt-3 line-clamp-3">{gift.wish.description}</p>}
    {gift.wish?.url && <a className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline" href={gift.wish.url} target="_blank" rel="noreferrer"><Icon name="external" size={14}/> {t('Voir le lien')}</a>}
    <p className="muted mt-3">{gift.occasions?.map(item => occasionWithYear(item, locale, gift.recipient?.birthDate)).join(', ')}</p>
    <p className="muted mt-1">{t('Organisé par')} {nameOf(gift.creator)} · {t('Participants :')} {gift.participants?.map(nameOf).join(', ') || t('Aucun')}</p>
    <div className="mt-auto pt-4">{involved ? <button className="secondary w-full !py-2 text-sm" onClick={onOpen}>{t('Voir dans mes réservations')} <Icon name="arrow" size={15}/></button>
      : gift.requestStatus === 'pending' ? <p className="rounded-xl bg-brand-50 p-2 text-center text-sm text-ink-500">{t('Demande envoyée, en attente de réponse.')}</p>
        : gift.requestStatus === 'refused' ? <p className="rounded-xl bg-brand-50 p-2 text-center text-sm text-ink-500">{t('Votre demande a été refusée.')}</p>
          : gift.openToContributions ? <button className="primary w-full !py-2 text-sm" disabled={busy} onClick={onRequest}>{t('Participer')}</button> : null}</div>
  </article>
}

function ReservationRow({ reservation, users, me, busy, perform, onStatus, focused }: { reservation: Reservation; users: Person[]; me: Person; busy: boolean; perform: (action: () => Promise<unknown>, success: string, close?: boolean) => Promise<boolean>; onStatus: (id: Id, status: ReservationStatus, title?: string) => Promise<boolean>; focused?: boolean }) {
  const { locale, t } = useTranslation()
  const card = useRef<HTMLElement>(null)
  useEffect(() => { if (focused) card.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, [focused])
  const statusText = (value: string) => Object.prototype.hasOwnProperty.call(statusLabels, value) ? t(statusLabels[value]) : localizeMessage(value, locale)
  const requestText = (value: string) => Object.prototype.hasOwnProperty.call(requestLabels, value) ? t(requestLabels[value]) : localizeMessage(value, locale)
  const creator = reservation.creator?.id === me.id
  const editable = creator && !reservation.cancelled && reservation.status !== 'gifted'
  const [editing, setEditing] = useState(false)
  const current = (reservation.status || 'reserved') as ReservationStatus
  const index = statusOrder.indexOf(current)
  const next = statusOrder[index + 1], previous = current === 'gifted' ? undefined : statusOrder[index - 1]
  const nextLabel = next && nextActions[next], backLabel = previous && backActions[previous]
  const nextIcon: Record<ReservationStatus, IconName> = { reserved: 'gift', purchased: 'cart', wrapped: 'box', gifted: 'party' }
  const [open, setOpen] = useState(reservation.openToContributions || false)
  const [occasionIds, setOccasionIds] = useState<OccasionSelection[]>(reservation.occasions?.map(selectionOf).filter((item): item is OccasionSelection => item !== null) || [])
  const [participantIds, setParticipantIds] = useState<Id[]>(reservation.participants?.map(person => person.id) || [])
  const [available, setAvailable] = useState<Occasion[]>([])
  const [recipientId, setRecipientId] = useState<Id | undefined>()
  const [requests, setRequests] = useState<ParticipationRequest[]>([])
  const [localError, setLocalError] = useState('')
  useEffect(() => {
    if (!creator) return
    let active = true
    api<ParticipationRequest[]>(`/reservations/${reservation.id}/requests`).then(value => { if (active) setRequests(list(value)) }).catch(problem => { if (active) setLocalError(problem instanceof Error ? problem.message : t('Demandes indisponibles.')) })
    return () => { active = false }
  }, [creator, reservation, t])
  async function openEditor() {
    if (editing) { setEditing(false); return }
    setEditing(true); setLocalError('')
    try {
      const ownerId = reservation.recipient?.id ?? (reservation.wishId && !reservation.offList ? (await api<Wish>(`/wishes/${reservation.wishId}`)).ownerId : undefined)
      setRecipientId(ownerId)
      if (ownerId) setAvailable(list(await api<Occasion[]>(`/occasions?recipientId=${encodeURIComponent(String(ownerId))}`)))
    } catch (problem) {
      setLocalError(problem instanceof Error ? problem.message : t('Occasions indisponibles.'))
    }
  }
  const options = occurrences(available, reservation.occasions)
  const recipient = reservation.recipient ?? users.find(person => String(person.id) === String(recipientId))
  const occasionSummary = (items: Occasion[] = []) => items.map(item => occasionWithYear(item, locale, recipient?.birthDate)).join(', ')
  return <article ref={card} id={`reservation-${reservation.id}`} className={`card scroll-mt-24 p-5 ${focused ? 'ring-2 ring-brand-600' : ''}`}>
    <div className="flex flex-wrap items-start gap-4">{reservation.wish?.image ? <img src={reservation.wish.image} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover"/> : <span className="rounded-2xl bg-brand-50 p-3 text-brand-600"><Icon name="gift" size={23}/></span>}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-['Outfit'] text-lg font-semibold">{reservation.wish?.title || t('Réservation #{id}', { id: String(reservation.id).slice(0, 8) })}</h3>{reservation.offList && <span className="chip !bg-clay-50 !text-clay-600">{t('Hors liste')}</span>}{reservation.offList && <span className="chip">{reservation.openToContributions ? t('Visible par la famille') : t('Privé')}</span>}</div>{reservation.recipient && <p className="mt-1 text-sm font-medium text-ink-700">{t('Pour')} {nameOf(reservation.recipient)}{reservation.offList && reservation.wish?.price != null && <> · {money(reservation.wish.price)}</>}</p>}{reservation.offList && reservation.wish?.description && <p className="muted mt-1">{reservation.wish.description}</p>}{reservation.offList && reservation.wish?.url && <a className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline" href={reservation.wish.url} target="_blank" rel="noreferrer"><Icon name="external" size={14}/> {t('Voir le lien')}</a>}<p className="muted mt-1">{occasionSummary(reservation.occasions) || t('Cadeau en préparation')} · {reservation.cancelled ? t('Annulé') : statusText(reservation.status || 'reserved')}</p><p className="muted mt-1">{t('Organisé par')} {nameOf(reservation.creator)} · {t('Participants :')} {reservation.participants?.map(nameOf).join(', ') || t('Aucun')}</p>{reservation.wishDeleted && !reservation.offList && <p className="muted">{t('L’envie a été supprimée.')}</p>}</div>{editable && <button className="secondary text-sm" onClick={() => void openEditor()}><Icon name="edit" size={16}/> {editing ? t('Fermer') : t('Gérer')}</button>}</div>
    {!reservation.cancelled && reservation.status && <div className="mt-4 space-y-3 rounded-2xl bg-brand-50 p-4">
      <StatusStepper status={current}/>
      {editable && <div className="flex flex-wrap gap-2">
        {nextLabel && <button className="primary !py-2 text-sm" disabled={busy || (next === 'gifted' && reservation.wishDeleted)}         onClick={() => void onStatus(reservation.id, next, reservation.wish?.title)}><Icon name={nextIcon[next]} size={16}/> {t(nextLabel)}</button>}
                {backLabel && <button className="secondary !py-2 text-sm" disabled={busy} onClick={() => void onStatus(reservation.id, previous!)}><Icon name="arrowLeft" size={16}/> {t(backLabel)}</button>}
      </div>}
      {editable && next === 'gifted' && reservation.wishDeleted && <p className="muted text-xs">{t('L’envie a été supprimée : impossible de la marquer comme offerte.')}</p>}
      {!creator && current !== 'gifted' && <p className="muted text-xs">{t('Seul l’organisateur peut faire avancer ce cadeau.')}</p>}
    </div>}
    {localError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{localError}</p>}
    {editing && <form className="mt-5 space-y-4 border-t border-line pt-5" onSubmit={event => { event.preventDefault(); const body = { occasionIds, participantIds, openToContributions: open, ...(reservation.offList ? { gift: giftBody(new FormData(event.currentTarget)) } : {}) }; void perform(() => api(`/reservations/${reservation.id}`, json('PATCH', body)), t('Réservation mise à jour.'), false).then(ok => { if (ok) setEditing(false) }) }}>
      {reservation.offList && reservation.wish && <GiftFields gift={reservation.wish}/>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-600" checked={open} onChange={event => setOpen(event.target.checked)}/>{reservation.offList ? t('Visible et ouvert aux participations') : t('Ouvert aux participations')}</label>
      <fieldset><legend className="label">{t('Occasions (au moins une)')}</legend><OccasionPicker options={options} selected={occasionIds} person={recipient} onToggle={selection => setOccasionIds(values => values.some(value => sameSelection(value, selection)) ? values.filter(value => !sameSelection(value, selection)) : [...values, selection])}/></fieldset>
      <fieldset><legend className="label">{t('Participants')}</legend>{recipientId ? <div className="flex max-h-32 flex-wrap gap-3 overflow-y-auto">{users.filter(person => String(person.id) !== String(me.id) && String(person.id) !== String(recipientId)).map(person => <label className="inline-flex items-center gap-2 text-sm" key={person.id}><input type="checkbox" checked={participantIds.some(id => String(id) === String(person.id))} onChange={() => setParticipantIds(values => values.some(id => String(id) === String(person.id)) ? values.filter(id => String(id) !== String(person.id)) : [...values, person.id])}/>{nameOf(person)}</label>)}</div> : <p className="muted">{t('Participants existants conservés ; détails de l’envie indisponibles.')}</p>}</fieldset>
      <div className="flex flex-wrap gap-2"><button className="primary" disabled={busy || occasionIds.length === 0}>{t('Enregistrer')}</button><button type="button" className="secondary !text-red-600" disabled={busy} onClick={() => { if (window.confirm(t('Annuler cette réservation ?'))) void perform(() => api(`/reservations/${reservation.id}`, { method: 'DELETE' }), t('Réservation annulée.')) }}>{t('Annuler la réservation')}</button></div>
    </form>}
    {creator && !!requests.length && <div className="mt-4 border-t border-line pt-4"><h4 className="mb-3 text-sm font-semibold">{t('Demandes de participation')}</h4><div className="space-y-2">{requests.map(request => <div className="flex flex-wrap items-center gap-2 text-sm" key={request.id}><span className="flex-1">{nameOf(request.user || request.requester || request)} · {requestText(request.status || 'pending')}</span>{editable && request.status === 'pending' && <><button className="secondary !px-2 !py-1 text-xs" disabled={busy} onClick={() => { void perform(() => api(`/reservations/${reservation.id}/requests/${request.id}`, json('PATCH', { status: 'accepted' })), t('Demande acceptée.'), false).then(ok => { if (ok) setRequests(values => values.map(value => value.id === request.id ? { ...value, status: 'accepted' } : value)) }) }}>{t('Accepter')}</button><button className="secondary !px-2 !py-1 text-xs" disabled={busy} onClick={() => { void perform(() => api(`/reservations/${reservation.id}/requests/${request.id}`, json('PATCH', { status: 'refused' })), t('Demande refusée.'), false).then(ok => { if (ok) setRequests(values => values.map(value => value.id === request.id ? { ...value, status: 'refused' } : value)) }) }}>{t('Refuser')}</button></>}</div>)}</div></div>}
  </article>
}

export default App
