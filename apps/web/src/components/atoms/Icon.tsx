import type { ReactNode } from 'react'

export type IconName = 'home' | 'heart' | 'users' | 'gift' | 'clock' | 'search' | 'user' | 'plus' | 'arrow' | 'arrowLeft' | 'arrowUp' | 'arrowDown' | 'link' | 'calendar' | 'trash' | 'edit' | 'check' | 'close' | 'menu' | 'logout' | 'spark' | 'grip' | 'chevron' | 'external' | 'cart' | 'box' | 'party'

const paths: Record<IconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-7h6v7"/></>,
  heart: <path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.5a5.5 5.5 0 0 0 0-7.8z"/>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></>,
  gift: <><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M2 8h20M12 8v13M12 8H8a3 3 0 1 1 3-3c0 1.5 1 3 1 3zm0 0h4a3 3 0 1 0-3-3c0 1.5-1 3-1 3z"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
  arrowLeft: <path d="M19 12H5m6 6-6-6 6-6"/>,
  arrowUp: <path d="M12 19V5m-6 6 6-6 6 6"/>,
  arrowDown: <path d="M12 5v14m6-6-6 6-6-6"/>,
  link: <><path d="M10 13a5 5 0 0 0 7.1 0l2.1-2.1a5 5 0 0 0-7.1-7.1L11 5"/><path d="M14 11a5 5 0 0 0-7.1 0l-2.1 2.1a5 5 0 0 0 7.1 7.1L13 19"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></>,
  trash: <><path d="M4 7h16M9 7V4h6v3m4 0-1 14H6L5 7"/><path d="M10 11v6m4-6v6"/></>,
  edit: <><path d="m4 17 12-12 3 3L7 20H4zM14 7l3 3"/></>,
  check: <path d="m4 12 5 5L20 6"/>,
  close: <path d="M5 5 19 19M19 5 5 19"/>,
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
  logout: <><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M14 8l4 4-4 4m4-4H9"/></>,
  spark: <><path d="m12 2 2 7 7 3-7 2-2 8-2-8-7-2 7-3z"/></>,
  grip: <><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  external: <><path d="M13 4h7v7m0-7-9 9"/><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/></>,
  cart: <><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12h11L21 7H6"/></>,
  box: <><path d="M3 8h18v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 8l2-4h14l2 4"/><path d="M12 4v17M8.5 8c-1.4 0-2.5-.9-2.5-2s1.1-2 2.5-2S12 5.5 12 8m3.5 0c1.4 0 2.5-.9 2.5-2s-1.1-2-2.5-2S12 5.5 12 8"/></>,
  party: <><path d="m3 21 5-14 9 9z"/><path d="M14 3.5c1.2.6 1.6 2 1 3.2M18 2c1.8.9 2.5 3 1.6 4.8M20.5 11c-.6-1.2-2-1.6-3.2-1M22 15c-.9-1.8-3-2.5-4.8-1.6"/></>,
}

export function Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
