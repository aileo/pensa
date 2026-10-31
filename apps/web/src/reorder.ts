import { useEffect, useState, useSyncExternalStore } from 'react'
import { api, json, type Id } from './api'

type Order = {
  confirmed: Id[]
  desired: Id[]
  timer?: ReturnType<typeof setTimeout>
  flight?: Promise<void>
  error?: unknown
  uncertain?: boolean
}
const equal = (a: Id[], b: Id[]) => a.length === b.length && a.every((id, i) => String(id) === String(b[i]))

export class ReorderQueue {
  private orders = new Map<string, Order>()
  private listeners = new Set<() => void>()
  private version = 0
  private save: (owner: string, ids: Id[]) => Promise<unknown>
  constructor(save: (owner: string, ids: Id[]) => Promise<unknown>) { this.save = save }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  snapshot = () => this.version
  private emit() { this.version++; this.listeners.forEach(listener => listener()) }
  get pending() { return [...this.orders.values()].some(order => !!order.flight || !!order.uncertain || !equal(order.confirmed, order.desired)) }
  get error() { return [...this.orders.values()].find(order => order.error)?.error }
  get touched() { return this.orders.size > 0 }

  arrange<T extends { id: Id }>(owner: string, items: T[]): T[] {
    const order = this.orders.get(owner)
    if (!order || items.length !== order.desired.length) return items
    const byId = new Map(items.map(item => [String(item.id), item]))
    if (!order.desired.every(id => byId.has(String(id)))) return items
    return order.desired.map(id => byId.get(String(id))!)
  }

  move(owner: string, items: { id: Id }[], from: number, to: number) {
    const current = this.arrange(owner, items).map(item => item.id)
    if (from === to || from < 0 || to < 0 || from >= current.length || to >= current.length) return
    let order = this.orders.get(owner)
    if (!order) {
      order = { confirmed: current, desired: current }
      this.orders.set(owner, order)
    }
    const next = [...current]
    next.splice(to, 0, ...next.splice(from, 1))
    order.desired = next
    clearTimeout(order.timer)
    order.timer = undefined
    // A failed save needs an explicit retry, not another burst of rate-limited writes.
    if (!order.error && !equal(order.confirmed, next)) {
      order.timer = setTimeout(() => { order.timer = undefined; void this.run(owner, order) }, 500)
    }
    this.emit()
  }

  private async run(owner: string, order: Order): Promise<void> {
    if (order.flight) { await order.flight; return }
    if (order.error || (!order.uncertain && equal(order.confirmed, order.desired))) return
    const ids = [...order.desired]
    order.flight = (async () => {
      try { await this.save(owner, ids); order.confirmed = ids; order.uncertain = false }
      catch (problem) { order.error = problem; order.uncertain = true }
    })()
    this.emit()
    await order.flight
    order.flight = undefined
    // A burst during the write gets one follow-up, after its own quiet window.
    if (!order.error && !order.timer && !equal(order.confirmed, order.desired)) void this.run(owner, order)
    this.emit()
  }

  async flush(retry = false): Promise<void> {
    await Promise.all([...this.orders].map(async ([owner, order]) => {
      clearTimeout(order.timer)
      order.timer = undefined
      if (retry) order.error = undefined
      while (!order.error && (order.flight || order.uncertain || !equal(order.confirmed, order.desired))) {
        await this.run(owner, order)
      }
    }))
    this.emit()
    if (this.error) throw this.error
  }

  reset() { this.orders.clear(); this.emit() }
}

export function useReorderQueue(selfId: Id) {
  const [queue] = useState(() => new ReorderQueue((owner, ids) =>
    api(owner === String(selfId) ? '/wishes/order' : `/users/${encodeURIComponent(owner)}/wishes/order`, json('PATCH', { ids }))))
  useSyncExternalStore(queue.subscribe, queue.snapshot)
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (queue.pending) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => { window.removeEventListener('beforeunload', beforeUnload) }
  }, [queue])
  return queue
}
