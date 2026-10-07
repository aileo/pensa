import { formatDate, formatMoney, getLocale, translate } from './locale'
import type { Family, Household, Id, Occasion, OccasionSelection, Onboarding, ParticipationRequest, Person, Reservation, Todo, Wish } from '../../../packages/contracts/src/index'

export type { Family, Household, Id, Occasion, OccasionSelection, Onboarding, ParticipationRequest, Person, Reservation, Todo, Wish }

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
