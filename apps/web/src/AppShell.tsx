import { useCallback, useEffect, useState } from 'react'
import { api, dateOf, json, list, money, nameOf, type Family, type Household, type Id, type Occasion, type Onboarding, type Person, type Reservation, type Todo, type Wish } from './api'
import { localizeMessage, occasionLabel, type TranslationKey } from './locale'
import { useTranslation } from './language-context'
import { Avatar } from './components/atoms/Avatar'
import { Icon, type IconName } from './components/atoms/Icon'
import { Empty, SectionTitle } from './components/molecules/Empty'
import { ManagedListsBar } from './components/molecules/ManagedListsBar'
import { SortableWishList } from './components/organisms/SortableWishList'
import { WishCard } from './components/organisms/WishCard'
import { type Modal, type Page, type ReservationStatus, type WishFilters } from './app-types'
import { FamilyHouseholds, FamilyManagement, HouseholdCard, HouseholdPanel, JoinFamily, OccasionForm, RoleBadges } from './features/families/FamilyComponents'
import { Guidance } from './features/dashboard/Guidance'
import { ProfileForm, ProfileMenu } from './features/profile/ProfileComponents'
import { OffListForm, OffListGiftCard, ReservationForm, ReservationRow } from './features/reservations/ReservationComponents'
import { occasionWithYear, statusNotices } from './features/reservations/model'
import { WishForm } from './features/wishes/WishForm'

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
const emptyWishFilters: WishFilters = { tag: '', availability: '', minPrice: '', maxPrice: '' }

export function AuthenticatedApp({ me, onLogout, onProfile }: { me: Person; onLogout: () => void; onProfile: (person: Person) => void }) {
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
    if (busy || from === to || from < 0 || to < 0 || from >= myWishes.length || to >= myWishes.length) return
    const reordered = [...myWishes]
    const [item] = reordered.splice(from, 1)
    reordered.splice(to, 0, item)
    const previous = wishes
    setWishes([...reordered, ...wishes.filter(wish => String(wish.ownerId) !== String(me?.id))])
    const ok = await perform(() => api('/wishes/order', json('PATCH', { ids: reordered.map(wish => wish.id) })), t('Ordre enregistré.'), false)
    if (!ok) setWishes(previous)
  }
  async function reorderManaged(from: number, to: number) {
    if (!selectedPerson || busy || from === to || from < 0 || to < 0 || from >= personWishes.length || to >= personWishes.length) return
    const reordered = [...personWishes]
    const [item] = reordered.splice(from, 1)
    reordered.splice(to, 0, item)
    const previous = personWishes
    setPersonWishes(reordered)
    const ok = await perform(() => api(`/users/${encodeURIComponent(String(selectedPerson.id))}/wishes/order`, json('PATCH', { ids: reordered.map(wish => wish.id) })), t('Ordre enregistré.'), false)
    if (!ok) setPersonWishes(previous)
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
  const personFiltersActive = !!(personFilters.tag.trim() || personFilters.availability || personFilters.minPrice.trim() || personFilters.maxPrice.trim())
  const canReorderManaged = curating && !personFiltersActive
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
        {page === 'wishes' && <><ManagedListsBar me={me} managed={managedMembers} activeId={null} onSelf={() => go('wishes')} onPerson={openPerson}/><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow mb-2">{t('VOTRE LISTE PERSONNELLE')}</p><h1 className="font-['Outfit'] text-3xl font-bold">{t('Mes envies')} <span className="text-brand-500">({myWishes.length})</span></h1><p className="muted mt-2">{t('Notez vos idées une fois : vos proches sauront quoi offrir.')}</p></div><button className="primary" onClick={() => openWish()}><Icon name="plus" size={18}/> {t('Ajouter une envie')}</button></div>{myWishes.length ? <><p className="muted mb-4">{t('Glissez les envies ou utilisez les flèches pour changer leur priorité.')}</p><SortableWishList wishes={myWishes} busy={busy} canReorder onReorder={reorder} onTags={wish => { setSelectedWish(wish); setModal('tags') }} onDelete={removeWish}/></> : <Empty icon="heart" title={t('Votre liste est encore vide')} text={t('Collez le lien d’un produit et nous vous aiderons à l’ajouter.')} action={<button className="primary" onClick={() => openWish()}><Icon name="plus" size={18}/> {t('Ajouter une envie')}</button>}/>}</>}
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
            {personWishes.length ? curating
              ? <>{personFiltersActive && <p className="muted mb-4">{t('Supprimez les filtres pour réorganiser cette liste.')}</p>}<SortableWishList wishes={personWishes} busy={busy} canReorder={canReorderManaged} curated onReorder={reorderManaged} onTags={wish => { setSelectedWish(wish); setModal('tags') }} onDelete={removeWish} onReserve={openReserve}/></>
              : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{personWishes.map(wish => <WishCard key={wish.id} wish={wish} mine={String(wish.ownerId) === String(me.id)} curated={curating} onReserve={() => openReserve(wish)} onTags={() => { setSelectedWish(wish); setModal('tags') }} onDelete={() => removeWish(wish)}/>)}</div>
              : <Empty icon="heart" title={t('Aucune envie trouvée')} text={curating ? t('Ajoutez ses idées de cadeaux pour que vos proches sachent quoi offrir.') : t('Modifiez les filtres pour découvrir d’autres envies.')} action={curating ? <button className="primary" onClick={() => openWish(selectedPerson)}><Icon name="plus" size={18}/> {t('Ajouter une envie')}</button> : undefined}/>}
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
