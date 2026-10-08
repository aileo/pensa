import { money, nameOf, type Wish } from '../../api'
import { useTranslation } from '../../language-context'
import { Icon } from '../atoms/Icon'

export function WishCard({ wish, mine, curated, onReserve, onTags, onDelete, onOpen }: { wish: Wish; mine: boolean; curated?: boolean; onReserve: () => void; onTags?: () => void; onDelete?: () => void; onOpen?: () => void }) {
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
        {onOpen && <button className="icon-button" onClick={onOpen} aria-label={t('Voir le permalien de {title}', { title: wish.title })}><Icon name="link" size={17} /></button>}
        {mine || curated ? <div className="ml-auto flex items-center gap-1"><button className="icon-button" onClick={onTags} aria-label={t('Modifier les tags de {title}', { title: wish.title })}><Icon name="edit" size={17}/></button><button className="icon-button hover:!text-red-600" onClick={onDelete} aria-label={t('Supprimer {title}', { title: wish.title })}><Icon name="trash" size={17}/></button>{curated && <button className="secondary !px-3 !py-1.5 text-xs" onClick={onReserve}>{wish.reservation ? t('Voir la réservation') : t('Réserver')} <Icon name="arrow" size={14}/></button>}</div>
          : <button className="secondary ml-auto !px-3 !py-1.5 text-xs" onClick={onReserve}>{wish.reservation ? t('Voir la réservation') : t('Réserver')} <Icon name="arrow" size={14}/></button>}
      </div>
    </div>
  </article>
}
