import { useEffect, useId, useRef, useState } from 'react'
import { api, dateOf, json, list, money, nameOf, type Id, type Occasion, type OccasionSelection, type Person, type ParticipationRequest, type Reservation, type Wish } from '../../api'
import type { ReservationStatus } from '../../app-types'
import { Icon, type IconName } from '../../components/atoms/Icon'
import { useTranslation } from '../../language-context'
import { localizeMessage, occasionLabel } from '../../locale'
import { backActions, nextActions, occurrences, occasionWithYear, requestLabels, sameSelection, selectionOf, statusLabels, statusOrder, type OccasionOption } from './model'

function OccasionPicker({ options, selected, person, onToggle }: { options: OccasionOption[]; selected: OccasionSelection[]; person?: Person | null; onToggle: (selection: OccasionSelection) => void }) {
  const { locale, t } = useTranslation()
  return <div className="max-h-36 space-y-2 overflow-y-auto">{options.map(({ occasion, selection, date }) => <label key={`${selection.id}-${selection.year}`} className="flex items-center gap-2 text-sm">
    <input type="checkbox" className="accent-brand-600" checked={selected.some(value => sameSelection(value, selection))} onChange={() => onToggle(selection)}/>
    {occasionLabel(occasion.name || occasion.title, locale, { kind: occasion.kind, year: selection.year, birthDate: person?.birthDate }) || t('Occasion')} <span className="text-ink-500">{date ? dateOf(date) : t('année {year}', { year: selection.year })}</span>
  </label>)}</div>
}
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

export function ReservationForm({ wish, reservations, occasions, people, me, busy, perform }: { wish: Wish; reservations: Reservation[]; occasions: Occasion[]; people: Person[]; me: Person; busy: boolean; perform: (action: () => Promise<unknown>, success: string, close?: boolean) => Promise<boolean> }) {
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

export function OffListForm({ recipient, people, me, busy, perform }: { recipient: Person | null; people: Person[]; me: Person; busy: boolean; perform: (action: () => Promise<unknown>, success: string, close?: boolean) => Promise<boolean> }) {
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

export function OffListGiftCard({ gift, me, busy, showRecipient, onRequest, onOpen, onRecipient }: { gift: Reservation; me: Person; busy: boolean; showRecipient?: boolean; onRequest: () => void; onOpen: () => void; onRecipient?: () => void }) {
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

export function ReservationRow({ reservation, users, me, busy, perform, onStatus, focused }: { reservation: Reservation; users: Person[]; me: Person; busy: boolean; perform: (action: () => Promise<unknown>, success: string, close?: boolean) => Promise<boolean>; onStatus: (id: Id, status: ReservationStatus, title?: string) => Promise<boolean>; focused?: boolean }) {
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
