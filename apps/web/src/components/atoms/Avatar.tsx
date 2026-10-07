import { initials, type Person } from '../../api'

export function Avatar({ person, size = 'md' }: { person?: Person | null; size?: 'sm' | 'md' | 'lg' }) {
  return <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-600 ${size === 'sm' ? 'size-8 text-xs' : size === 'lg' ? 'size-16 text-xl' : 'size-10 text-sm'}`}>{initials(person)}</span>
}
