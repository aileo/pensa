import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api, money, nameOf, type Person, type Wish } from '../../api'
import { useTranslation } from '../../language-context'
import { Icon } from '../../components/atoms/Icon'
import { Empty } from '../../components/molecules/Empty'

type DetailState = { status: 'loading' } | { status: 'notFound' } | { status: 'ready'; wish: Wish }

// A wish permalink resolves through the same `/wishes/:id` endpoint the rest of the app
// could already call but never did. It carries the same privacy rules as the list view —
// the owner never sees who reserved it — so no new API plumbing was needed to keep that true.
// Malformed ids fail the same way as missing ones: the server rejects them before ever
// looking a wish up, so there is nothing for a direct URL to distinguish.
export function WishDetail({ id, me, users, busy, curates, onReserve, onTags, onDelete }: {
  id: string
  me: Person
  users: Person[]
  busy: boolean
  curates: (ownerId: string) => boolean
  onReserve: (wish: Wish) => void
  onTags: (wish: Wish) => void
  onDelete: (wish: Wish) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [state, setState] = useState<DetailState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    api<Wish>(`/wishes/${encodeURIComponent(id)}`)
      .then(wish => { if (active) setState({ status: 'ready', wish }) })
      // Any failure (not found, inaccessible, malformed id) renders the same safe message —
      // distinguishing them would tell a visitor more than the server itself reveals.
      .catch(() => { if (active) setState({ status: 'notFound' }) })
    return () => { active = false }
  }, [id])

  if (state.status === 'loading') return <p role="status" className="muted">{t('Chargement du souhait…')}</p>
  if (state.status === 'notFound') {
    return <Empty icon="heart" title={t('Souhait introuvable')} text={t('Ce lien n’est plus valide ou vous n’avez pas accès à ce souhait.')}
      action={<button className="secondary" onClick={() => navigate('/wishes')}>{t('Retour à mes envies')}</button>}/>
  }
  const { wish } = state
  const mine = String(wish.ownerId) === String(me.id)
  const curated = !mine && curates(String(wish.ownerId))
  const owner = users.find(person => String(person.id) === String(wish.ownerId))
  return <div className="max-w-2xl">
    <button className="secondary mb-6 !px-3 !py-1.5 text-sm" onClick={() => navigate(-1)}><Icon name="arrowLeft" size={16}/> {t('Retour')}</button>
    <article className="card overflow-hidden">
      <div className="relative flex h-60 items-center justify-center bg-surface-soft">
        {wish.image ? <img src={wish.image} alt="" className="h-full w-full object-cover"/> : <Icon name="gift" size={60} className="text-brand-300"/>}
      </div>
      <div className="p-6">
        {!mine && owner && <p className="eyebrow mb-2">{t('Envie de {name}', { name: nameOf(owner) })}</p>}
        <div className="flex items-start justify-between gap-3"><h1 className="font-['Outfit'] text-2xl font-bold">{wish.title}</h1>{wish.price !== undefined && wish.price !== null && <strong className="shrink-0 text-brand-600">{money(wish.price)}</strong>}</div>
        {wish.description && <p className="muted mt-3">{wish.description}</p>}
        {!!wish.tags?.length && <div className="mt-3 flex flex-wrap gap-1.5">{wish.tags.map(tag => <span className="chip" key={tag}>#{tag}</span>)}</div>}
        {!mine && wish.reservation && <p className="muted mt-3">{t('Réservé par {name}', { name: nameOf(wish.reservation.creator) })}{wish.reservation.openToContributions ? ` · ${t('Participation possible')}` : ''}</p>}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {wish.url && <a className="secondary" href={wish.url} target="_blank" rel="noopener noreferrer"><Icon name="external" size={16}/> {t('Voir le lien')}</a>}
          {(mine || curated) && <>
            <button className="icon-button" onClick={() => onTags(wish)} aria-label={t('Modifier les tags de {title}', { title: wish.title })}><Icon name="edit" size={17}/></button>
            <button className="icon-button hover:!text-red-600" onClick={() => onDelete(wish)} aria-label={t('Supprimer {title}', { title: wish.title })}><Icon name="trash" size={17}/></button>
          </>}
          {!mine && <button className="primary" disabled={busy} onClick={() => onReserve(wish)}>{wish.reservation ? t('Voir la réservation') : t('Réserver')} <Icon name="arrow" size={16}/></button>}
        </div>
      </div>
    </article>
  </div>
}
