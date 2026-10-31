import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { api, dateOf, money, nameOf, type SearchResults } from '../../api'
import { historyEntryPath, personWishesPath, wishPath } from '../../routes'
import { useTranslation } from '../../language-context'
import { Avatar } from '../../components/atoms/Avatar'
import { Icon } from '../../components/atoms/Icon'
import { Empty, SectionTitle } from '../../components/molecules/Empty'
import { occasionWithYear } from '../reservations/model'

export function SearchPanel({ revision }: { revision: number }) {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  return <>
    <SectionTitle icon="search" kicker={t('RECHERCHE')} title={t('Rechercher')}/>
    <label htmlFor="global-search" className="label">{t('Personnes, envies et cadeaux offerts')}</label>
    <input id="global-search" autoComplete="off" className="field mb-7" placeholder={t('Rechercher une personne, une envie, un cadeau offert…')} value={q} onChange={event => setParams(previous => {
      const next = new URLSearchParams(previous)
      if (event.target.value) next.set('q', event.target.value); else next.delete('q')
      return next
    }, { replace: true })}/>
    <SearchContent key={`${revision}:${q}`} q={q}/>
  </>
}

function SearchContent({ q }: { q: string }) {
  const { locale, t } = useTranslation()
  const navigate = useNavigate()
  const [state, setState] = useState<{ results?: SearchResults; error?: string }>({})
  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      api<SearchResults>(`/search?q=${encodeURIComponent(q.trim())}`)
        .then(results => { if (active) setState({ results }) })
        .catch(problem => { if (active) setState({ error: problem instanceof Error ? problem.message : t('Une erreur inattendue est survenue.') }) })
    }, 300)
    return () => { active = false; window.clearTimeout(timer) }
  }, [q, t])
  const results = state.results
  return <>
    {state.error ? <p role="alert">{state.error}</p> : !results ? <p role="status">{t('Recherche en cours…')}</p>
      : results.people.length || results.wishes.length || results.history.length ? <div className="space-y-3">
        {results.people.map(person => <article key={`person-${person.id}`} className="card flex items-center gap-4 p-4">
          <Avatar person={person}/><div className="min-w-0 flex-1"><p className="font-semibold">{nameOf(person)}</p><p className="muted">{t('Personne')}</p></div>
          <button className="secondary text-sm" onClick={() => navigate(personWishesPath(String(person.id)))}>{t('Voir')} <Icon name="arrow" size={15}/></button>
        </article>)}
        {results.wishes.map(wish => <article key={`wish-${wish.id}`} className="card flex items-center gap-4 p-4">
          <Icon name="heart"/><div className="min-w-0 flex-1"><p className="font-semibold">{wish.title}</p><p className="muted">{t('Pour')} {nameOf(wish.owner)}</p>{wish.price != null && <p className="muted">{money(wish.price)}</p>}</div>
          <button className="secondary text-sm" onClick={() => navigate(wishPath(String(wish.id)))}>{t('Voir')} <Icon name="arrow" size={15}/></button>
        </article>)}
        {results.history.map(entry => <article key={`history-${entry.id}`} className="card flex items-center gap-4 p-4">
          <Icon name="clock"/><div className="min-w-0 flex-1"><p className="eyebrow">{t('Déjà offert')}</p><p className="font-semibold">{entry.snapshot.title || t('Un cadeau offert')}</p>
            <p className="muted">{t('Pour')} {entry.snapshot.recipient && (entry.snapshot.recipient.firstName || entry.snapshot.recipient.lastName) ? nameOf(entry.snapshot.recipient) : t('Bénéficiaire indisponible')}</p>
            {!!entry.snapshot.occasions.length && <p className="muted">{entry.snapshot.occasions.map(occasion => occasionWithYear(occasion, locale, entry.snapshot.recipient?.birthDate)).join(', ')}</p>}
            <p className="muted">{entry.snapshot.giftedAt ? t('Offert le {date}', { date: dateOf(entry.snapshot.giftedAt) }) : t('Enregistré le {date}', { date: dateOf(entry.created_at) })}</p></div>
          <button className="secondary text-sm" aria-label={t('Voir dans l’historique')} onClick={() => navigate(historyEntryPath(entry.recipientId, entry.id))}>{t('Voir')} <Icon name="arrow" size={15}/></button>
        </article>)}
      </div> : <Empty icon="search" title={t(q ? 'Aucun résultat' : 'Que recherchez-vous ?')} text={t(q ? 'Essayez d’autres mots-clés.' : 'Retrouvez une personne, une idée cadeau ou un cadeau déjà offert en quelques lettres.')}/>}
  </>
}
