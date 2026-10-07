import { nameOf, type Id, type Person } from '../../api'
import { useTranslation } from '../../language-context'
import { Avatar } from '../atoms/Avatar'

export function ManagedListsBar({ me, managed, activeId, onSelf, onPerson }: {
  me: Person; managed: Person[]; activeId: Id | null; onSelf: () => void; onPerson: (person: Person) => void
}) {
  const { t } = useTranslation()
  if (!managed.length) return null
  const chip = (active: boolean) => `flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${active ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-500 hover:border-brand-200 hover:text-brand-600'}`
  return <nav aria-label={t('Les listes que je tiens')} className="mb-7">
    <p className="eyebrow mb-2">{t('LES LISTES QUE JE TIENS')}</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className={chip(activeId === null)} aria-current={activeId === null ? 'true' : undefined} onClick={onSelf}><Avatar person={me} size="sm"/>{t('Mes envies')}</button>
      {managed.map(person => {
        const active = String(person.id) === String(activeId)
        return <button key={person.id} type="button" className={chip(active)} aria-current={active ? 'true' : undefined} onClick={() => onPerson(person)}><Avatar person={person} size="sm"/>{nameOf(person)}</button>
      })}
    </div>
  </nav>
}
