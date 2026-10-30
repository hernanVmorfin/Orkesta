import { describe, expect, it } from 'vitest'
import type { Guest } from '../types'
import { autoSeat } from './seating'
import { el, planWith } from '../test/fixtures'

let n = 0
const guests = (count: number, extra: Partial<Guest> = {}): Guest[] =>
  Array.from({ length: count }, () => ({ id: `g${++n}`, name: `Guest ${n}`, ...extra }))

const tableOf = (assign: Map<string, string | null>, gs: Guest[]) => new Set(gs.map((g) => assign.get(g.id)))

describe('auto-seat', () => {
  it('keeps each group at one table when it fits', () => {
    const t1 = el('round-8', 0, 0, { number: 1 }), t2 = el('round-8', 5, 0, { number: 2 })
    const a = guests(6, { group: 'Acme' }), b = guests(6, { group: 'Globex' })
    const r = autoSeat(planWith([t1, t2], { guests: [...a, ...b] }), { mode: 'order', reseatAll: false })
    expect(r).toMatchObject({ seated: 12, unseated: 0 })
    expect(tableOf(r.assign, a).size).toBe(1)
    expect(tableOf(r.assign, b).size).toBe(1)
    expect(tableOf(r.assign, a)).not.toEqual(tableOf(r.assign, b))
  })

  it('splits a group too big for one table across neighbouring tables', () => {
    const near = [el('round-8', 0, 0, { number: 1 }), el('round-8', 4, 0, { number: 2 })]
    const far = el('round-8', 40, 0, { number: 3 })
    const big = guests(12, { group: 'Initech' })
    const r = autoSeat(planWith([...near, far], { guests: big }), { mode: 'order', reseatAll: false })
    expect(r.seated).toBe(12)
    expect(tableOf(r.assign, big)).toEqual(new Set(near.map((t) => t.id)))
  })

  it('seats tagged guests only at their own tables, and keeps those tables for them', () => {
    const vip = el('round-8', 0, 0, { number: 1, tag: 'vip' }), general = el('round-8', 5, 0, { number: 2, tag: 'general' })
    const vips = guests(3, { tag: 'vip' }), others = guests(5)
    const r = autoSeat(planWith([vip, general], { guests: [...vips, ...others] }), { mode: 'order', reseatAll: false })
    expect(tableOf(r.assign, vips)).toEqual(new Set([vip.id]))
    expect(tableOf(r.assign, others)).toEqual(new Set([general.id]))
    expect(r.reservedFree).toBe(5)
  })

  it('overflows tagged guests to General tables, never to another tag', () => {
    const vip = el('round-8', 0, 0, { number: 1, tag: 'vip' })
    const sponsor = el('round-8', 5, 0, { number: 2, tag: 'sponsor' })
    const general = el('round-8', 10, 0, { number: 3, tag: 'general' })
    const vips = guests(10, { tag: 'vip' })
    const r = autoSeat(planWith([vip, sponsor, general], { guests: vips }), { mode: 'order', reseatAll: false })
    expect(r.seated).toBe(10)
    expect([...r.assign.values()].filter((t) => t === sponsor.id)).toHaveLength(0)
  })

  it('leaves guests seated by hand where they are unless asked to re-seat everyone', () => {
    const t1 = el('round-8', 0, 0, { number: 1 }), t2 = el('round-8', 5, 0, { number: 2 })
    const [manual] = guests(1, { tableId: t2.id })
    const plan = planWith([t1, t2], { guests: [manual, ...guests(3)] })
    expect(autoSeat(plan, { mode: 'order', reseatAll: false }).assign.has(manual.id)).toBe(false)
    expect(autoSeat(plan, { mode: 'order', reseatAll: true }).assign.get(manual.id)).toBe(t1.id)
  })

  it('reports guests who don’t fit', () => {
    const r = autoSeat(planWith([el('round-8', 0, 0, { number: 1 })], { guests: guests(11) }), { mode: 'order', reseatAll: false })
    expect(r).toMatchObject({ seated: 8, unseated: 3 })
  })
})
