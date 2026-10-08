export type Page = 'dashboard' | 'wishes' | 'families' | 'reservations' | 'history' | 'search' | 'profile'
export type Modal = 'wish' | 'family' | 'occasion' | 'reservation' | 'editWish' | 'offList' | null
export type WishFilters = { tag: string; availability: string; minPrice: string; maxPrice: string }
export type ReservationStatus = 'reserved' | 'purchased' | 'wrapped' | 'gifted'
