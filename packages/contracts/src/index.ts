export type Id = string | number

export type Person = {
  id: Id
  firstName?: string
  lastName?: string
  email?: string | null
  birthDate?: string
  avatar?: string | null
  householdId?: Id
  name?: string
  nameDay?: string | null
  householdAdmin?: boolean
  familyAdmin?: boolean
  managed?: boolean
}
export type PersonView = Omit<Person, 'id'> & { id: string }

export type Household = { id: Id; name: string; mine?: boolean; members?: Person[] }
export type Family = { id: Id; name: string; admin?: boolean; members?: Person[]; households?: Household[]; users?: Person[] }
export type Todo = {
  type: 'occasion_without_gift' | 'pending_requests' | 'reservation_to_buy' | 'reservation_to_wrap' | 'reservation_to_give' | 'managed_list_empty'
  date?: string | null
  urgent?: boolean
  person?: Person
  occasion?: string | null
  count?: number
  reservation?: { id: Id; wishTitle?: string; status?: string; wishDeleted?: boolean }
}
export type Onboarding = { hasWishes: boolean; hasSharedFamily: boolean; hasNameDay: boolean; hasReservation: boolean }
export type Occasion = { id: Id; name?: string; title?: string; nextDate?: string | null; date?: string; year?: number; kind?: 'fixed' | 'birthday' | 'name_day'; person?: Person }
export type OccasionSelection = { id: Id; year: number }
export type ParticipationRequest = { id: Id; userId?: Id; firstName?: string; lastName?: string; user?: Person; requester?: Person; status?: string }
export type Reservation = {
  id: Id
  wishId?: Id
  wish?: Wish
  occasionIds?: OccasionSelection[]
  occasions?: Occasion[]
  participantIds?: Id[]
  participants?: Person[]
  creator?: Person
  recipient?: Person
  openToContributions?: boolean
  status?: string
  wishDeleted?: boolean
  cancelled?: boolean
  offList?: boolean
  requestStatus?: 'pending' | 'accepted' | 'refused' | null
}
export type Wish = {
  id: Id
  title: string
  image?: string | null
  description?: string | null
  url?: string | null
  price?: number | string
  tags?: string[]
  ownerId?: Id
  reservation?: Reservation
}
