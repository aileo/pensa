export type Id = string | number
export type Person = { id: Id; firstName?: string; lastName?: string; email?: string; birthDate?: string; name?: string }
export type Family = { id: Id; name: string; admin?: boolean; members?: Person[]; users?: Person[] }
export type Occasion = { id: Id; name?: string; title?: string; nextDate?: string | null; date?: string; year?: number; kind?: 'fixed' | 'birthday' | 'name_day'; person?: Person }
export type OccasionSelection = { id: Id; year: number }
export type ParticipationRequest = { id: Id; userId?: Id; firstName?: string; lastName?: string; user?: Person; requester?: Person; status?: string }
export type Reservation = {
  id: Id; wishId?: Id; wish?: Wish; occasionIds?: OccasionSelection[]; occasions?: Occasion[];
  participantIds?: Id[]; participants?: Person[]; creator?: Person;
  openToContributions?: boolean; status?: string; wishDeleted?: boolean; cancelled?: boolean;
}
export type Wish = {
  id: Id; title: string; image?: string; description?: string; url?: string;
  price?: number | string; tags?: string[]; ownerId?: Id; reservation?: Reservation;
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw new ApiError('Connexion impossible. Vérifiez votre réseau et réessayez.', 0)
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = body && typeof body === 'object'
      ? body.message || body.error
      : null
    throw new ApiError(typeof detail === 'string' ? detail : `Une erreur est survenue (${response.status}).`, response.status)
  }
  if (response.status === 204) return undefined as T
  const text = await response.text()
  if (!text) return undefined as T
  try { return JSON.parse(text) as T }
  catch { throw new ApiError('Réponse du serveur invalide. Réessayez plus tard.', response.status) }
}

export const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) })
export const list = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : []
export const nameOf = (person?: Person | null) => person
  ? [person.firstName, person.lastName].filter(Boolean).join(' ') || person.name || person.email || 'Un proche'
  : 'Un proche'
export const initials = (person?: Person | null) => nameOf(person).split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase()
export const money = (amount?: number | string) => amount === undefined || amount === null || amount === ''
  ? '' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(amount) || 0)} €`
export const dateOf = (date?: string) => {
  if (!date) return ''
  const value = new Date(date)
  return Number.isNaN(value.getTime()) ? date : new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(value)
}
