import { formatDate, formatMoney, getLocale, translate } from './locale'

export type Id = string | number
export type Person = { id: Id; firstName?: string; lastName?: string; email?: string; birthDate?: string; householdId?: Id; name?: string; nameDay?: string | null; householdAdmin?: boolean; familyAdmin?: boolean }
export type Household = { id: Id; name: string; mine?: boolean; members?: Person[] }
export type Family = { id: Id; name: string; admin?: boolean; members?: Person[]; households?: Household[]; users?: Person[] }
export type Todo = {
  type: 'occasion_without_gift' | 'pending_requests' | 'reservation_to_buy' | 'reservation_to_wrap' | 'reservation_to_give';
  date?: string | null; urgent?: boolean; person?: Person; occasion?: string | null; count?: number;
  reservation?: { id: Id; wishTitle?: string; status?: string; wishDeleted?: boolean };
}
export type Onboarding = { hasWishes: boolean; hasSharedFamily: boolean; hasNameDay: boolean; hasReservation: boolean }
export type Occasion = { id: Id; name?: string; title?: string; nextDate?: string | null; date?: string; year?: number; kind?: 'fixed' | 'birthday' | 'name_day'; person?: Person }
export type OccasionSelection = { id: Id; year: number }
export type ParticipationRequest = { id: Id; userId?: Id; firstName?: string; lastName?: string; user?: Person; requester?: Person; status?: string }
export type Reservation = {
  id: Id; wishId?: Id; wish?: Wish; occasionIds?: OccasionSelection[]; occasions?: Occasion[];
  participantIds?: Id[]; participants?: Person[]; creator?: Person; recipient?: Person;
  openToContributions?: boolean; status?: string; wishDeleted?: boolean; cancelled?: boolean;
  offList?: boolean; requestStatus?: 'pending' | 'accepted' | 'refused' | null;
}
export type Wish = {
  id: Id; title: string; image?: string | null; description?: string | null; url?: string | null;
  price?: number | string; tags?: string[]; ownerId?: Id; reservation?: Reservation;
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    const headers = new Headers(options.headers)
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    headers.set('Accept-Language', getLocale())
    response = await fetch(`/api${path}`, {
      credentials: 'include',
      ...options,
      headers,
    })
  } catch {
    throw new ApiError(translate('Connexion impossible. Vérifiez votre réseau et réessayez.', getLocale()), 0)
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = body && typeof body === 'object'
      ? body.message || body.error
      : null
    throw new ApiError(typeof detail === 'string' ? detail : translate('Une erreur est survenue ({status}).', getLocale(), { status: response.status }), response.status)
  }
  if (response.status === 204) return undefined as T
  const text = await response.text()
  if (!text) return undefined as T
  try { return JSON.parse(text) as T }
  catch { throw new ApiError(translate('Réponse du serveur invalide. Réessayez plus tard.', getLocale()), response.status) }
}

export const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })
export const list = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : []
export const nameOf = (person?: Person | null) => person
  ? [person.firstName, person.lastName].filter(Boolean).join(' ') || person.name || person.email || translate('Un proche', getLocale())
  : translate('Un proche', getLocale())
export const initials = (person?: Person | null) => nameOf(person).split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase()
export const money = (amount?: number | string) => formatMoney(amount, getLocale())
export const dateOf = (date?: string | null) => formatDate(date, getLocale())
