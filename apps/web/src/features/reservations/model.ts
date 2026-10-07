import type { Occasion, OccasionSelection } from '../../api'
import type { ReservationStatus } from '../../app-types'
import { occasionLabel, occasionName, type Locale, type TranslationKey } from '../../locale'

export const selectionOf = (occasion: Occasion): OccasionSelection | null => {
  const year = occasion.year ?? (occasion.nextDate ? Number(occasion.nextDate.slice(0, 4)) : NaN)
  return Number.isInteger(year) ? { id: occasion.id, year } : null
}
export type OccasionOption = { occasion: Occasion; selection: OccasionSelection; date: string | null }
const occurrenceDate = (occasion: Occasion, year: number) => {
  if (!occasion.nextDate) return null
  const month = Number(occasion.nextDate.slice(5, 7)), day = Number(occasion.nextDate.slice(8, 10))
  const exists = new Date(Date.UTC(year, month - 1, day)).getUTCDate() === day
  return `${year}-${String(month).padStart(2, '0')}-${String(exists ? day : 28).padStart(2, '0')}`
}
const byDate = (a: OccasionOption, b: OccasionOption) => (a.date ?? `${a.selection.year}-99`).localeCompare(b.date ?? `${b.selection.year}-99`)
  || String(a.occasion.name ?? a.occasion.title ?? '').localeCompare(String(b.occasion.name ?? b.occasion.title ?? ''))
// Next occurrence and the following year of each occasion, merged with already saved ones, in chronological order.
export const occurrences = (occasions: Occasion[], saved: Occasion[] = []): OccasionOption[] => {
  const available = occasions.flatMap(occasion => {
    const first = selectionOf(occasion)
    if (!first) return []
    return [first, { id: first.id, year: first.year + 1 }]
      .filter(selection => selection.year <= 2200)
      .map(selection => ({ occasion, selection, date: occurrenceDate(occasion, selection.year) }))
  })
  const kept = saved.flatMap(occasion => {
    const selection = selectionOf(occasion)
    if (!selection) return []
    const match = occasions.find(item => String(item.id) === String(occasion.id)) ?? occasions.find(item => (item.name ?? item.title) === (occasion.name ?? occasion.title))
    return [{ occasion: { ...occasion, kind: occasion.kind ?? match?.kind }, selection, date: match ? occurrenceDate(match, selection.year) : null }]
  })
  return [...kept, ...available.filter(item => !isSaved(item, saved))].sort(byDate)
}
export const sameSelection = (a: OccasionSelection, b: OccasionSelection) => String(a.id) === String(b.id) && a.year === b.year
export const occasionWithYear = (occasion: { name?: string; kind?: Occasion['kind']; year?: number }, locale: Locale, birthDate?: string | null) => {
  const label = occasionLabel(occasion.name, locale, { kind: occasion.kind, year: occasion.year, birthDate })
  return label === occasionName(occasion.name, locale, occasion.kind) && occasion.year ? `${label} ${occasion.year}` : label
}
const isSaved = (item: { occasion: Occasion; selection: OccasionSelection }, saved: Occasion[] = []) => saved.some(occasion => occasion.year === item.selection.year &&
  (String(occasion.id) === String(item.selection.id) || (occasion.name ?? occasion.title) === (item.occasion.name ?? item.occasion.title)))
export const statusOrder: ReservationStatus[] = ['reserved', 'purchased', 'wrapped', 'gifted']
export const statusLabels: Record<string, TranslationKey> = { reserved: 'Réservé', purchased: 'Acheté', wrapped: 'Emballé', gifted: 'Offert' }
export const requestLabels: Record<string, TranslationKey> = { pending: 'En attente', accepted: 'Acceptée', refused: 'Refusée' }
export const statusNotices: Record<ReservationStatus, TranslationKey> = { reserved: 'Cadeau repassé en réservé.', purchased: 'Cadeau marqué comme acheté.', wrapped: 'Cadeau marqué comme emballé.', gifted: 'Cadeau marqué comme offert !' }
export const nextActions: Partial<Record<ReservationStatus, TranslationKey>> = { purchased: 'Marquer comme acheté', wrapped: 'Marquer comme emballé', gifted: 'Marquer comme offert' }
export const backActions: Partial<Record<ReservationStatus, TranslationKey>> = { reserved: 'Revenir à Réservé', purchased: 'Revenir à Acheté' }
