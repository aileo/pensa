import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { api, ApiError, dateOf, initials, json, list, money, nameOf, type Family, type Household, type Id, type Occasion, type OccasionSelection, type Onboarding, type ParticipationRequest, type Person, type Reservation, type Todo, type Wish } from './api'
import { LanguageControl } from './language'
import { useTranslation } from './language-context'
import { localizeMessage, occasionLabel, occasionName, type Locale, type TranslationKey } from './locale'
import './index.css'

type Page = 'dashboard' | 'wishes' | 'families' | 'reservations' | 'history' | 'search' | 'profile'
type Modal = 'wish' | 'family' | 'occasion' | 'reservation' | 'tags' | 'offList' | null
type IconName = 'home' | 'heart' | 'users' | 'gift' | 'clock' | 'search' | 'user' | 'plus' | 'arrow' | 'link' | 'calendar' | 'trash' | 'edit' | 'check' | 'close' | 'menu' | 'logout' | 'spark' | 'grip' | 'chevron' | 'external'

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
}
function Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
function Avatar({ person, size = 'md' }: { person?: Person | null; size?: 'sm' | 'md' | 'lg' }) {
  return <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#eee5f7] font-bold text-[#795ca7] ${size === 'sm' ? 'size-8 text-xs' : size === 'lg' ? 'size-16 text-xl' : 'size-10 text-sm'}`}>{initials(person)}</span>
}
function Empty({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
  return <div className="card flex flex-col items-center px-5 py-14 text-center"><span className="mb-4 rounded-2xl bg-[#f3edf8] p-4 text-[#795ca7]"><Icon name={icon} size={28} /></span><h3 className="font-['Outfit'] text-xl font-semibold">{title}</h3><p className="muted mt-2 max-w-sm">{text}</p>{action && <div className="mt-5">{action}</div>}</div>
}
function SectionTitle({ kicker, title, action }: { kicker?: string; title: string; action?: ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div>{kicker && <p className="eyebrow mb-1">{kicker}</p>}<h2 className="font-['Outfit'] text-2xl font-semibold tracking-tight text-[#302939]">{title}</h2></div>{action}</div>
}
function WishCard({ wish, mine, onReserve, onTags, onDelete }: { wish: Wish; mine: boolean; onReserve: () => void; onTags?: () => void; onDelete?: () => void }) {
  const { t } = useTranslation()
  return <article className="card group flex h-full flex-col overflow-hidden">
    <div className="relative flex h-44 items-center justify-center bg-[#f4f0eb]">
      {wish.image ? <img src={wish.image} alt="" className="h-full w-full object-cover" loading="lazy" onError={event => { event.currentTarget.style.display = 'none' }} /> : <Icon name="gift" size={45} className="text-[#c6b9ce]" />}
      {wish.reservation && !mine && <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-[#765c9b]">{t('Réservé')}</span>}
    </div>
    <div className="flex flex-1 flex-col p-4">
      <div className="flex items-start justify-between gap-2"><h3 className="font-['Outfit'] text-base font-semibold leading-snug">{wish.title}</h3>{wish.price !== undefined && wish.price !== null && <span className="shrink-0 text-sm font-bold text-[#795ca7]">{money(wish.price)}</span>}</div>
      {wish.description && <p className="mt-2 line-clamp-2 text-sm text-[#847b8d]">{wish.description}</p>}
      {!!wish.tags?.length && <div className="mt-3 flex flex-wrap gap-1.5">{wish.tags.map(tag => <span className="chip" key={tag}>#{tag}</span>)}</div>}
      {!mine && wish.reservation && <p className="mt-3 text-xs text-[#807687]">{t('Réservé par {name}', { name: nameOf(wish.reservation.creator) })}{wish.reservation.openToContributions ? ` · ${t('Participation possible')}` : ''}</p>}
      <div className="mt-auto flex items-center gap-1 border-t border-[#f0edf1] pt-3" style={{ marginTop: 'auto', paddingTop: 12 }}>
        {wish.url && <a className="icon-button" href={wish.url} target="_blank" rel="noopener noreferrer" aria-label={t('Voir {title} sur le site marchand', { title: wish.title })}><Icon name="external" size={17} /></a>}
        {mine ? <div className="ml-auto flex gap-1"><button className="icon-button" onClick={onTags} aria-label={t('Modifier les tags de {title}', { title: wish.title })}><Icon name="edit" size={17}/></button><button className="icon-button hover:!text-red-600" onClick={onDelete} aria-label={t('Supprimer {title}', { title: wish.title })}><Icon name="trash" size={17}/></button></div>
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

  if (!authChecked) return <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-[#795ca7]"><LanguageControl/><p role="status">{t('Chargement de Giftit…')}</p></div>
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
  const openPerson = (person: Person) => {
    if (String(person.id) === String(me.id)) { go('wishes'); return }
    setPage('families'); setSelectedFamily(null); setSelectedPerson(person); setPersonWishes([]); setPersonGifts([]); setError(''); setNotice('')
  }
  const logout = async () => { const ok = await perform(() => api('/auth/logout', { method: 'POST' }), t('Déconnexion réussie.')); if (ok) onLogout() }
  const setPersonFilter = (key: keyof WishFilters, value: string) => {
    if (!selectedPerson) return
    setPersonFilterState({ ...personFilters, personId: String(selectedPerson.id), [key]: value })
  }

  return <div className="min-h-screen bg-[#faf9f7] lg:flex">
    {mobileNav && <button className="fixed inset-0 z-30 bg-[#241a35]/40 lg:hidden" aria-label={t('Fermer le menu')} onClick={() => setMobileNav(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-[#eee9ef] bg-white px-4 py-7 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}>
      <button className="mb-11 flex items-center gap-2.5 px-3 text-left" onClick={() => go('dashboard')} aria-label={t('Giftit, accueil')}><span className="flex size-10 items-center justify-center rounded-2xl bg-[#795ca7] text-white"><Icon name="gift" size={23}/></span><span className="font-['Outfit'] text-[27px] font-extrabold tracking-[-.06em] text-[#382d49]">giftit<span className="text-[#b5a0d3]">.</span></span></button>
      <span className="eyebrow mb-3 px-3">{t('Menu principal')}</span>
      <nav aria-label={t('Navigation principale')} className="space-y-1">
        {nav.map(item => <button key={item.page} onClick={() => go(item.page)} aria-current={page === item.page ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${page === item.page ? 'bg-[#f1eafa] text-[#7555a2]' : 'text-[#807789] hover:bg-[#faf7fc] hover:text-[#7555a2]'}`}><Icon name={item.icon} size={19}/>{t(item.label)}</button>)}
      </nav>
      <div className="mt-auto px-2">
        <div className="mb-5 rounded-2xl bg-[#f5f0f9] p-4"><Icon name="spark" size={20} className="mb-2 text-[#8566ae]"/><p className="font-['Outfit'] text-sm font-bold">{t('Rien à retenir')}</p><p className="mt-1 text-xs leading-relaxed text-[#84788d]">{t('Giftit suit les dates, les listes et les cadeaux à votre place.')}</p></div>
      </div>
    </aside>
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex h-[74px] items-center justify-between border-b border-[#eee9ef] bg-white/95 px-5 backdrop-blur md:px-9">
        <div className="flex items-center gap-3"><button className="icon-button lg:hidden" aria-label={t('Ouvrir le menu')} onClick={() => setMobileNav(true)}><Icon name="menu"/></button><p className="font-['Outfit'] text-lg font-semibold">{selectedPerson ? nameOf(selectedPerson) : selectedFamily ? selectedFamily.name : t(titleByPage[page])}</p></div>
        <div className="flex items-center gap-3"><button className="icon-button" aria-label={t('Rechercher')} onClick={() => go('search')}><Icon name="search"/></button><span className="hidden h-7 w-px bg-[#eee9ef] sm:block"/><ProfileMenu me={me} busy={busy} onProfile={() => go('profile')} onLogout={() => void logout()}/></div>
      </header>
      <main className="mx-auto max-w-[1300px] px-5 pb-16 pt-8 md:px-9 md:pt-10">
        {error && <div role="alert" className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{localizeMessage(error, locale)}<button aria-label={t('Masquer l’erreur')} onClick={() => setError('')}><Icon name="close" size={16}/></button></div>}
        {notice && <div role="status" className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{localizeMessage(notice, locale)}<button aria-label={t('Masquer la notification')} onClick={() => setNotice('')}><Icon name="close" size={16}/></button></div>}
        {loading && <p role="status" className="muted mb-3">{t('Actualisation des données…')}</p>}
        {page === 'dashboard' && <><div className="relative mb-8 overflow-hidden rounded-[26px] bg-[#eee6f6] px-7 py-9 sm:px-10 sm:py-11"><div className="relative z-10 max-w-[580px]"><p className="eyebrow mb-3">{t('VOTRE ORGANISATION DU JOUR')}</p><h1 className="font-['Outfit'] text-3xl font-bold leading-tight tracking-tight text-[#3e2e54] sm:text-[42px]">{t('Bonjour {name}', { name: me.firstName || t('vous') })} <span aria-hidden="true">👋</span></h1><p className="mt-3 max-w-md text-sm leading-relaxed text-[#766782] sm:text-base">{t('Voici ce qui arrive et ce qu’il reste à faire. Le reste vous attend ici, vous n’avez rien à retenir.')}</p><button className="primary mt-6" onClick={() => { setModal('wish'); setError('') }}><Icon name="plus" size={18}/> {t('Ajouter une envie')}</button></div><div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-20 size-72 rounded-full border-[38px] border-white/20 sm:right-0"/><div aria-hidden="true" className="pointer-events-none absolute -bottom-36 right-20 size-72 rounded-full bg-white/25"/></div>
          <div className="mb-9 grid gap-4 sm:grid-cols-3">{[
            { label: t('Mes envies'), count: myWishes.length, icon: 'heart' as IconName, color: 'bg-[#f2eafa] text-[#805fb0]', target: 'wishes' as Page },
            { label: t('Mes familles'), count: families.length, icon: 'users' as IconName, color: 'bg-[#fceee7] text-[#d18a65]', target: 'families' as Page },
            { label: t('Réservations'), count: reservations.length, icon: 'gift' as IconName, color: 'bg-[#eaf4f0] text-[#6d9e87]', target: 'reservations' as Page },
          ].map(stat => <button key={stat.target} onClick={() => go(stat.target)} className="card flex items-center gap-4 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md"><span className={`rounded-2xl p-3 ${stat.color}`}><Icon name={stat.icon} size={23}/></span><span><strong className="block font-['Outfit'] text-2xl">{stat.count}</strong><span className="muted">{stat.label}</span></span><Icon name="chevron" size={17} className="ml-auto text-[#c4b8c9]"/></button>)}</div>
          <Guidance me={me} onboarding={onboarding} todos={dashboardTodos} busy={busy} onAddWish={() => { setModal('wish'); setError('') }} onGo={go} onPerson={openPerson} onReservation={openReservation} onStatus={changeStatus}/>
          {dashboardOpenGifts.length > 0 && <div className="mb-9"><SectionTitle kicker={t('HORS LISTE')} title={t('Cadeaux ouverts aux participations')}/><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{dashboardOpenGifts.map(gift => <OffListGiftCard key={gift.id} gift={gift} me={me} busy={busy} showRecipient onRequest={() => void requestGift(gift)} onOpen={() => openReservation(gift.id)} onRecipient={gift.recipient ? () => openPerson(gift.recipient!) : undefined}/>)}</div></div>}
          <div className="mb-9 grid gap-5 lg:grid-cols-2">
            <div><SectionTitle kicker={t('À VENIR')} title={t('Les prochaines occasions')}/>{dashboardOccasions.length ? <div className="card divide-y divide-[#f0edf1]">{dashboardOccasions.slice(0, 4).map(occasion => <div key={`${occasion.id}-${occasion.person?.id}`} className="flex items-center gap-3 p-4"><span className="rounded-xl bg-[#f2eafa] p-2 text-[#795ca7]"><Icon name="calendar" size={19}/></span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{occasionLabel(occasion.name, locale, { kind: occasion.kind, year: occasion.nextDate ? Number(occasion.nextDate.slice(0, 4)) : null, birthDate: occasion.person?.birthDate })} · {nameOf(occasion.person)}</p><p className="muted">{dateOf(occasion.nextDate)}</p></div></div>)}</div> : <Empty icon="calendar" title={t('Aucune date à venir')} text={t('Les occasions de vos proches apparaîtront ici.')}/>}</div>
            <div><SectionTitle kicker={t('EN PRÉPARATION')} title={t('Les cadeaux partagés')}/>{dashboardReservations.length || dashboardParticipating.length ? <div className="card p-6"><p className="text-lg font-semibold">{t(dashboardReservations.length === 1 ? '{count} réservation organisée' : '{count} réservations organisées', { count: dashboardReservations.length })}</p><p className="muted mt-2">{t(dashboardParticipating.length === 1 ? '{count} cadeau auquel vous participez' : '{count} cadeaux auxquels vous participez', { count: dashboardParticipating.length })}</p><button className="secondary mt-5" onClick={() => go('reservations')}>{t('Voir les réservations')} <Icon name="arrow" size={16}/></button></div> : <Empty icon="gift" title={t('Encore rien à préparer')} text={t('Réservez une envie pour organiser un cadeau.')}/>}</div>
          </div>
          <SectionTitle kicker={t('POUR VOUS')} title={t('Les envies de vos proches')} action={<button className="text-sm font-semibold text-[#795ca7] hover:underline" onClick={() => go('families')}>{t('Voir la famille →')}</button>}/>
          {sharedWishes.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{sharedWishes.slice(0, 4).map(wish => <WishCard key={wish.id} wish={wish} mine={false} onReserve={() => openReserve(wish)}/>)}</div> : <Empty icon="users" title={t('Aucune envie partagée pour l’instant')} text={t('Les envies de vos proches apparaîtront ici dès qu’ils les partageront.')} action={<button className="secondary" onClick={() => go('families')}>{t('Voir ma famille')}</button>}/>}
        </>}
        {page === 'wishes' && <><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow mb-2">{t('VOTRE LISTE PERSONNELLE')}</p><h1 className="font-['Outfit'] text-3xl font-bold">{t('Mes envies')} <span className="text-[#ad98ca]">({myWishes.length})</span></h1><p className="muted mt-2">{t('Notez vos idées une fois : vos proches sauront quoi offrir.')}</p></div><button className="primary" onClick={() => { setModal('wish'); setError('') }}><Icon name="plus" size={18}/> {t('Ajouter une envie')}</button></div>{myWishes.length ? <><p className="muted mb-4">{t('Glissez les envies ou utilisez les flèches pour changer leur priorité.')}</p><div className="space-y-3">{myWishes.map((wish, index) => <div key={wish.id} draggable onDragStart={event => event.dataTransfer.setData('text/plain', String(index))} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const from = Number(event.dataTransfer.getData('text/plain')); if (Number.isInteger(from)) void reorder(from, index) }} className="card flex items-center gap-3 p-3 sm:gap-5 sm:p-4"><span className="hidden cursor-grab text-[#afa5b6] sm:block"><Icon name="grip"/></span><div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f3eff1] sm:size-20">{wish.image ? <img src={wish.image} alt="" className="h-full w-full object-cover"/> : <Icon name="gift" className="text-[#b9a9c8]"/>}</div><div className="min-w-0 flex-1"><h2 className="truncate font-['Outfit'] font-semibold">{wish.title}</h2><p className="muted mt-1 truncate">{wish.description || wish.url || t('Sans description')}</p><div className="mt-1 flex flex-wrap gap-1">{wish.tags?.map(tag => <span className="chip" key={tag}>#{tag}</span>)}</div></div><strong className="hidden text-sm text-[#795ca7] sm:block">{money(wish.price)}</strong><div className="flex shrink-0 flex-col items-center gap-1 sm:flex-row"><button className="icon-button !size-7" disabled={index === 0 || busy} onClick={() => reorder(index, index - 1)} aria-label={t('Monter {title}', { title: wish.title })}>↑</button><button className="icon-button !size-7" disabled={index === myWishes.length - 1 || busy} onClick={() => reorder(index, index + 1)} aria-label={t('Descendre {title}', { title: wish.title })}>↓</button><button className="icon-button" onClick={() => { setSelectedWish(wish); setModal('tags') }} aria-label={t('Modifier les tags de {title}', { title: wish.title })}><Icon name="edit" size={17}/></button><button className="icon-button hover:!text-red-600" onClick={() => removeWish(wish)} aria-label={t('Supprimer {title}', { title: wish.title })}><Icon name="trash" size={17}/></button></div></div>)}</div></> : <Empty icon="heart" title={t('Votre liste est encore vide')} text={t('Collez le lien d’un produit et nous vous aiderons à l’ajouter.')} action={<button className="primary" onClick={() => setModal('wish')}><Icon name="plus" size={18}/> {t('Ajouter une envie')}</button>}/>}</>}
        {page === 'families' && <><SectionTitle kicker={t('VOS PROCHES')} title={selectedPerson ? t('Les envies de {name}', { name: nameOf(selectedPerson) }) : selectedFamily ? selectedFamily.name : t('Ma famille')} action={selectedPerson || selectedFamily ? <button className="secondary" onClick={() => { setSelectedPerson(null); setSelectedFamily(null) }}>{t('← Retour aux familles')}</button> : undefined}/>
          {selectedPerson ? <>
            <div className="card mb-6 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div><label className="label" htmlFor="filter-tag">{t('Tag')}</label><input className="field" id="filter-tag" value={personFilters.tag} onChange={event => setPersonFilter('tag', event.target.value)} placeholder={t('Ex. : livres')}/></div>
              {String(selectedPerson.id) !== String(me.id) && <div><label className="label" htmlFor="filter-availability">{t('Disponibilité')}</label><select className="field" id="filter-availability" value={personFilters.availability} onChange={event => setPersonFilter('availability', event.target.value)}><option value="">{t('Toutes')}</option><option value="available">{t('Disponibles')}</option><option value="reserved">{t('Réservées')}</option></select></div>}
              <div><label className="label" htmlFor="filter-min-price">{t('Prix minimum (€)')}</label><input className="field" id="filter-min-price" type="number" min="0" step="0.01" value={personFilters.minPrice} onChange={event => setPersonFilter('minPrice', event.target.value)} placeholder="0"/></div>
              <div><label className="label" htmlFor="filter-max-price">{t('Prix maximum (€)')}</label><input className="field" id="filter-max-price" type="number" min="0" step="0.01" value={personFilters.maxPrice} onChange={event => setPersonFilter('maxPrice', event.target.value)} placeholder={t('Sans limite')}/></div>
            </div>
            {personWishes.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{personWishes.map(wish => <WishCard key={wish.id} wish={wish} mine={String(wish.ownerId) === String(me.id)} onReserve={() => openReserve(wish)} onTags={() => { setSelectedWish(wish); setModal('tags') }} onDelete={() => removeWish(wish)}/>)}</div> : <Empty icon="heart" title={t('Aucune envie trouvée')} text={t('Modifiez les filtres pour découvrir d’autres envies.')}/>}
            {String(selectedPerson.id) !== String(me.id) && <div className="mt-9"><SectionTitle kicker={t('SANS PASSER PAR LA LISTE')} title={t('Cadeaux prévus hors liste')} action={<button className="secondary" onClick={() => openOffList(selectedPerson)}><Icon name="plus" size={17}/> {t('Prévoir un cadeau hors liste')}</button>}/>{personGifts.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{personGifts.map(gift => <OffListGiftCard key={gift.id} gift={gift} me={me} busy={busy} onRequest={() => void requestGift(gift)} onOpen={() => openReservation(gift.id)}/>)}</div> : <p className="muted rounded-xl bg-[#f7f3f9] p-4">{t('Aucun cadeau hors liste partagé pour {name}. Une idée qui n’est pas sur sa liste ? Prévoyez-la ici, sans qu’il ou elle ne le voie.', { name: nameOf(selectedPerson) })}</p>}</div>}
          </>
            : activeFamily ? <><div className="card mb-6 flex flex-wrap items-center justify-between gap-3 p-5"><div><p className="eyebrow">{t('LES MEMBRES')}</p><p className="muted mt-1">{t('Découvrez les envies des membres de cette famille.')}</p></div>{activeFamily.admin && <button className="secondary" onClick={() => openOccasion(activeFamily)}><Icon name="calendar" size={18}/> {t('Ajouter une occasion')}</button>}</div>{activeFamily.households?.length ? <FamilyHouseholds family={activeFamily} me={me} onPerson={openPerson}/> : activeFamily.members?.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{activeFamily.members.map(person => <button key={person.id} onClick={() => openPerson(person)} className="card flex items-center gap-4 p-5 text-left hover:border-[#cbb8de]"><Avatar person={person}/><span className="flex-1 font-semibold">{nameOf(person)}</span><Icon name="chevron" size={17}/></button>)}</div> : <Empty icon="users" title={t('Aucun membre affiché')} text={t('Les membres de cette famille apparaîtront ici dès qu’ils seront disponibles.')}/ >}{activeFamily.admin && <FamilyManagement key={activeFamily.id} family={activeFamily} busy={busy} perform={perform} handleError={handleError} onRename={name => setSelectedFamily({ ...activeFamily, name })}/>}</>
            : <>
              {myHousehold && <HouseholdPanel household={myHousehold} me={me} isAdmin={isHouseholdAdmin} busy={busy} perform={perform} handleError={handleError} onPerson={openPerson}/>}
              <div className="mt-9"><SectionTitle kicker={t('LES FAMILLES DE MON FOYER')} title={t('Mes familles')} action={isHouseholdAdmin ? <button className="primary" onClick={() => setModal('family')}><Icon name="plus" size={18}/> {t('Créer une famille')}</button> : undefined}/>
              {families.length ? <div className="grid gap-5 lg:grid-cols-2">{families.map(family => <article className="card flex flex-col p-6" key={family.id}><div className="flex items-start gap-4"><div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#f2eafa] text-[#795ca7]"><Icon name="users" size={25}/></div><div className="min-w-0 flex-1"><h3 className="font-['Outfit'] text-xl font-semibold">{family.name}</h3><p className="muted mt-1">{family.admin ? t('Famille administrée') : t('Famille partagée')}</p></div></div>{!!family.households?.length && <ul className="mt-5 space-y-3">{family.households.map(household => <li key={household.id} className="rounded-xl bg-[#f9f6fb] p-3"><p className="text-sm font-semibold text-[#4a3c5c]">{household.name}</p><ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">{household.members?.map(member => <li key={member.id} className="flex flex-wrap items-center gap-1.5 text-sm"><span>{nameOf(member)}</span><RoleBadges person={member}/></li>)}</ul></li>)}</ul>}<div className="mt-5 flex gap-2"><button className="secondary flex-1 !px-2" onClick={() => { setSelectedFamily(family); setSelectedPerson(null) }}>{t('Voir la famille')} <Icon name="arrow" size={16}/></button>{family.admin && <button className="icon-button" onClick={() => openOccasion(family)} aria-label={t('Créer une occasion pour {name}', { name: family.name })}><Icon name="calendar" size={19}/></button>}</div></article>)}</div> : <Empty icon="users" title={isHouseholdAdmin ? t('Créez votre première famille') : t('Votre foyer ne fait partie d’aucune famille')} text={isHouseholdAdmin ? t('Réunissez les foyers avec qui vous organisez les cadeaux.') : t('Un admin de votre foyer peut créer une famille ou en rejoindre une.')} action={isHouseholdAdmin ? <button className="primary" onClick={() => setModal('family')}>{t('Créer une famille')}</button> : undefined}/>}
              {isHouseholdAdmin ? <JoinFamily busy={busy} perform={perform}/> : <p className="muted mt-6 rounded-xl bg-[#f7f3f9] p-4">{t('Seul un admin du foyer peut rejoindre ou créer une famille.')}</p>}</div>
              {otherHouseholds.length > 0 && <div className="mt-9"><SectionTitle kicker={t('DANS VOS FAMILLES')} title={t('Les autres foyers')}/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{otherHouseholds.map(household => <HouseholdCard key={household.id} household={household} me={me} onPerson={openPerson}/>)}</div></div>}
            </>}
        </>}
        {page === 'reservations' && <><SectionTitle kicker={t('CADEAUX EN PRÉPARATION')} title={t('Mes réservations')} action={<button className="secondary" onClick={() => openOffList()}><Icon name="plus" size={17}/> {t('Prévoir un cadeau hors liste')}</button>}/>{reservations.length ? <div className="space-y-4">{reservations.map(reservation => <ReservationRow key={reservation.id} reservation={reservation} me={me} users={allPeople} busy={busy} perform={perform} onStatus={changeStatus} focused={String(focusedReservation) === String(reservation.id)}/>)}</div> : <Empty icon="gift" title={t('Aucune réservation pour le moment')} text={t('Explorez les listes de vos proches pour leur préparer une surprise.')} action={<button className="primary" onClick={() => go('families')}>{t('Découvrir les envies')} <Icon name="arrow" size={17}/></button>}/>}</>}
        {page === 'history' && <><SectionTitle kicker={t('DÉJÀ OFFERT')} title={t('Historique')}/>{history.length ? <div className="card divide-y divide-[#f0edf1]">{history.map((entry, index) => { const item = entry as { id?: Id; snapshot?: { title?: string; recipient?: { birthDate?: string; birth_date?: string }; occasions?: { name: string; kind?: Occasion['kind']; year: number }[] }; created_at?: string }; const birthDate = item.snapshot?.recipient?.birthDate ?? item.snapshot?.recipient?.birth_date; return <div className="flex items-start gap-4 p-5" key={String(item.id ?? index)}><span className="rounded-xl bg-[#f2eafa] p-2.5 text-[#795ca7]"><Icon name="clock" size={19}/></span><div><p className="font-semibold">{item.snapshot?.title || t('Un cadeau offert')}</p><p className="muted mt-1">{item.snapshot?.occasions?.map(occasion => occasionWithYear(occasion, locale, birthDate)).join(', ')} · {dateOf(item.created_at)}</p></div></div> })}</div> : <Empty icon="clock" title={t('Rien d’offert pour l’instant')} text={t('Les cadeaux déjà offerts s’afficheront ici, pour éviter d’offrir deux fois la même chose.')}/>}</>}
        {page === 'search' && <><SectionTitle kicker={t('RECHERCHE')} title={t('Rechercher')}/><label htmlFor="global-search" className="label">{t('Personnes et envies')}</label><div className="relative mb-7"><Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a399ac]"/><input id="global-search" autoComplete="off" className="field !py-3 !pl-12" placeholder={t('Rechercher une personne, une envie…')} value={searchText} onChange={event => setSearchText(event.target.value)}/></div>{searchResults.length ? <div className="space-y-3">{searchResults.map((result, index) => { const item = result as Record<string, unknown>; const person = item as Person; const wish = item as Wish; const isWish = typeof item.title === 'string'; return <div key={String(item.id ?? index)} className="card flex items-center gap-4 p-4">{isWish ? <span className="rounded-xl bg-[#f2eafa] p-3 text-[#795ca7]"><Icon name="heart"/></span> : <Avatar person={person}/>}<div className="min-w-0 flex-1"><p className="truncate font-semibold">{isWish ? wish.title : nameOf(person)}</p><p className="muted">{isWish ? money(wish.price) || t('Envie cadeau') : t('Personne')}</p></div><button className="secondary !px-3 !py-2 text-sm" onClick={() => isWish ? String(wish.ownerId) === String(me.id) ? go('wishes') : openReserve(wish) : (setSelectedPerson(person), setPage('families'))}>{t('Voir')} <Icon name="arrow" size={15}/></button></div> })}</div> : <Empty icon="search" title={searchText ? t('Aucun résultat') : t('Que recherchez-vous ?')} text={searchText ? t('Essayez d’autres mots-clés.') : t('Retrouvez une personne ou une idée cadeau en quelques lettres.')}/>}</>}
        {page === 'profile' && <><SectionTitle kicker={t('VOTRE ESPACE')} title={t('Mon profil')}/><div className="card max-w-2xl p-6 sm:p-8"><div className="flex items-center gap-4 border-b border-[#eee9ef] pb-6"><Avatar person={me} size="lg"/><div><h2 className="font-['Outfit'] text-xl font-semibold">{nameOf(me)}</h2><p className="muted">{t('Votre compte Giftit')}</p></div></div><dl className="space-y-5 py-6"><div><dt className="eyebrow mb-1">{t('ADRESSE E-MAIL')}</dt><dd>{me.email || t('Non renseignée')}</dd></div><div><dt className="eyebrow mb-1">{t('DATE DE NAISSANCE')}</dt><dd>{dateOf(me.birthDate) || t('Non renseignée')}</dd></div></dl><ProfileForm me={me} busy={busy} perform={perform} onSaved={onProfile}/></div></>}
      </main>
    </div>
    {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#241a35]/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setModal(null) }}><div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[24px] bg-white p-6 shadow-2xl sm:p-8"><div className="mb-6 flex items-start justify-between gap-3"><div><p className="eyebrow mb-1">{t('GIFTIT')}</p><h2 id="modal-title" className="font-['Outfit'] text-2xl font-bold">{t(modal === 'wish' ? 'Ajouter une envie' : modal === 'family' ? 'Créer une famille' : modal === 'occasion' ? 'Nouvelle occasion' : modal === 'tags' ? 'Modifier les tags' : modal === 'offList' ? 'Prévoir un cadeau hors liste' : 'Réserver une envie')}</h2></div><button className="icon-button" onClick={() => setModal(null)} aria-label={t('Fermer')}><Icon name="close"/></button></div>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {modal === 'wish' && <WishForm busy={busy} perform={perform} handleError={handleError}/>}
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
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const data = new FormData(event.currentTarget)
    const fields = mode === 'register'
      ? {
          firstName: data.get('firstName'),
          lastName: data.get('lastName'),
          email: data.get('email'),
          password: data.get('password'),
          birthDate: data.get('birthDate'),
          ...(String(data.get('invitation') || '').trim() ? { invitation: String(data.get('invitation')).trim() } : {}),
        }
      : { email: data.get('email'), password: data.get('password') }
    if (mode === 'register' && String(data.get('password')).length < 12) {
      setError(t('Le mot de passe doit contenir au moins 12 caractères.'))
      setBusy(false)
      return
    }
    try {
      await api(`/auth/${mode}`, json('POST', fields))
      onAuth(await api<Person>('/auth/me'))
    } catch (problem) { setError(problem instanceof Error ? problem.message : t('Connexion impossible.')) }
    finally { setBusy(false) }
  }
  return <div className="grid min-h-screen lg:grid-cols-2">
    <div className="flex flex-col bg-[#f0e9f7] p-7 sm:p-12">
      <div className="flex items-center justify-between gap-2.5"><div className="flex items-center gap-2.5"><span className="flex size-10 items-center justify-center rounded-2xl bg-[#795ca7] text-white"><Icon name="gift"/></span><span className="font-['Outfit'] text-[27px] font-extrabold tracking-tight">giftit.</span></div><LanguageControl/></div>
      <div className="my-auto max-w-lg py-14">
        <span className="eyebrow">{t('FINI LA CHARGE MENTALE DES CADEAUX')}</span>
        <h1 className="mt-5 font-['Outfit'] text-4xl font-bold leading-[1.13] tracking-tight text-[#3e2e54] sm:text-6xl">{t('Organisez les cadeaux,')} <span className="text-[#9373bc]">{t('l’esprit tranquille.')}</span></h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-[#766782]">{t('Les envies de chacun, les dates qui arrivent, qui offre quoi : tout est au même endroit, et personne n’a à tout retenir.')}</p>
        <div className="mt-10 flex items-center gap-3 rounded-2xl bg-white/65 p-4 text-sm font-semibold text-[#5e5070]"><span className="rounded-xl bg-[#e6d9f3] p-2.5 text-[#795ca7]"><Icon name="heart"/></span> {t('Plus de doublons, plus de listes dans un coin de la tête.')}</div>
      </div>
      <p className="text-sm text-[#92849e]">{t('Giftit. L’organisation des cadeaux, en clair.')}</p>
    </div>
    <div className="flex items-center justify-center px-6 py-12"><div className="w-full max-w-[420px]">
      <p className="eyebrow mb-3">{t('BIENVENUE SUR GIFTIT')}</p>
      <h2 className="font-['Outfit'] text-3xl font-bold">{mode === 'login' ? t('Reprenez où vous en étiez') : t('Créons votre compte')}</h2>
      <p className="muted mb-8 mt-2">{mode === 'login' ? t('Connectez-vous pour retrouver vos listes et vos cadeaux en cours.') : t('Quelques informations suffisent pour commencer.')}</p>
      {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{localizeMessage(error, locale)}</p>}
      <form onSubmit={submit} className="space-y-4">
        {mode === 'register' && <>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="firstName">{t('Prénom')}</label><input className="field" id="firstName" name="firstName" autoComplete="given-name" required/></div>
            <div><label className="label" htmlFor="lastName">{t('Nom')}</label><input className="field" id="lastName" name="lastName" autoComplete="family-name" required/></div>
          </div>
          <div><label className="label" htmlFor="birthDate">{t('Date de naissance')}</label><input className="field" id="birthDate" name="birthDate" type="date" required/></div>
        </>}
        <div><label className="label" htmlFor="email">{t('Adresse e-mail')}</label><input className="field" id="email" name="email" type="email" autoComplete="email" placeholder={t('vous@exemple.fr')} required/></div>
        <div><label className="label" htmlFor="password">{t('Mot de passe')}</label><input className="field" id="password" name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 12 : undefined} required/></div>
        {mode === 'register' && <div><label className="label" htmlFor="invitation">{t('Code d’invitation')} <span className="font-normal">{t('(facultatif)')}</span></label><input className="field" id="invitation" name="invitation" type="text" autoComplete="off" placeholder={t('Votre code d’invitation')}/><p className="muted mt-1.5">{t('Un proche vous a invité dans son foyer ? Saisissez son code ici.')}</p></div>}
        <button disabled={busy} className="primary !mt-6 w-full">{busy ? t('Veuillez patienter…') : mode === 'login' ? t('Se connecter') : t('Créer mon compte')} <Icon name="arrow" size={17}/></button>
      </form>
      <p className="mt-7 text-center text-sm text-[#817688]">{mode === 'login' ? t('Pas encore de compte ?') : t('Déjà un compte ?')} <button className="font-bold text-[#795ca7] hover:underline" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>{mode === 'login' ? t('S’inscrire') : t('Se connecter')}</button></p>
    </div></div>
  </div>
}

function WishForm({ busy, perform, handleError }: { busy: boolean; perform: (action: () => Promise<unknown>, success: string) => Promise<boolean>; handleError: (error: unknown) => void }) {
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  const [preview, setPreview] = useState<Partial<Wish> | null>(null)
  const [loading, setLoading] = useState(false)
  async function fetchPreview() {
    setLoading(true)
    try { setPreview(await api<Partial<Wish>>('/wishes/preview', json('POST', { url }))) }
    catch (problem) { handleError(problem) }
    finally { setLoading(false) }
  }
  return <form onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); void perform(() => api('/wishes', json('POST', { url, title: data.get('title'), image: data.get('image') || '', description: data.get('description') || undefined, price: data.get('price') ? Number(data.get('price')) : undefined, tags: String(data.get('tags') || '').split(',').map(tag => tag.trim()).filter(Boolean) })), t('Envie ajoutée à votre liste.')) }}>
    <label className="label" htmlFor="product-url">{t('Lien du produit')}</label><div className="flex gap-2"><input className="field min-w-0" id="product-url" type="url" placeholder="https://example.com/product" value={url} onChange={event => { setUrl(event.target.value); setPreview(null) }} required/><button type="button" disabled={!url || loading} className="secondary shrink-0 !px-3 text-sm" onClick={fetchPreview}>{loading ? t('Chargement…') : t('Prévisualiser')}</button></div><p className="muted mt-1.5">{t('Collez un lien pour préremplir les informations.')}</p>
    {preview && <div className="mt-4 flex items-center gap-3 rounded-xl bg-[#f5f0f9] p-3">{preview.image && <img src={preview.image} alt="" className="size-14 rounded-lg object-cover"/>}<span className="text-sm font-semibold">{preview.title || t('Produit trouvé')}</span></div>}
    <div className="mt-5 space-y-4" key={preview?.url || preview?.title || 'empty'}><div><label className="label" htmlFor="product-title">{t('Nom de l’envie')}</label><input className="field" id="product-title" name="title" defaultValue={preview?.title || ''} required/></div><div><label className="label" htmlFor="product-image">{t('URL de l’image (obligatoire)')}</label><input className="field" id="product-image" name="image" type="url" defaultValue={preview?.image || ''} placeholder="https://…" required/></div><div><label className="label" htmlFor="product-description">{t('Description')} <span className="font-normal">{t('(facultatif)')}</span></label><textarea className="field min-h-20" id="product-description" name="description" defaultValue={preview?.description || ''}/></div><div className="grid grid-cols-2 gap-3"><div><label className="label" htmlFor="product-price">{t('Prix (€)')}</label><input className="field" id="product-price" name="price" type="number" min="0" step="0.01" defaultValue={preview?.price ?? ''}/></div><div><label className="label" htmlFor="product-tags">{t('Tags')}</label><input className="field" id="product-tags" name="tags" defaultValue={preview?.tags?.join(', ') || ''} placeholder={t('livre, déco')}/></div></div></div><button disabled={busy} className="primary mt-6 w-full"><Icon name="plus" size={17}/> {t('Ajouter à ma liste')}</button>
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
        {familyCode && <div role="status" className="mt-3 rounded-xl bg-[#f2eafa] p-3"><p className="mb-1 text-sm font-semibold">{t('Code d’invitation à la famille (visible uniquement maintenant)')}</p><output className="block break-all font-mono text-sm text-[#634797]">{familyCode}</output></div>}
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
    {person.householdAdmin && <span className="rounded-full bg-[#f2eafa] px-2 py-0.5 text-[11px] font-bold text-[#6f519c]">{t('Admin du foyer')}</span>}
    {person.familyAdmin && <span className="rounded-full bg-[#fceee7] px-2 py-0.5 text-[11px] font-bold text-[#b86f4a]">{t('Admin de la famille')}</span>}
  </>
}

function PersonRow({ person, me, onPerson, children }: { person: Person; me: Person; onPerson: (person: Person) => void; children?: ReactNode }) {
  const { t } = useTranslation()
  const self = String(person.id) === String(me.id)
  return <li className="flex flex-wrap items-center gap-3 py-3">
    <button className="flex min-w-0 flex-1 items-center gap-3 text-left hover:text-[#6f519c]" onClick={() => onPerson(person)} aria-label={self ? t('Voir mes envies') : t('Voir les envies de {name}', { name: nameOf(person) })}>
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
    <div className="flex items-center gap-3"><span className="rounded-xl bg-[#f2eafa] p-2 text-[#795ca7]"><Icon name="home" size={19}/></span><h3 className="font-['Outfit'] text-lg font-semibold">{household.name}</h3></div>
    {household.members?.length ? <ul className="mt-2 divide-y divide-[#f0edf1]">{household.members.map(member => <PersonRow key={member.id} person={member} me={me} onPerson={onPerson}/>)}</ul> : <p className="muted mt-3">{t('Aucun membre affiché')}</p>}
  </article>
}

function HouseholdPanel({ household, me, isAdmin, busy, perform, handleError, onPerson }: {
  household: Household; me: Person; isAdmin: boolean; busy: boolean;
  perform: (action: () => Promise<unknown>, success: string, close?: boolean) => Promise<boolean>;
  handleError: (error: unknown) => void; onPerson: (person: Person) => void
}) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [generating, setGenerating] = useState(false)
  const members = household.members ?? []
  const adminCount = members.filter(member => member.householdAdmin).length
  async function invite() {
    setGenerating(true); setCode('')
    try { setCode((await api<{ code: string }>(`/households/${household.id}/invitations`, json('POST', {}))).code) }
    catch (problem) { handleError(problem) }
    finally { setGenerating(false) }
  }
  return <section aria-labelledby="my-household-title">
    <div className="mb-5"><p className="eyebrow mb-1">{t('MON FOYER')}</p><h2 id="my-household-title" className="font-['Outfit'] text-2xl font-semibold tracking-tight text-[#302939]">{household.name}</h2><p className="muted mt-1">{t('Les personnes qui vivent avec vous. Votre foyer rejoint les familles ensemble.')}</p></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="card p-5 sm:p-6">
        <h3 className="label">{t('Membres du foyer')}</h3>
        <ul className="divide-y divide-[#f0edf1]">{members.map(member => {
          const lastAdmin = member.householdAdmin && adminCount <= 1
          return <PersonRow key={member.id} person={member} me={me} onPerson={onPerson}>
            {isAdmin && <button className="secondary !px-3 !py-1.5 text-xs" disabled={busy || lastAdmin} title={lastAdmin ? t('Un foyer doit conserver un administrateur') : undefined}
              onClick={() => void perform(() => api(`/households/${household.id}/members/${member.id}`, json('PATCH', { admin: !member.householdAdmin })), member.householdAdmin ? t('Droits d’admin retirés.') : t('Droits d’admin accordés.'), false)}>
              {member.householdAdmin ? t('Retirer l’admin') : t('Nommer admin')}</button>}
          </PersonRow>
        })}</ul>
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
          {code && <div role="status" className="mt-3 rounded-xl bg-[#f2eafa] p-3"><p className="mb-1 text-sm font-semibold">{t('Code d’invitation au foyer pour l’inscription (visible uniquement maintenant)')}</p><output className="block break-all font-mono text-sm text-[#634797]">{code}</output></div>}
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
    <button ref={trigger} className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-[#f5f0f9]" aria-haspopup="true" aria-expanded={open} aria-controls="account-menu" aria-label={t('Menu du compte')} onClick={() => setOpen(value => !value)}>
      <Avatar person={me} size="sm"/><span className="hidden max-w-[140px] truncate text-sm font-semibold sm:block">{nameOf(me)}</span><Icon name="chevron" size={14} className={`transition ${open ? '-rotate-90' : 'rotate-90'}`}/>
    </button>
    {open && <div id="account-menu" className="absolute right-0 top-12 z-30 w-64 rounded-2xl border border-[#eee9ef] bg-white p-2 shadow-xl">
      <div className="border-b border-[#f0edf1] px-3 pb-3 pt-2"><p className="truncate font-semibold">{nameOf(me)}</p>{me.email && <p className="muted truncate">{me.email}</p>}</div>
      <button className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-[#f5f0f9]" onClick={() => { setOpen(false); onProfile() }}><Icon name="user" size={18}/>{t('Mon profil')}</button>
      <div className="px-3 py-2.5"><LanguageControl/></div>
      <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-[#f5f0f9]" disabled={busy} onClick={() => { setOpen(false); onLogout() }}><Icon name="logout" size={18}/>{t('Se déconnecter')}</button>
    </div>}
  </div>
}

function ProfileForm({ me, busy, perform, onSaved }: {
  me: Person; busy: boolean;
  perform: (action: () => Promise<unknown>, success: string, close?: boolean) => Promise<boolean>; onSaved: (person: Person) => void
}) {
  const { locale, t } = useTranslation()
  const months = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, index, 1))))
  const [month, day] = me.nameDay ? me.nameDay.split('-') : ['', '']
  return <form className="space-y-4 border-t border-[#eee9ef] pt-6" onSubmit={event => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const nameMonth = String(data.get('nameDayMonth') ?? ''), nameDay = String(data.get('nameDayDay') ?? '')
    void perform(async () => {
      if (!!nameMonth !== !!nameDay) throw new Error(t('Choisissez le jour et le mois de votre fête.'))
      const person = await api<Person>('/profile', json('PATCH', {
        firstName: String(data.get('firstName')).trim(), lastName: String(data.get('lastName')).trim(),
        nameDay: nameMonth ? `${nameMonth}-${nameDay}` : null,
      }))
      onSaved(person)
    }, t('Profil mis à jour.'), false)
  }}>
    <h3 className="font-['Outfit'] text-lg font-semibold">{t('Modifier mon profil')}</h3>
    <div className="grid gap-4 sm:grid-cols-2">
      <div><label className="label" htmlFor="profile-first-name">{t('Prénom')}</label><input className="field" id="profile-first-name" name="firstName" defaultValue={me.firstName} required/></div>
      <div><label className="label" htmlFor="profile-last-name">{t('Nom')}</label><input className="field" id="profile-last-name" name="lastName" defaultValue={me.lastName} required/></div>
    </div>
    <fieldset>
      <legend className="label">{t('Date de fête')}</legend>
      <p className="muted mb-2">{t('Utilisée pour l’occasion « Fête » dans vos familles.')}</p>
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="profile-name-day-day">{t('Jour')}</label>
        <select className="field !w-auto" id="profile-name-day-day" name="nameDayDay" defaultValue={day}><option value="">{t('Jour')}</option>{Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0')).map(value => <option key={value} value={value}>{Number(value)}</option>)}</select>
        <label className="sr-only" htmlFor="profile-name-day-month">{t('Mois')}</label>
        <select className="field !w-auto" id="profile-name-day-month" name="nameDayMonth" defaultValue={month}><option value="">{t('Mois')}</option>{months.map((label, index) => <option key={label} value={String(index + 1).padStart(2, '0')}>{label}</option>)}</select>
      </div>
    </fieldset>
    <button disabled={busy} className="primary">{t('Enregistrer')}</button>
  </form>
}

const onboardingKey = (me: Person) => `giftit-onboarding-dismissed-${me.id}`
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
  const statusTodos: Partial<Record<Todo['type'], { verb: TranslationKey; done: TranslationKey; next: ReservationStatus }>> = {
    reservation_to_buy: { verb: 'Acheter « {title} » pour {name}', done: 'C’est acheté', next: 'purchased' },
    reservation_to_wrap: { verb: 'Emballer « {title} » pour {name}', done: 'C’est emballé', next: 'wrapped' },
    reservation_to_give: { verb: 'Offrir « {title} » à {name}', done: 'C’est offert', next: 'gifted' },
  }
  const describe = (todo: Todo) => {
    const name = nameOf(todo.person), occasion = occasionLabel(todo.occasion, locale, { year: todo.date ? Number(todo.date.slice(0, 4)) : null, birthDate: todo.person?.birthDate }), date = dateOf(todo.date), title = todo.reservation?.wishTitle ?? ''
    if (todo.type === 'occasion_without_gift') return { text: t('{occasion} de {name} le {date} : aucun cadeau prévu', { occasion: occasionName(todo.occasion, locale), name, date }), action: t('Voir ses envies'), icon: 'calendar' as IconName, run: () => todo.person && onPerson(todo.person) }
    const step = statusTodos[todo.type]
    if (step && todo.reservation) {
      const reservation = todo.reservation
      return { text: t(step.verb, { title, name }), detail: todo.date ? t('{occasion} le {date}', { occasion, date }) : undefined,
        action: t('Voir'), icon: 'gift' as IconName, run: () => onReservation(reservation.id),
        primary: step.next === 'gifted' && reservation.wishDeleted ? undefined : { label: t(step.done), run: () => void onStatus(reservation.id, step.next, title) } }
    }
    return { text: t(todo.count === 1 ? '{count} demande de participation à traiter pour « {title} »' : '{count} demandes de participation à traiter pour « {title} »', { count: todo.count ?? 0, title }), action: t('Répondre'), icon: 'users' as IconName, run: () => todo.reservation ? onReservation(todo.reservation.id) : onGo('reservations') }
  }
  return <div className={`mb-9 grid gap-5 ${showChecklist ? 'lg:grid-cols-2' : ''}`}>
    {showChecklist && <section className="card p-5 sm:p-6" aria-labelledby="onboarding-title">
      <div className="mb-4 flex items-start justify-between gap-3"><div><p className="eyebrow mb-1">{t('BIEN DÉMARRER')}</p><h2 id="onboarding-title" className="font-['Outfit'] text-xl font-semibold">{t('{done} étapes sur {total}', { done: doneCount, total: steps.length })}</h2></div><button className="icon-button" onClick={dismiss} aria-label={t('Masquer le guide de démarrage')}><Icon name="close" size={16}/></button></div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-[#f2eafa]" aria-hidden="true"><div className="h-full rounded-full bg-[#795ca7]" style={{ width: `${(doneCount / steps.length) * 100}%` }}/></div>
      <ul className="space-y-2">{steps.map(step => <li key={step.label} className="flex items-center gap-3 rounded-xl px-2 py-2">
        <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${step.done ? 'bg-[#6d9e87] text-white' : 'border-2 border-[#ddd2e8]'}`}>{step.done && <Icon name="check" size={14}/>}</span>
        <span className={`flex-1 text-sm ${step.done ? 'text-[#a39aab] line-through' : 'font-semibold'}`}>{step.label}{step.done && <span className="sr-only"> ({t('terminé')})</span>}</span>
        {!step.done && <button className="secondary !px-3 !py-1.5 text-xs" onClick={step.run}>{step.action}</button>}
      </li>)}</ul>
    </section>}
    <section className="card p-5 sm:p-6" aria-labelledby="todo-title">
      <p className="eyebrow mb-1">{t('PROCHAINES ÉTAPES')}</p><h2 id="todo-title" className="mb-4 font-['Outfit'] text-xl font-semibold">{t('À faire')}</h2>
      {todos.length ? <ul className="divide-y divide-[#f0edf1]">{todos.map((todo, index) => { const item: { text: string; detail?: string; action: string; icon: IconName; run: () => void; primary?: { label: string; run: () => void } } = describe(todo); return <li key={`${todo.type}-${todo.person?.id ?? ''}-${todo.reservation?.id ?? ''}-${index}`} className={`flex flex-wrap items-center gap-3 py-3 ${todo.urgent ? '-mx-2 rounded-xl bg-[#fff6ef] px-2' : ''}`}>
        <span className={`rounded-xl p-2 ${todo.urgent ? 'bg-[#fbe3d3] text-[#b86f4a]' : 'bg-[#f2eafa] text-[#795ca7]'}`}><Icon name={item.icon} size={18}/></span>
        <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 text-sm font-semibold">{item.text}{todo.urgent && <span className="rounded-full bg-[#b86f4a] px-2 py-0.5 text-[11px] font-bold text-white">{t('Bientôt')}</span>}</span>{item.detail && <span className="muted block text-xs">{item.detail}</span>}</span>
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
    <input type="checkbox" className="accent-[#795ca7]" checked={selected.some(value => sameSelection(value, selection))} onChange={() => onToggle(selection)}/>
    {occasionLabel(occasion.name || occasion.title, locale, { kind: occasion.kind, year: selection.year, birthDate: person?.birthDate }) || t('Occasion')} <span className="text-[#9a91a0]">{date ? dateOf(date) : t('année {year}', { year: selection.year })}</span>
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
        <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${done ? 'bg-[#6d9e87] text-white' : active ? 'bg-[#795ca7] text-white ring-4 ring-[#f2eafa]' : 'border-2 border-[#ddd2e8] text-[#a39aab]'}`}>{done ? <Icon name="check" size={13}/> : index + 1}</span>
        <span className={`truncate text-xs ${active ? 'font-bold text-[#4a3c5c]' : done ? 'text-[#6d9e87]' : 'text-[#a39aab]'}`}>{t(statusLabels[step])}</span>
        {index < statusOrder.length - 1 && <span aria-hidden="true" className={`mx-1 h-0.5 min-w-3 flex-1 rounded-full ${index < current ? 'bg-[#6d9e87]' : 'bg-[#eee9ef]'}`}/>}
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
  if (existing && !mine) return <div><p className="mb-4 text-sm text-[#807687]">{t('Cette envie est réservée par')} <strong>{nameOf(existing.creator)}</strong>.</p>{existing.participants?.length ? <p className="muted mb-4">{t('Participants :')} {existing.participants.map(nameOf).join(', ')}</p> : null}{existing.participants?.some(person => String(person.id) === String(me.id)) ? <p className="muted">{t('Vous participez déjà à ce cadeau.')}</p> : existing.openToContributions ? <button disabled={busy} className="primary w-full" onClick={() => { void perform(() => api(`/reservations/${existing.id}/requests`, json('POST', {})), t('Demande de participation envoyée.')) }}>{t('Demander à participer')}</button> : <p className="muted">{t('Cette réservation n’est pas ouverte aux participations.')}</p>}</div>
  const options = occurrences(occasions, existing?.occasions)
  const owner = people.find(person => String(person.id) === String(wish.ownerId))
  return <form onSubmit={event => { event.preventDefault(); const body = { occasionIds: selectedOccasions, participantIds: selectedParticipants, openToContributions: open }; void perform(() => existing ? api(`/reservations/${existing.id}`, json('PATCH', body)) : api('/reservations', json('POST', { wishId: wish.id, ...body })), existing ? t('Réservation mise à jour.') : t('Envie réservée !')) }}>
    <p className="muted mb-5">{t('Pour')} <strong className="text-[#4b3e59]">{wish.title}</strong></p>
    <fieldset className="mb-5"><legend className="label">{t('Occasions (au moins une)')}</legend>    {options.length ? <OccasionPicker options={options} selected={selectedOccasions} person={owner} onToggle={selection => { changedOccasions.current = true; setSelectedOccasions(values => values.some(value => sameSelection(value, selection)) ? values.filter(value => !sameSelection(value, selection)) : [...values, selection]) }}/> : <p className="muted">{t('Aucune occasion datée pour cette personne. Créez une occasion dans une famille commune avant de réserver.')}</p>}</fieldset>
    <fieldset className="mb-5"><legend className="label">{t('Inviter des participants')}</legend><div className="max-h-32 space-y-2 overflow-y-auto">{people.filter(person => String(person.id) !== String(me.id) && String(person.id) !== String(wish.ownerId)).map(person => <label key={person.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[#795ca7]" checked={selectedParticipants.some(id => String(id) === String(person.id))} onChange={() => togglePerson(person.id)}/>{nameOf(person)}</label>)}</div></fieldset>
    <label className="mb-5 flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[#795ca7]" checked={open} onChange={event => setOpen(event.target.checked)}/>{t('Autoriser les demandes de participation')}</label>
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
    {recipient ? <p className="mb-5 text-sm">{t('Pour')} <strong className="text-[#4b3e59]">{nameOf(recipient)}</strong></p>
      : <div className="mb-5"><label className="label" htmlFor="off-list-recipient">{t('Pour qui ?')}</label><select className="field" id="off-list-recipient" value={recipientId} onChange={event => { setRecipientId(event.target.value); setOccasions([]); setSelectedOccasions([]); setSelectedParticipants(values => values.filter(value => String(value) !== event.target.value)) }} required><option value="">{t('Choisir une personne')}</option>{candidates.map(person => <option key={person.id} value={String(person.id)}>{nameOf(person)}</option>)}</select></div>}
    <GiftFields/>
    <fieldset className="my-5"><legend className="label">{t('Occasions (au moins une)')}</legend>{!recipientId ? <p className="muted">{t('Choisissez d’abord une personne.')}</p> : loadError ? <p role="alert" className="text-sm text-red-700">{localizeMessage(loadError, locale)}</p>     : options.length ? <OccasionPicker options={options} selected={selectedOccasions} person={people.find(person => String(person.id) === recipientId) ?? recipient} onToggle={selection => setSelectedOccasions(values => toggle(values, selection, sameSelection))}/> : <p className="muted">{t('Aucune occasion datée pour cette personne. Créez une occasion dans une famille commune avant de réserver.')}</p>}</fieldset>
    {recipientId && <fieldset className="mb-5"><legend className="label">{t('Inviter des participants')}</legend><div className="max-h-32 space-y-2 overflow-y-auto">{candidates.filter(person => String(person.id) !== recipientId).map(person => <label key={person.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[#795ca7]" checked={selectedParticipants.some(id => String(id) === String(person.id))} onChange={() => setSelectedParticipants(values => toggle(values, person.id, (a, b) => String(a) === String(b)))}/>{nameOf(person)}</label>)}</div></fieldset>}
    <label className="mb-1 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 accent-[#795ca7]" checked={open} onChange={event => setOpen(event.target.checked)}/><span>{t('Visible et ouvert aux participations')}<span className="muted block">{t('Les proches du bénéficiaire le verront et pourront demander à participer. Sinon, seuls vous et les participants invités le voient.')}</span></span></label>
    <button disabled={busy || !recipientId || selectedOccasions.length === 0} className="primary mt-5 w-full">{t('Prévoir ce cadeau')}</button>
  </form>
}

function OffListGiftCard({ gift, me, busy, showRecipient, onRequest, onOpen, onRecipient }: { gift: Reservation; me: Person; busy: boolean; showRecipient?: boolean; onRequest: () => void; onOpen: () => void; onRecipient?: () => void }) {
  const { locale, t } = useTranslation()
  const involved = String(gift.creator?.id) === String(me.id) || !!gift.participants?.some(person => String(person.id) === String(me.id))
  return <article className="card flex flex-col p-5">
    <div className="flex items-start gap-3">{gift.wish?.image ? <img src={gift.wish.image} alt="" className="size-12 shrink-0 rounded-xl object-cover"/> : <span className="rounded-xl bg-[#fceee7] p-2.5 text-[#d18a65]"><Icon name="gift" size={21}/></span>}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-['Outfit'] font-semibold">{gift.wish?.title}</h3>{!gift.openToContributions && <span className="chip">{t('Privé')}</span>}</div>{showRecipient && gift.recipient && <p className="text-sm font-medium text-[#4b3e59]">{t('Pour')} {onRecipient ? <button className="font-semibold text-[#795ca7] hover:underline" onClick={onRecipient}>{nameOf(gift.recipient)}</button> : nameOf(gift.recipient)}</p>}{gift.wish?.price != null && <p className="text-sm font-semibold text-[#795ca7]">{money(gift.wish.price)}</p>}</div></div>
    {gift.wish?.description && <p className="muted mt-3 line-clamp-3">{gift.wish.description}</p>}
    {gift.wish?.url && <a className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#795ca7] hover:underline" href={gift.wish.url} target="_blank" rel="noreferrer"><Icon name="external" size={14}/> {t('Voir le lien')}</a>}
    <p className="muted mt-3">{gift.occasions?.map(item => occasionWithYear(item, locale, gift.recipient?.birthDate)).join(', ')}</p>
    <p className="muted mt-1">{t('Organisé par')} {nameOf(gift.creator)} · {t('Participants :')} {gift.participants?.map(nameOf).join(', ') || t('Aucun')}</p>
    <div className="mt-auto pt-4">{involved ? <button className="secondary w-full !py-2 text-sm" onClick={onOpen}>{t('Voir dans mes réservations')} <Icon name="arrow" size={15}/></button>
      : gift.requestStatus === 'pending' ? <p className="rounded-xl bg-[#f7f3f9] p-2 text-center text-sm text-[#6f6479]">{t('Demande envoyée, en attente de réponse.')}</p>
        : gift.requestStatus === 'refused' ? <p className="rounded-xl bg-[#f7f3f9] p-2 text-center text-sm text-[#6f6479]">{t('Votre demande a été refusée.')}</p>
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
  return <article ref={card} id={`reservation-${reservation.id}`} className={`card scroll-mt-24 p-5 ${focused ? 'ring-2 ring-[#795ca7]' : ''}`}>
    <div className="flex flex-wrap items-start gap-4">{reservation.wish?.image ? <img src={reservation.wish.image} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover"/> : <span className="rounded-2xl bg-[#f2eafa] p-3 text-[#795ca7]"><Icon name="gift" size={23}/></span>}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-['Outfit'] text-lg font-semibold">{reservation.wish?.title || t('Réservation #{id}', { id: String(reservation.id).slice(0, 8) })}</h3>{reservation.offList && <span className="chip !bg-[#fceee7] !text-[#b86f4b]">{t('Hors liste')}</span>}{reservation.offList && <span className="chip">{reservation.openToContributions ? t('Visible par la famille') : t('Privé')}</span>}</div>{reservation.recipient && <p className="mt-1 text-sm font-medium text-[#4b3e59]">{t('Pour')} {nameOf(reservation.recipient)}{reservation.offList && reservation.wish?.price != null && <> · {money(reservation.wish.price)}</>}</p>}{reservation.offList && reservation.wish?.description && <p className="muted mt-1">{reservation.wish.description}</p>}{reservation.offList && reservation.wish?.url && <a className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[#795ca7] hover:underline" href={reservation.wish.url} target="_blank" rel="noreferrer"><Icon name="external" size={14}/> {t('Voir le lien')}</a>}<p className="muted mt-1">{occasionSummary(reservation.occasions) || t('Cadeau en préparation')} · {reservation.cancelled ? t('Annulé') : statusText(reservation.status || 'reserved')}</p><p className="muted mt-1">{t('Organisé par')} {nameOf(reservation.creator)} · {t('Participants :')} {reservation.participants?.map(nameOf).join(', ') || t('Aucun')}</p>{reservation.wishDeleted && !reservation.offList && <p className="muted">{t('L’envie a été supprimée.')}</p>}</div>{editable && <button className="secondary text-sm" onClick={() => void openEditor()}><Icon name="edit" size={16}/> {editing ? t('Fermer') : t('Gérer')}</button>}</div>
    {!reservation.cancelled && reservation.status && <div className="mt-4 space-y-3 rounded-2xl bg-[#faf8fb] p-4">
      <StatusStepper status={current}/>
      {editable && <div className="flex flex-wrap gap-2">
        {nextLabel && <button className="primary !py-2 text-sm" disabled={busy || (next === 'gifted' && reservation.wishDeleted)} onClick={() => void onStatus(reservation.id, next, reservation.wish?.title)}><Icon name="check" size={16}/> {t(nextLabel)}</button>}
        {backLabel && <button className="secondary !py-2 text-sm" disabled={busy} onClick={() => void onStatus(reservation.id, previous!)}>{t(backLabel)}</button>}
      </div>}
      {editable && next === 'gifted' && reservation.wishDeleted && <p className="muted text-xs">{t('L’envie a été supprimée : impossible de la marquer comme offerte.')}</p>}
      {!creator && current !== 'gifted' && <p className="muted text-xs">{t('Seul l’organisateur peut faire avancer ce cadeau.')}</p>}
    </div>}
    {localError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{localError}</p>}
    {editing && <form className="mt-5 space-y-4 border-t border-[#eee9ef] pt-5" onSubmit={event => { event.preventDefault(); const body = { occasionIds, participantIds, openToContributions: open, ...(reservation.offList ? { gift: giftBody(new FormData(event.currentTarget)) } : {}) }; void perform(() => api(`/reservations/${reservation.id}`, json('PATCH', body)), t('Réservation mise à jour.'), false).then(ok => { if (ok) setEditing(false) }) }}>
      {reservation.offList && reservation.wish && <GiftFields gift={reservation.wish}/>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[#795ca7]" checked={open} onChange={event => setOpen(event.target.checked)}/>{reservation.offList ? t('Visible et ouvert aux participations') : t('Ouvert aux participations')}</label>
      <fieldset><legend className="label">{t('Occasions (au moins une)')}</legend><OccasionPicker options={options} selected={occasionIds} person={recipient} onToggle={selection => setOccasionIds(values => values.some(value => sameSelection(value, selection)) ? values.filter(value => !sameSelection(value, selection)) : [...values, selection])}/></fieldset>
      <fieldset><legend className="label">{t('Participants')}</legend>{recipientId ? <div className="flex max-h-32 flex-wrap gap-3 overflow-y-auto">{users.filter(person => String(person.id) !== String(me.id) && String(person.id) !== String(recipientId)).map(person => <label className="inline-flex items-center gap-2 text-sm" key={person.id}><input type="checkbox" checked={participantIds.some(id => String(id) === String(person.id))} onChange={() => setParticipantIds(values => values.some(id => String(id) === String(person.id)) ? values.filter(id => String(id) !== String(person.id)) : [...values, person.id])}/>{nameOf(person)}</label>)}</div> : <p className="muted">{t('Participants existants conservés ; détails de l’envie indisponibles.')}</p>}</fieldset>
      <div className="flex flex-wrap gap-2"><button className="primary" disabled={busy || occasionIds.length === 0}>{t('Enregistrer')}</button><button type="button" className="secondary !text-red-600" disabled={busy} onClick={() => { if (window.confirm(t('Annuler cette réservation ?'))) void perform(() => api(`/reservations/${reservation.id}`, { method: 'DELETE' }), t('Réservation annulée.')) }}>{t('Annuler la réservation')}</button></div>
    </form>}
    {creator && !!requests.length && <div className="mt-4 border-t border-[#eee9ef] pt-4"><h4 className="mb-3 text-sm font-semibold">{t('Demandes de participation')}</h4><div className="space-y-2">{requests.map(request => <div className="flex flex-wrap items-center gap-2 text-sm" key={request.id}><span className="flex-1">{nameOf(request.user || request.requester || request)} · {requestText(request.status || 'pending')}</span>{editable && request.status === 'pending' && <><button className="secondary !px-2 !py-1 text-xs" disabled={busy} onClick={() => { void perform(() => api(`/reservations/${reservation.id}/requests/${request.id}`, json('PATCH', { status: 'accepted' })), t('Demande acceptée.'), false).then(ok => { if (ok) setRequests(values => values.map(value => value.id === request.id ? { ...value, status: 'accepted' } : value)) }) }}>{t('Accepter')}</button><button className="secondary !px-2 !py-1 text-xs" disabled={busy} onClick={() => { void perform(() => api(`/reservations/${reservation.id}/requests/${request.id}`, json('PATCH', { status: 'refused' })), t('Demande refusée.'), false).then(ok => { if (ok) setRequests(values => values.map(value => value.id === request.id ? { ...value, status: 'refused' } : value)) }) }}>{t('Refuser')}</button></>}</div>)}</div></div>}
  </article>
}

export default App
