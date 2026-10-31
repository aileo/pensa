import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { api, dateOf, nameOf, type HistoryEntry } from '../../api'
import { useTranslation } from '../../language-context'
import { occasionWithYear } from '../reservations/model'
import { Empty, SectionTitle } from '../../components/molecules/Empty'

export function HistoryPanel({ revision }: { revision: number }) {
  const { locale, t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const recipient = params.get('recipient') ?? ''
  const requestedSort = params.get('sort')
  const sort = requestedSort === 'oldest' || requestedSort === 'recipient' ? requestedSort : 'newest'
  const [state, setState] = useState<{ revision: number; items?: HistoryEntry[]; error?: string }>({ revision })
  useEffect(() => {
    let active = true
    api<HistoryEntry[]>('/history').then(items => { if (active) setState({ revision, items }) })
      .catch(problem => { if (active) setState({ revision, error: problem instanceof Error ? problem.message : t('Une erreur inattendue est survenue.') }) })
    return () => { active = false }
  }, [revision, t])
  const update = (key: string, value: string) => setParams(previous => {
    const next = new URLSearchParams(previous)
    if (value) next.set(key, value); else next.delete(key)
    return next
  })
  const items = state.revision === revision ? state.items : undefined
  const recordedDate = (entry: HistoryEntry) => Date.parse(entry.snapshot.giftedAt ?? entry.created_at)
  const recipientName = (entry: HistoryEntry) => entry.snapshot.recipient && (entry.snapshot.recipient.firstName || entry.snapshot.recipient.lastName)
    ? nameOf(entry.snapshot.recipient) : t('Bénéficiaire indisponible')
  // Use the latest recorded identity consistently across all occurrences of a recipient.
  const recipients = new Map<string, string>()
  for (const entry of [...(items ?? [])].sort((a, b) => recordedDate(b) - recordedDate(a) || a.id.localeCompare(b.id))) {
    if (!recipients.has(entry.recipientId)) recipients.set(entry.recipientId, recipientName(entry))
  }
  const recipientOptions = [...recipients.entries()].sort((a, b) => a[1].localeCompare(b[1], locale) || a[0].localeCompare(b[0]))
  const filtered = (items ?? []).filter(entry => !recipient || entry.recipientId === recipient).sort((a, b) => {
    if (sort === 'recipient') {
      const name = recipients.get(a.recipientId)!.localeCompare(recipients.get(b.recipientId)!, locale)
      if (name) return name
      const identity = a.recipientId.localeCompare(b.recipientId)
      if (identity) return identity
    }
    const date = recordedDate(a) - recordedDate(b)
    return (sort === 'oldest' ? date : -date) || a.id.localeCompare(b.id)
  })
  return <>
    <SectionTitle icon="clock" tone="sage" kicker={t('DÉJÀ OFFERT')} title={t('Historique')}/>
    <p className="muted mb-4">{t('Les cadeaux offerts sont partagés avec la famille du bénéficiaire, sauf avec le bénéficiaire lui-même, même s’ils étaient privés.')}</p>
    {!items ? state.revision === revision && state.error ? <p role="alert">{state.error}</p> : <p role="status">{t('Chargement de l’historique…')}</p> : <>
      <div className="card mb-5 grid gap-4 p-4 lg:grid-cols-2">
        <div><label className="label" htmlFor="history-recipient">{t('Bénéficiaire')}</label><select className="field" id="history-recipient" value={recipient} onChange={event => update('recipient', event.target.value)}>
          <option value="">{t('Tous les bénéficiaires')}</option>{recipientOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          {recipient && !recipients.has(recipient) && <option value={recipient}>{t('Bénéficiaire indisponible')}</option>}
        </select></div>
        <div><label className="label" htmlFor="history-sort">{t('Trier par')}</label><select className="field" id="history-sort" value={sort} onChange={event => update('sort', event.target.value === 'newest' ? '' : event.target.value)}>
          <option value="newest">{t('Plus récents d’abord')}</option><option value="oldest">{t('Plus anciens d’abord')}</option><option value="recipient">{t('Bénéficiaire (A–Z)')}</option>
        </select></div>
      </div>
      {filtered.length ? <div className="card divide-y divide-line-soft">{filtered.map(entry => <article key={entry.id} className="compact-panel p-5">
        <h3 className="font-semibold">{entry.snapshot.title || t('Un cadeau offert')}</h3>
        <p className="mt-1 text-sm">{t('Pour')} <strong>{recipientName(entry)}</strong></p>
        {entry.snapshot.creator && <p className="muted mt-1">{t('Organisé par')} {nameOf(entry.snapshot.creator)}</p>}
        {!!entry.snapshot.participants.length && <p className="muted">{t('Participants :')} {entry.snapshot.participants.map(nameOf).join(', ')}</p>}
        {!!entry.snapshot.occasions.length && <p className="muted mt-1">{entry.snapshot.occasions.map(occasion => occasionWithYear(occasion, locale, entry.snapshot.recipient?.birthDate)).join(', ')}</p>}
        <p className="muted mt-1">{entry.snapshot.giftedAt ? t('Offert le {date}', { date: dateOf(entry.snapshot.giftedAt) }) : t('Enregistré le {date}', { date: dateOf(entry.created_at) })}</p>
      </article>)}</div>
        : <Empty icon="clock" title={t(recipient ? 'Aucun cadeau pour ce filtre' : 'Rien d’offert pour l’instant')} text={t(recipient ? 'Choisissez un autre bénéficiaire ou affichez tous les bénéficiaires.' : 'Les cadeaux déjà offerts s’afficheront ici, pour éviter d’offrir deux fois la même chose.')}/>}
    </>}
  </>
}
