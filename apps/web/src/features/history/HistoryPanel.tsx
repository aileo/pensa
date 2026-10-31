import { useEffect, useState } from 'react'
import { api, dateOf, nameOf, type HistoryEntry } from '../../api'
import { useTranslation } from '../../language-context'
import { occasionWithYear } from '../reservations/model'
import { Empty, SectionTitle } from '../../components/molecules/Empty'

export function HistoryPanel({ revision }: { revision: number }) {
  const { locale, t } = useTranslation()
  const [state, setState] = useState<{ revision: number; items?: HistoryEntry[]; error?: string }>({ revision })
  useEffect(() => {
    let active = true
    api<HistoryEntry[]>('/history').then(items => { if (active) setState({ revision, items }) })
      .catch(problem => { if (active) setState({ revision, error: problem instanceof Error ? problem.message : t('Une erreur inattendue est survenue.') }) })
    return () => { active = false }
  }, [revision, t])
  const items = state.revision === revision ? state.items : undefined
  return <>
    <SectionTitle icon="clock" tone="sage" kicker={t('DÉJÀ OFFERT')} title={t('Historique')}/>
    {!items ? state.revision === revision && state.error ? <p role="alert">{state.error}</p> : <p role="status">{t('Chargement de l’historique…')}</p>
      : items.length ? <div className="card divide-y divide-line-soft">{items.map(entry => <article key={entry.id} className="p-5">
        <h3 className="font-semibold">{entry.snapshot.title || t('Un cadeau offert')}</h3>
        <p className="mt-1 text-sm">{t('Pour')} <strong>{entry.snapshot.recipient && (entry.snapshot.recipient.firstName || entry.snapshot.recipient.lastName) ? nameOf(entry.snapshot.recipient) : t('Bénéficiaire indisponible')}</strong></p>
        {entry.snapshot.creator && <p className="muted mt-1">{t('Organisé par')} {nameOf(entry.snapshot.creator)}</p>}
        {!!entry.snapshot.participants.length && <p className="muted">{t('Participants :')} {entry.snapshot.participants.map(nameOf).join(', ')}</p>}
        {!!entry.snapshot.occasions.length && <p className="muted mt-1">{entry.snapshot.occasions.map(occasion => occasionWithYear(occasion, locale, entry.snapshot.recipient?.birthDate)).join(', ')}</p>}
        <p className="muted mt-1">{entry.snapshot.giftedAt ? t('Offert le {date}', { date: dateOf(entry.snapshot.giftedAt) }) : t('Enregistré le {date}', { date: dateOf(entry.created_at) })}</p>
      </article>)}</div>
        : <Empty icon="clock" title={t('Rien d’offert pour l’instant')} text={t('Les cadeaux déjà offerts s’afficheront ici, pour éviter d’offrir deux fois la même chose.')}/>}
  </>
}
