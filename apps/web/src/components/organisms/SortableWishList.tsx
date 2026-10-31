import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { money, nameOf, type Wish } from '../../api'
import { useTranslation } from '../../language-context'
import { Icon } from '../atoms/Icon'

const DRAG_THRESHOLD = 5
const SCROLL_EDGE = 60
const SCROLL_SPEED = 14

type Drag = { from: number, to: number, dy: number, shift: number }
type Session = {
  pointerId: number
  startY: number
  clientY: number
  started: boolean
  centers: number[]
  frame: number
  cleanup: () => void
}

const pageY = (clientY: number) => clientY + window.scrollY

const targetIndex = (centers: number[], from: number, center: number) => {
  let to = from
  while (to < centers.length - 1 && center > centers[to + 1]) to++
  while (to > 0 && center < centers[to - 1]) to--
  return to
}

const rowShift = (index: number, drag: Drag | null) => {
  if (!drag || index === drag.from) return 0
  if (drag.from < index && index <= drag.to) return -drag.shift
  if (drag.to <= index && index < drag.from) return drag.shift
  return 0
}

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
  const [drag, setDrag] = useState<Drag | null>(null)
  const rows = useRef<(HTMLDivElement | null)[]>([])
  const session = useRef<Session | null>(null)
  const latest = useRef({ busy, onReorder })
  useEffect(() => { latest.current = { busy, onReorder } })
  useEffect(() => () => session.current?.cleanup(), [])

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>, index: number) => {
    const target = event.target as Element
    if (!canReorder || busy || session.current || event.button !== 0) return
    if (target.closest('button, a, input, textarea, select')) return
    if (event.pointerType === 'touch' && !target.closest('[data-drag-handle]')) return
    let to = index
    let shift = 0
    const update = () => {
      const current = session.current
      if (!current) return
      if (!current.started) {
        if (Math.abs(pageY(current.clientY) - current.startY) < DRAG_THRESHOLD) return
        const rects = rows.current.slice(0, wishes.length).map(row => row?.getBoundingClientRect() ?? new DOMRect())
        current.centers = rects.map(rect => pageY(rect.top) + rect.height / 2)
        current.started = true
        document.body.style.userSelect = 'none'
        document.body.style.cursor = 'grabbing'
        window.getSelection()?.removeAllRanges()
        const gap = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0
        shift = rects[index].height + gap
        const scroll = () => {
          if (!session.current) return
          if (current.clientY < SCROLL_EDGE) window.scrollBy(0, -SCROLL_SPEED)
          else if (current.clientY > window.innerHeight - SCROLL_EDGE) window.scrollBy(0, SCROLL_SPEED)
          move()
          current.frame = requestAnimationFrame(scroll)
        }
        current.frame = requestAnimationFrame(scroll)
      }
      move()
    }
    const move = () => {
      const current = session.current
      if (!current) return
      const dy = pageY(current.clientY) - current.startY
      to = targetIndex(current.centers, index, current.centers[index] + dy)
      setDrag(previous => previous && previous.dy === dy && previous.to === to ? previous : { from: index, to, dy, shift })
    }
    const finish = (commit: boolean) => {
      const current = session.current
      if (!current) return
      current.cleanup()
      session.current = null
      if (!current.started) return
      setDrag(null)
      if (commit && !latest.current.busy && to !== index) latest.current.onReorder(index, to)
    }
    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== session.current?.pointerId) return
      session.current.clientY = moveEvent.clientY
      update()
    }
    const onUp = (upEvent: PointerEvent) => { if (upEvent.pointerId === session.current?.pointerId) finish(true) }
    const onCancel = () => finish(false)
    const onKey = (keyEvent: KeyboardEvent) => { if (keyEvent.key === 'Escape') finish(false) }
    const onSelect = (selectEvent: Event) => { if (session.current?.started) selectEvent.preventDefault() }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('blur', onCancel)
    window.addEventListener('keydown', onKey)
    document.addEventListener('selectstart', onSelect)
    session.current = {
      pointerId: event.pointerId,
      startY: pageY(event.clientY),
      clientY: event.clientY,
      started: false,
      centers: [],
      frame: 0,
      cleanup: () => {
        const current = session.current
        if (current) cancelAnimationFrame(current.frame)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onCancel)
        window.removeEventListener('blur', onCancel)
        window.removeEventListener('keydown', onKey)
        document.removeEventListener('selectstart', onSelect)
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
      },
    }
  }

  const rowStyle = (index: number): CSSProperties | undefined => {
    if (!drag) return undefined
    if (index === drag.from) return { transform: `translateY(${drag.dy}px)`, transition: 'none', position: 'relative', zIndex: 10 }
    return { transform: `translateY(${rowShift(index, drag)}px)`, transition: 'transform 150ms ease' }
  }

  return <div className="space-y-3">
    {wishes.map((wish, index) => <div
      key={wish.id}
      ref={row => { rows.current[index] = row }}
      data-sortable={canReorder ? 'true' : undefined}
      onPointerDown={canReorder ? event => startDrag(event, index) : undefined}
      style={rowStyle(index)}
      className={`card grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 p-3 lg:flex lg:gap-5 lg:p-4 ${canReorder ? 'lg:cursor-grab' : ''} ${drag?.from === index ? 'shadow-xl ring-2 ring-brand-400' : ''}`}
    >
      {canReorder && <span data-drag-handle className="hidden touch-none text-ink-400 lg:block" title={t('Glisser pour déplacer {title}', { title: wish.title })}><Icon name="grip"/></span>}
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
