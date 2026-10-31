import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReorderQueue } from './reorder'

const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
describe('reorder persistence', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('coalesces a burst and saves only the final order after 500ms', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true })
    const queue = new ReorderQueue(save)
    for (let i = 0; i < 10; i++) queue.move('owner', items, 0, 1)
    queue.move('owner', items, 0, 2)
    await vi.advanceTimersByTimeAsync(499)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledExactlyOnceWith('owner', ['b', 'c', 'a'])
    expect(queue.pending).toBe(false)
  })

  it('does not save moves undone during the debounce window', async () => {
    const save = vi.fn()
    const queue = new ReorderQueue(save)
    queue.move('owner', items, 0, 1)
    queue.move('owner', items, 1, 0)
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).not.toHaveBeenCalled()
    expect(queue.pending).toBe(false)
  })

  it('serializes an in-flight write and coalesces its follow-up', async () => {
    let finish!: () => void
    const save = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve })).mockResolvedValue({ ok: true })
    const queue = new ReorderQueue(save)
    queue.move('owner', items, 0, 1)
    await vi.advanceTimersByTimeAsync(500)
    queue.move('owner', items, 0, 2)
    queue.move('owner', items, 0, 1)
    await vi.advanceTimersByTimeAsync(500)
    expect(save).toHaveBeenCalledTimes(1)
    finish()
    await queue.flush()
    expect(save.mock.calls).toEqual([['owner', ['b', 'a', 'c']], ['owner', ['c', 'a', 'b']]])
  })

  it('keeps owners independent and never overlays a changed list membership', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true })
    const queue = new ReorderQueue(save)
    queue.move('one', items, 0, 1)
    queue.move('two', items, 0, 2)
    expect(queue.arrange('one', items).map(item => item.id)).toEqual(['b', 'a', 'c'])
    const fresh = [{ id: 'a', title: 'Updated' }, { id: 'new', title: 'New wish' }]
    expect(queue.arrange('one', fresh)).toBe(fresh)
    await queue.flush()
    expect(save.mock.calls).toEqual([['one', ['b', 'a', 'c']], ['two', ['b', 'c', 'a']]])
  })

  it('retains the latest unsaved order after 429 and retries only explicitly', async () => {
    const error = new Error('Too many requests')
    const save = vi.fn().mockRejectedValueOnce(error).mockResolvedValue({ ok: true })
    const queue = new ReorderQueue(save)
    queue.move('owner', items, 0, 1)
    await vi.advanceTimersByTimeAsync(500)
    queue.move('owner', items, 0, 2)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(save).toHaveBeenCalledTimes(1)
    expect(queue.error).toBe(error)
    expect(queue.pending).toBe(true)
    await expect(queue.flush()).rejects.toBe(error)
    await queue.flush(true)
    expect(save).toHaveBeenLastCalledWith('owner', ['a', 'c', 'b'])
    expect(queue.pending).toBe(false)
    expect(queue.error).toBeUndefined()
  })

  it('resends an undone order after an ambiguous failure instead of assuming it was not applied', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('Response lost')).mockResolvedValue({})
    const queue = new ReorderQueue(save)
    queue.move('owner', items, 0, 1)
    await vi.advanceTimersByTimeAsync(500)
    queue.move('owner', items, 1, 0)
    expect(queue.pending).toBe(true)
    await queue.flush(true)
    expect(save).toHaveBeenLastCalledWith('owner', ['a', 'b', 'c'])
    expect(save).toHaveBeenCalledTimes(2)
    expect(queue.pending).toBe(false)
  })
})
