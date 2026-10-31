import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import { api, ApiError } from './api'
import { LocaleContext } from './language-context'

vi.mock('./api', async importOriginal => ({ ...await importOriginal<typeof import('./api')>(), api: vi.fn() }))
vi.mock('./AppShell', () => ({ AuthenticatedApp: ({ onLogout }: { onLogout: () => void }) => {
  const [moves, setMoves] = useState(0)
  return <><p>authenticated {moves}</p><button onClick={() => setMoves(value => value + 1)}>move</button><button onClick={onLogout}>logout</button></>
} }))
vi.mock('./features/auth/Auth', () => ({ Auth: () => <p>login form</p> }))

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  vi.mocked(api).mockReset()
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
const render = (locale: 'fr' | 'en' = 'en') => act(async () => {
  root.render(<LocaleContext.Provider value={{ locale, setLocale: () => {} }}><App/></LocaleContext.Provider>)
})

it.each([429, 500, 0])('shows recovery, not login, for session check status %s', async status => {
  vi.mocked(api).mockRejectedValueOnce(new ApiError('Temporary failure', status)).mockResolvedValueOnce({ id: 'me' })
  await render()
  expect(host.textContent).toContain('Could not check your session')
  expect(host.textContent).not.toContain('login form')
  await act(async () => host.querySelector('button')!.click())
  expect(host.textContent).toContain('authenticated')
  expect(api).toHaveBeenCalledTimes(2)
})

it('shows login for a confirmed 401', async () => {
  vi.mocked(api).mockRejectedValueOnce(new ApiError('Sign in required', 401))
  await render()
  expect(host.textContent).toContain('login form')
})

it('preserves an established account when a language-triggered check is rate limited', async () => {
  vi.mocked(api).mockResolvedValueOnce({ id: 'me' }).mockRejectedValueOnce(new ApiError('Too many requests', 429))
  await render()
  await render('fr')
  expect(host.textContent).toContain('authenticated')
  expect(host.textContent).not.toContain('login form')
  expect(host.textContent).toContain('Vérification de la session impossible')
  await act(async () => host.querySelectorAll('button')[2].click())
  expect(host.textContent).toContain('login form')
  expect(host.textContent).not.toContain('Vérification de la session impossible')
})

it('does not remount the authenticated app or lose pending moves after a successful session recheck', async () => {
  vi.mocked(api).mockResolvedValue({ id: 'me' })
  await render()
  await act(async () => host.querySelector('button')!.click())
  await render('fr')
  expect(host.textContent).toContain('authenticated 1')
})
