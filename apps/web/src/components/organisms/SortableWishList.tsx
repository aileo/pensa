import { useRef, useState, type DragEvent } from 'react'
import { money, nameOf, type Wish } from '../../api'
import { useTranslation } from '../../language-context'
import { Icon } from '../atoms/Icon'

/**
 * Shared draggable/arrow-reorderable wish list, used both for the signed-in user's
 * own wishes and for a household-admin-managed member's wishes. Reordering is only
 * enabled (`canReorder`) when the full, unfiltered list is shown, since persisting
 * an order built from a filtered subset would silently drop the hidden wishes'
 * positions. `curated` keeps managed-list reservation visibility/actions available
 * without applying the beneficiary-only hiding rules used elsewhere.
 */
export function SortableWishList({ wishes, busy, canReorder, curated, onReorder, onEdit, onDelete, onReserve, onOpen }: {
  wishes: Wish[]
  busy: boolean
  canReorder: boolean
  curated?: boolean
  onReorder: (from: number, to: number) => void
  onEdit: (wish: Wish) => void
  onDelete: (wish: Wish) => void
  onReserve?: (wish: Wish) => void
  onOpen?: (wish: Wish) => void
}) {
  const { t } = useTranslation()
  const [dragging, setDragging] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const draggedId = useRef<string | null>(null)
  const dragFrom = (event: DragEvent) => {
    const id = draggedId.current ?? event.dataTransfer?.getData('text/plain')
    return wishes.findIndex(wish => String(wish.id) === id)
  }
  const endDrag = () => { draggedId.current = null; setDragging(null); setOver(null) }
  const allowDrop = (event: DragEvent, index: number) => {
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
    if (over !== index) setOver(index)
  }
  return <div className="space-y-3">
    {wishes.map((wish, index) => <div
      key={wish.id}
      draggable={canReorder}
      onDragStart={canReorder ? event => {
        draggedId.current = String(wish.id)
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', String(wish.id))
        setDragging(index)
      } : undefined}
      onDragEnter={canReorder ? event => allowDrop(event, index) : undefined}
      onDragOver={canReorder ? event => allowDrop(event, index) : undefined}
      onDragEnd={canReorder ? endDrag : undefined}
      onDrop={canReorder ? event => { event.preventDefault(); const from = dragFrom(event); endDrag(); if (busy) return; if (from !== -1) onReorder(from, index) } : undefined}
      className={`card grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 p-3 transition lg:flex lg:gap-5 lg:p-4 ${canReorder ? 'cursor-grab active:cursor-grabbing' : ''} ${dragging === index ? 'opacity-50' : ''} ${over === index && dragging !== null && dragging !== index ? 'ring-2 ring-brand-400' : ''}`}
    >
      {canReorder && <span className="hidden text-ink-400 lg:block" title={t('Glisser pour déplacer {title}', { title: wish.title })}><Icon name="grip"/></span>}
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-soft lg:size-20">{wish.image ? <img src={wish.image} alt="" draggable={false} className="h-full w-full object-cover"/> : <Icon name="gift" className="text-brand-300"/>}</div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-['Outfit'] font-semibold">{wish.title}</h2>
        <p className="muted mt-1 truncate">{wish.description || wish.url || t('Sans description')}</p>
        {curated && wish.reservation && <p className="mt-1 text-xs text-ink-500">{t('Réservé par {name}', { name: nameOf(wish.reservation.creator) })}{wish.reservation.openToContributions ? ` · ${t('Participation possible')}` : ''}</p>}
        <div className="mt-1 flex flex-wrap gap-1">{wish.tags?.map(tag => <span className="chip" key={tag}>#{tag}</span>)}</div>
      </div>
      <strong className="hidden text-sm text-brand-600 lg:block">{money(wish.price)}</strong>
      <div className="col-span-2 flex flex-wrap items-center gap-1 border-t border-line-soft pt-2 lg:shrink-0 lg:border-0 lg:pt-0">
        {wish.url && <a className="icon-button" href={wish.url} target="_blank" rel="noopener noreferrer" draggable={false} aria-label={t('Voir {title} sur le site marchand', { title: wish.title })}><Icon name="external" size={17}/></a>}
        {onOpen && <button className="icon-button" onClick={() => onOpen(wish)} aria-label={t('Voir le permalien de {title}', { title: wish.title })}><Icon name="link" size={17}/></button>}
        {canReorder && <><button className="icon-button !size-7" disabled={index === 0 || busy} onClick={() => onReorder(index, 0)} aria-label={t('Mettre {title} en premier', { title: wish.title })}><Icon name="arrowTop" size={16}/></button>
        <button className="icon-button !size-7" disabled={index === 0 || busy} onClick={() => onReorder(index, index - 1)} aria-label={t('Monter {title}', { title: wish.title })}><Icon name="arrowUp" size={16}/></button>
        <button className="icon-button !size-7" disabled={index === wishes.length - 1 || busy} onClick={() => onReorder(index, index + 1)} aria-label={t('Descendre {title}', { title: wish.title })}><Icon name="arrowDown" size={16}/></button>
        <button className="icon-button !size-7" disabled={index === wishes.length - 1 || busy} onClick={() => onReorder(index, wishes.length - 1)} aria-label={t('Mettre {title} en dernier', { title: wish.title })}><Icon name="arrowBottom" size={16}/></button></>}
        {curated && <button className="secondary !px-3 !py-1.5 text-xs" onClick={() => onReserve?.(wish)}>{wish.reservation ? t('Voir la réservation') : t('Réserver')} <Icon name="arrow" size={14}/></button>}
        <button className="icon-button" onClick={() => onEdit(wish)} aria-label={t('Modifier {title}', { title: wish.title })}><Icon name="edit" size={17}/></button>
        <button className="icon-button hover:!text-red-600" onClick={() => onDelete(wish)} aria-label={t('Supprimer {title}', { title: wish.title })}><Icon name="trash" size={17}/></button>
      </div>
    </div>)}
  </div>
}
