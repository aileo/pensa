import { useState } from 'react'
import { dateOf, nameOf, type Id, type Onboarding, type Person, type Todo } from '../../api'
import type { Page, ReservationStatus } from '../../app-types'
import { Icon, type IconName } from '../../components/atoms/Icon'
import { useTranslation } from '../../language-context'
import { occasionLabel, occasionName, type TranslationKey } from '../../locale'

const onboardingKey = (me: Person) => `pensa-onboarding-dismissed-${me.id}`
export function Guidance({ me, onboarding, todos, busy, onAddWish, onGo, onPerson, onReservation, onStatus }: {
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
  const statusTodos: Partial<Record<Todo['type'], { verb: TranslationKey; done: TranslationKey; next: ReservationStatus; icon: IconName }>> = {
    reservation_to_buy: { verb: 'Acheter « {title} » pour {name}', done: 'C’est acheté', next: 'purchased', icon: 'cart' },
    reservation_to_wrap: { verb: 'Emballer « {title} » pour {name}', done: 'C’est emballé', next: 'wrapped', icon: 'box' },
    reservation_to_give: { verb: 'Offrir « {title} » à {name}', done: 'C’est offert', next: 'gifted', icon: 'party' },
  }
  const describe = (todo: Todo) => {
    const name = nameOf(todo.person), occasion = occasionLabel(todo.occasion, locale, { year: todo.date ? Number(todo.date.slice(0, 4)) : null, birthDate: todo.person?.birthDate }), date = dateOf(todo.date), title = todo.reservation?.wishTitle ?? ''
    if (todo.type === 'occasion_without_gift') return { text: t('{occasion} de {name} le {date} : aucun cadeau prévu', { occasion: occasionName(todo.occasion, locale), name, date }), action: t('Voir ses envies'), icon: 'calendar' as IconName, run: () => todo.person && onPerson(todo.person) }
    if (todo.type === 'managed_list_empty') return { text: t('La liste de {name} est vide : votre foyer la tient à jour', { name }), action: t('Compléter sa liste'), icon: 'heart' as IconName, run: () => todo.person && onPerson(todo.person) }
    const step = statusTodos[todo.type]
    if (step && todo.reservation) {
      const reservation = todo.reservation
      return { text: t(step.verb, { title, name }), detail: todo.date ? t('{occasion} le {date}', { occasion, date }) : undefined,
        action: t('Voir'), icon: step.icon, run: () => onReservation(reservation.id),
        primary: step.next === 'gifted' && reservation.wishDeleted ? undefined : { label: t(step.done), run: () => void onStatus(reservation.id, step.next, title) } }
    }
    return { text: t(todo.count === 1 ? '{count} demande de participation à traiter pour « {title} »' : '{count} demandes de participation à traiter pour « {title} »', { count: todo.count ?? 0, title }), action: t('Répondre'), icon: 'users' as IconName, run: () => todo.reservation ? onReservation(todo.reservation.id) : onGo('reservations') }
  }
  return <div className={`mb-9 grid gap-5 ${showChecklist ? 'lg:grid-cols-2' : ''}`}>
    {showChecklist && <section className="card p-5 sm:p-6" aria-labelledby="onboarding-title">
      <div className="mb-4 flex items-start justify-between gap-3"><div><p className="eyebrow mb-1">{t('BIEN DÉMARRER')}</p><h2 id="onboarding-title" className="font-['Outfit'] text-xl font-semibold">{t('{done} étapes sur {total}', { done: doneCount, total: steps.length })}</h2></div><button className="icon-button" onClick={dismiss} aria-label={t('Masquer le guide de démarrage')}><Icon name="close" size={16}/></button></div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-brand-50" aria-hidden="true"><div className="h-full rounded-full bg-brand-600" style={{ width: `${(doneCount / steps.length) * 100}%` }}/></div>
      <ul className="space-y-2">{steps.map(step => <li key={step.label} className="flex items-center gap-3 rounded-xl px-2 py-2">
        <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${step.done ? 'bg-sage-600 text-white' : 'border-2 border-brand-400'}`}>{step.done && <Icon name="check" size={14}/>}</span>
        <span className={`flex-1 text-sm ${step.done ? 'text-ink-500 line-through' : 'font-semibold'}`}>{step.label}{step.done && <span className="sr-only"> ({t('terminé')})</span>}</span>
        {!step.done && <button className="secondary !px-3 !py-1.5 text-xs" onClick={step.run}>{step.action}</button>}
      </li>)}</ul>
    </section>}
    <section className="card p-5 sm:p-6" aria-labelledby="todo-title">
      <p className="eyebrow mb-1">{t('PROCHAINES ÉTAPES')}</p><h2 id="todo-title" className="mb-4 font-['Outfit'] text-xl font-semibold">{t('À faire')}</h2>
      {todos.length ? <ul className="divide-y divide-line-soft">{todos.map((todo, index) => { const item: { text: string; detail?: string; action: string; icon: IconName; run: () => void; primary?: { label: string; run: () => void } } = describe(todo); return <li key={`${todo.type}-${todo.person?.id ?? ''}-${todo.reservation?.id ?? ''}-${index}`} className={`flex flex-wrap items-center gap-3 py-3 ${todo.urgent ? '-mx-2 rounded-xl bg-clay-50 px-2' : ''}`}>
        <span className={`rounded-xl p-2 ${todo.urgent ? 'bg-clay-100 text-clay-600' : 'bg-brand-50 text-brand-600'}`}><Icon name={item.icon} size={18}/></span>
        <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 text-sm font-semibold">{item.text}{todo.urgent && <span className="rounded-full bg-clay-600 px-2 py-0.5 text-[11px] font-bold text-white">{t('Bientôt')}</span>}</span>{item.detail && <span className="muted block text-xs">{item.detail}</span>}</span>
        <span className="flex gap-2">{item.primary && <button className="primary !px-3 !py-1.5 text-xs" disabled={busy} onClick={item.primary.run}><Icon name="check" size={14}/> {item.primary.label}</button>}
        <button className="secondary !px-3 !py-1.5 text-xs" onClick={item.run}>{item.action} <Icon name="arrow" size={14}/></button></span>
      </li> })}</ul> : <p className="muted">{t('Rien à faire dans l’immédiat. Vous pouvez en profiter pour compléter votre liste d’envies.')}</p>}
    </section>
  </div>
}
