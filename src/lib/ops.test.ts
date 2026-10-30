import { describe, expect, it } from 'vitest'
import { crowdCapacity, exitFlow, postCount, sectionCount } from './calcs'
import { arrivalModel, arrivalOf, clashes, egress, exitBlockers, expectedCrowd, inventory, powerBudget, queueLineM, scheduleItems } from './ops'
import { el, planWith, rect, shape } from '../test/fixtures'

const line = (kind: string, lengthM: number) => shape(kind, [{ x: 0, y: 0 }, { x: lengthM, y: 0 }])

describe('calculators', () => {
  it('counts standing capacity from area and density', () => {
    const area = shape('crowd-area', rect(0, 0, 10, 10))
    expect(crowdCapacity(area)).toBe(200) // default 0.5 m² per person
    expect(crowdCapacity({ ...area, calc: { sqmPerPerson: 2 } })).toBe(50)
  })

  it('rounds barrier sections up, without an extra one on exact multiples', () => {
    expect(sectionCount(line('crowd-barrier', 16.6))).toBe(8) // 2.2 m sections
    expect(sectionCount(line('crowd-barrier', 22))).toBe(10)
  })

  it('counts posts at both ends of a line', () => {
    expect(postCount(line('queue-line', 10))).toBe(6) // 2 m spacing
    expect(postCount(line('cone-line', 10))).toBe(9) // 1.25 m spacing
  })

  it('adds spares to sections and posts', () => {
    expect(sectionCount({ ...line('crowd-barrier', 16.6), calc: { spares: 2 } })).toBe(10)
    expect(postCount({ ...line('queue-line', 10), calc: { spares: 1 } })).toBe(7)
    expect(sectionCount({ ...line('crowd-barrier', 16.6), calc: { spares: -3 } })).toBe(8)
  })

  it('slows exit flow on stairs and with a conservative rate', () => {
    const level = el('exit', 0, 0)
    const stairs = { ...level, calc: { stairs: 1 } }
    expect(exitFlow(level, planWith([]))).toBeCloseTo(1.2 * 82)
    expect(exitFlow(stairs, planWith([]))).toBeCloseTo(1.2 * 66)
    expect(exitFlow(level, planWith([], { safety: { flowRate: 40, worstCase: true, exitClearM: 1.5 } }))).toBeCloseTo(48)
  })
})

describe('evacuation', () => {
  const room = () => [
    el('round-10', 10, 10), el('round-10', 15, 10),
    shape('crowd-area', rect(20, 0, 30, 10)),
    el('exit', 1, 1), el('exit', 29, 19, { calc: { widthM: 2 } }),
  ]

  it('counts seats plus standing capacity', () => {
    const eg = egress(planWith(room()), null)
    expect(eg).toMatchObject({ seats: 20, standing: 200, occupancy: 220 })
  })

  it('assumes the widest exit is blocked by default', () => {
    const eg = egress(planWith(room()), null)
    expect(eg.lost?.label).toBe('Emergency exit')
    expect(eg.capacity).toBeCloseTo(1.2 * 82)
    expect(eg.minutes).toBeCloseTo(220 / (1.2 * 82))
  })

  it('uses every exit when the worst case is off, and the crowd size when set', () => {
    const eg = egress(planWith(room(), { safety: { flowRate: 82, worstCase: false, exitClearM: 1.5, crowdSize: 500 } }), null)
    expect(eg.capacity).toBeCloseTo(3.2 * 82)
    expect(eg.occupancy).toBe(500)
  })

  it('never clears without exits', () => {
    expect(egress(planWith([el('round-10', 10, 10)]), null).minutes).toBe(Infinity)
  })

  it('flags objects in front of an exit, but not staff, signs or areas', () => {
    const exit = el('exit', 1, 1)
    const blocked = (o: ReturnType<typeof el>) => exitBlockers(planWith([exit, o]), null).length
    expect(blocked(el('generator', 2.5, 1))).toBe(1)
    expect(blocked(el('staff-steward', 2, 1))).toBe(0)
    expect(blocked(shape('crowd-area', rect(0, 0, 10, 10)))).toBe(0)
    expect(blocked(shape('crowd-barrier', [{ x: 2, y: -2 }, { x: 2, y: 5 }]))).toBe(1)
  })
})

describe('arrivals', () => {
  const desk = el('registration', 5, 5) // 45 people per 15 minutes

  it('builds and clears a queue slot by slot', () => {
    const { rows, capacity } = arrivalModel(planWith([desk], { arrival: { start: '18:00', slots: [60, 60, 0] } }))
    expect(capacity).toBe(45)
    expect(rows.map((r) => r.queue)).toEqual([15, 30, 0])
    expect(rows[1]).toMatchObject({ time: '18:15', waitMin: 10, lengthM: 8 })
  })

  it('keeps going past the last slot until the queue is gone', () => {
    const { rows } = arrivalModel(planWith([desk], { arrival: { start: '23:45', slots: [100] } }))
    expect(rows.map((r) => [r.time, r.queue])).toEqual([['23:45', 55], ['00:00', 10], ['00:15', 0]])
  })

  it('reports an endless wait without entrances', () => {
    const { rows } = arrivalModel(planWith([], { arrival: { start: '18:00', slots: [10] } }))
    expect(rows).toHaveLength(1)
    expect(rows[0].waitMin).toBe(Infinity)
  })

  it('measures the queue lines people can wait along', () => {
    const plan = planWith([desk, line('queue-line', 12), line('queue-line', 8), { ...line('queue-line', 50), hidden: true }, line('crowd-barrier', 30)])
    expect(queueLineM(plan)).toBeCloseTo(20)
  })

  it('spreads the expected crowd over 75 minutes until arrivals are entered', () => {
    const plan = planWith(Array.from({ length: 20 }, (_, i) => el('round-10', i * 5, 0)))
    expect(expectedCrowd(plan)).toBe(200)
    const slots = arrivalOf(plan).slots
    expect(slots).toHaveLength(5)
    expect(slots.reduce((a, b) => a + b, 0)).toBe(200)
    expect(Math.max(...slots)).toBe(slots[2])
    expect(arrivalOf({ ...plan, arrival: { start: '19:00', slots: [5] } }).slots).toEqual([5])
  })
})

describe('power, schedule and inventory', () => {
  it('compares supply and draw per zone', () => {
    const pb = powerBudget(planWith([
      el('generator', 0, 0, { setup: { zone: 'Stage' } }),
      el('speaker', 0, 0, { setup: { zone: 'Stage', powerKw: 40 } }),
      el('screen', 0, 0, { setup: { zone: 'Stage', powerKw: 25 } }),
      el('coffee', 0, 0, { setup: { powerKw: 3 } }),
    ]))
    expect(pb).toMatchObject({ supply: 60, draw: 68 })
    expect(pb.zones.map((z) => [z.zone, z.supply, z.draw])).toEqual([['No zone', 0, 3], ['Stage', 60, 65]])
  })

  it('finds different vendors in the same zone at the same time', () => {
    const at = (vendor: string, zone: string, inAt: string, outAt?: string) => el('bar', 0, 0, { setup: { vendor, zone, inAt, outAt } })
    const items = scheduleItems(planWith([
      at('Bar Co', 'Hall', '2026-11-01T08:00', '2026-11-01T10:00'),
      at('AV Co', 'Hall', '2026-11-01T09:00', '2026-11-01T11:00'), // overlaps Bar Co
      at('AV Co', 'Hall', '2026-11-01T09:30'), // same vendor as above; 1-hour slot
      at('Decor Co', 'Hall', '2026-11-01T10:00', '2026-11-01T12:00'), // starts as Bar Co ends
      at('Bar Co', 'Foyer', '2026-11-01T09:00', '2026-11-01T10:00'), // other zone
    ]))
    expect(items[2].end - items[2].start).toBe(3600_000)
    const pairs = clashes(items).map((c) => [c.a.vendor, c.b.vendor].sort().join(' + '))
    expect(pairs.sort()).toEqual(['AV Co + Bar Co', 'AV Co + Bar Co', 'AV Co + Decor Co', 'AV Co + Decor Co'])
  })

  it('counts sections and cones, not just objects', () => {
    const lines = inventory(planWith([line('crowd-barrier', 16.6), line('crowd-barrier', 4.4), line('cone-line', 10), el('round-10', 0, 0)]))
    const byKind = Object.fromEntries(lines.map((l) => [l.kind, l]))
    expect(byKind['crowd-barrier']).toMatchObject({ count: 2, quantity: 10, unit: 'sections' })
    expect(byKind['crowd-barrier'].lengthM).toBeCloseTo(21)
    expect(byKind['cone-line']).toMatchObject({ quantity: 9, unit: 'cones' })
    expect(byKind['round-10']).toMatchObject({ count: 1, quantity: 1, unit: 'pcs' })
  })
})
