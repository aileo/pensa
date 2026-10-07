import type { ReactNode } from 'react'
import { Icon, type IconName } from '../atoms/Icon'

export function Empty({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: ReactNode }) {
  return <div className="card flex flex-col items-center px-5 py-14 text-center"><span className="mb-4 rounded-2xl bg-brand-50 p-4 text-brand-600"><Icon name={icon} size={28} /></span><h3 className="font-['Outfit'] text-xl font-semibold">{title}</h3><p className="muted mt-2 max-w-sm">{text}</p>{action && <div className="mt-5">{action}</div>}</div>
}

export function SectionTitle({ kicker, title, action, icon, tone = 'brand' }: { kicker?: string; title: string; action?: ReactNode; icon?: IconName; tone?: keyof typeof sectionTones }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div className="flex items-center gap-3">{icon && <span className={`hidden shrink-0 rounded-2xl p-2.5 sm:block ${sectionTones[tone]}`}><Icon name={icon} size={22}/></span>}<div>{kicker && <p className="eyebrow mb-1">{kicker}</p>}<h2 className="font-['Outfit'] text-2xl font-semibold tracking-tight text-ink-900">{title}</h2></div></div>{action}</div>
}

const sectionTones = {
  brand: 'bg-brand-100 text-brand-600',
  clay: 'bg-clay-100 text-clay-600',
  sage: 'bg-sage-100 text-sage-600',
} as const
