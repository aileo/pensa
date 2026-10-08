import { matchPath } from 'react-router'
import type { Page } from './app-types'

// The URL is authoritative: every supported view resolves to one of these canonical paths,
// and every canonical path resolves back to exactly one view here. Keep both directions here
// so navigation (`pagePath`) and rendering (`matchRoute`) never drift apart.
export const pagePath: Record<Page, string> = {
  dashboard: '/dashboard',
  wishes: '/wishes',
  families: '/families',
  reservations: '/reservations',
  history: '/history',
  search: '/search',
  profile: '/profile',
}

export type RouteMatch =
  | { page: 'wishes'; wishId?: string }
  | { page: 'families'; familyId?: string }
  | { page: 'personWishes'; personId: string }
  | { page: 'reservations'; reservationId?: string }
  | { page: 'dashboard' | 'history' | 'search' | 'profile' }
  | { page: 'notFound' }

export function matchRoute(pathname: string): RouteMatch {
  const wish = matchPath('/wishes/:id', pathname)
  if (wish) return { page: 'wishes', wishId: wish.params.id }
  if (matchPath('/wishes', pathname)) return { page: 'wishes' }

  const personWishes = matchPath('/users/:id/wishes', pathname)
  if (personWishes && personWishes.params.id) return { page: 'personWishes', personId: personWishes.params.id }

  const family = matchPath('/families/:id', pathname)
  if (family) return { page: 'families', familyId: family.params.id }
  if (matchPath('/families', pathname)) return { page: 'families' }

  const reservation = matchPath('/reservations/:id', pathname)
  if (reservation) return { page: 'reservations', reservationId: reservation.params.id }
  if (matchPath('/reservations', pathname)) return { page: 'reservations' }

  if (matchPath('/dashboard', pathname)) return { page: 'dashboard' }
  if (matchPath('/history', pathname)) return { page: 'history' }
  if (matchPath('/search', pathname)) return { page: 'search' }
  if (matchPath('/profile', pathname)) return { page: 'profile' }
  return { page: 'notFound' }
}

export const wishPath = (id: string) => `/wishes/${encodeURIComponent(id)}`
export const familyPath = (id: string) => `/families/${encodeURIComponent(id)}`
export const personWishesPath = (id: string) => `/users/${encodeURIComponent(id)}/wishes`
export const reservationPath = (id: string) => `/reservations/${encodeURIComponent(id)}`
