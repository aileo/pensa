import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthenticatedApp } from './AppShell'
import { LocaleContext } from './language-context'
import { activateLocale } from './locale'

const me = { id: 'me', firstName: 'Alice', householdAdmin: true }
const managed = { id: 'child', firstName: 'Child', managed: true }
const wishes = Array.from({ length: 12 }, (_, i) => ({ id: `wish-${i}`, title: `Wish ${i}`, ownerId: 'me' }))
const childWishes = wishes.map(wish => ({ ...wish, id: `child-${wish.id}`, ownerId: 'child' }))
let host: HTMLDivElement
let root: Root
let requests: { path: string; method: string; body?: string }[]
let rejectSave: boolean

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  activateLocale('en')
  vi.useFakeTimers()
  requests = []
  rejectSave = false
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const path = url.replace('/api', '')
    const method = init?.method ?? 'GET'
    requests.push({ path, method, body: init?.body as string | undefined })
    if (method === 'PATCH') return Response.json(rejectSave ? { error: 'Too many requests' } : { ok: true }, { status: rejectSave ? 429 : 200 })
    const data: Record<string, unknown> = {
      '/dashboard': {}, '/families': [], '/users': [me, managed], '/wishes': wishes,
      '/reservations': [], '/households': [{ id: 'home', mine: true, members: [me, managed] }],
      '/users/child/wishes': childWishes, '/users/child/off-list': [],
    }
    return Response.json(data[path.split('?')[0]] ?? [])
  }))
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
async function render(path: string) {
  await act(async () => root.render(<LocaleContext.Provider value={{ locale: 'en', setLocale: () => {} }}><MemoryRouter initialEntries={[path]}><AuthenticatedApp me={me} onLogout={() => {}} onProfile={() => {}}/></MemoryRouter></LocaleContext.Provider>))
}
async function click(label: string) {
  const button = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  expect(button).not.toBeNull()
  await act(async () => button!.click())
}
async function settleSave() { await act(async () => { await vi.advanceTimersByTimeAsync(500) }) }

it.each(['/wishes', '/users/child/wishes'])('saves ten rapid arrow moves with one PATCH and no unrelated GETs on %s', async path => {
  await render(path)
  requests = []
  for (let i = 0; i < 10; i++) await click('Move Wish 0 down')
  expect(requests).toEqual([])
  await settleSave()
  expect(requests).toHaveLength(1)
  expect(requests[0].method).toBe('PATCH')
  expect(requests[0].path).toBe(path === '/wishes' ? '/wishes/order' : '/users/child/wishes/order')
  const ids = JSON.parse(requests[0].body!).ids
  expect(ids[10]).toBe(path === '/wishes' ? 'wish-0' : 'child-wish-0')
  expect(host.textContent).toContain('Order saved.')
})

it('saves a drag/drop once and retains a pending save across list navigation', async () => {
  await render('/wishes')
  requests = []
  const rows = host.querySelectorAll('[draggable="true"]')
  const drop = new Event('drop', { bubbles: true, cancelable: true })
  Object.defineProperty(drop, 'dataTransfer', { value: { getData: () => 'wish-0' } })
  await act(async () => rows[2].dispatchEvent(drop))
  const navigation = [...host.querySelectorAll('button')].find(button => button.textContent === 'My family')!
  await act(async () => navigation.click())
  await settleSave()
  expect(requests).toHaveLength(1)
  expect(JSON.parse(requests[0].body!).ids.slice(0, 3)).toEqual(['wish-1', 'wish-2', 'wish-0'])
})

it.each(['/wishes', '/users/child/wishes'])('moves a wish to the top or bottom with one PATCH on %s', async path => {
  await render(path)
  requests = []
  const prefix = path === '/wishes' ? 'wish' : 'child-wish'
  expect(host.querySelector<HTMLButtonElement>('button[aria-label="Move Wish 0 to the top"]')!.disabled).toBe(true)
  await click('Move Wish 3 to the top')
  await click('Move Wish 1 to the bottom')
  await settleSave()
  expect(requests).toHaveLength(1)
  const ids: string[] = JSON.parse(requests[0].body!).ids
  expect(ids.slice(0, 2)).toEqual([`${prefix}-3`, `${prefix}-0`])
  expect(ids.at(-1)).toBe(`${prefix}-1`)
  expect(host.querySelector<HTMLButtonElement>('button[aria-label="Move Wish 1 to the bottom"]')!.disabled).toBe(true)
})

it('reorders through a full drag sequence even when drop data is unavailable', async () => {
  await render('/wishes')
  requests = []
  const rows = host.querySelectorAll('[draggable="true"]')
  const dragEvent = (type: string) => {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', { value: { setData: () => {}, getData: () => '', effectAllowed: '', dropEffect: '' } })
    return event
  }
  await act(async () => rows[0].dispatchEvent(dragEvent('dragstart')))
  await act(async () => rows[2].dispatchEvent(dragEvent('dragover')))
  await act(async () => rows[2].dispatchEvent(dragEvent('drop')))
  await act(async () => rows[0].dispatchEvent(dragEvent('dragend')))
  await settleSave()
  expect(requests).toHaveLength(1)
  expect(JSON.parse(requests[0].body!).ids.slice(0, 3)).toEqual(['wish-1', 'wish-2', 'wish-0'])
})

it('disables managed-list reordering when filters are active', async () => {
  await render('/users/child/wishes?tag=books')
  expect(host.querySelectorAll('[draggable="true"]')).toHaveLength(0)
  expect(host.textContent).toContain('Clear the filters to reorder this list.')
})

it('shows a failed save without logout, retry storms, or false success', async () => {
  await render('/wishes')
  requests = []
  rejectSave = true
  await click('Move Wish 0 down')
  const leave = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(leave)
  expect(leave.defaultPrevented).toBe(true)
  await settleSave()
  expect(host.textContent).toContain('Order not saved.')
  expect(host.textContent).not.toContain('Order saved.')
  expect(host.textContent).toContain('Alice')
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(requests).toHaveLength(1)
  rejectSave = false
  const retry = [...host.querySelectorAll('button')].find(button => button.textContent === 'Try again')!
  await act(async () => retry.click())
  expect(requests).toHaveLength(2)
  expect(host.textContent).toContain('Order saved.')
})
