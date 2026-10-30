import { describe, expect, it } from 'vitest'
import { TEMPLATES } from '../data/templates'
import { summarize, type EventSummary } from './db'
import { eventDate, hubEvents, isoDay, matchesQuery } from './hubList'
import { parseRoute, pathFor } from './route'
import { readThumb, SHAPE, TONE, planThumb } from './thumb'
import { el, planWith, rect, shape } from '../test/fixtures'

describe('thumbnails', () => {
  it('reduce a plan to numbers only, and read back the same shapes', () => {
    const plan = planWith([
      el('round-10', 5, 5, { label: '<img onerror=alert(1)>', color: 'red" onload="x' }),
      el('stage', 15, 3, { rotation: 90 }),
      shape('crowd-area', rect(0, 10, 10, 20)),
      shape('crowd-barrier', [{ x: 0, y: 0 }, { x: 10, y: 0 }]),
      el('staff-steward', 1, 1), // workforce is left out
    ])
    const t = planThumb(plan)
    expect(t.s.every((n) => typeof n === 'number' && Number.isFinite(n))).toBe(true)
    expect(JSON.stringify(t)).not.toMatch(/img|onload|red/)
    const shapes = readThumb(t)
    expect(shapes).toHaveLength(4)
    expect(shapes[0]).toMatchObject({ kind: SHAPE.area, tone: TONE.area }) // areas draw first
    expect(shapes.find((x) => x.kind === SHAPE.ellipse)).toMatchObject({ tone: TONE.table, x: 5, y: 5, w: 1.8 })
    expect(shapes.find((x) => x.kind === SHAPE.box)).toMatchObject({ tone: TONE.staging, rotation: 90 })
    expect(shapes.find((x) => x.kind === SHAPE.line)).toMatchObject({ tone: TONE.barrier, points: [[0, 0], [10, 0]] })
  })

  it('stop at malformed data instead of drawing garbage', () => {
    expect(readThumb({ w: 10, h: 10, s: [SHAPE.box, 0, 1, 2] })).toEqual([])
    expect(readThumb({ w: 10, h: 10, s: [SHAPE.line, 0, 99, 1, 2] })).toEqual([])
    expect(readThumb({ w: 10, h: 10, s: [7, 0, 1, 2, 3, 4, 5] })).toEqual([])
  })

  it('stay small for every template', () => {
    for (const t of TEMPLATES) expect(JSON.stringify(planThumb(t.build())).length, t.name).toBeLessThan(40_000)
  })
})

describe('event summaries', () => {
  it('count tables, seats and seated guests', () => {
    const plan = { ...TEMPLATES[0].build(), guests: [{ id: 'g1', name: 'Ana', tableId: 'x' }, { id: 'g2', name: 'Bo' }] }
    expect(summarize(plan).counts).toMatchObject({ levels: 1, tables: 20, seats: 200, guests: 2, seated: 1 })
  })
})

const ev = (id: string, extra: Partial<EventSummary> = {}): EventSummary => ({ id, name: id, venue: '', date: '', updatedAt: 0, ...extra })

describe('hub list', () => {
  const today = '2026-10-30'
  const events = [
    ev('Gala', { date: '2026-11-14', updatedAt: 3, venue: 'Riverside Hall' }),
    ev('Summit', { date: '2026-12-02', updatedAt: 5, shared: true }),
    ev('Wedding', { date: '2026-10-03', updatedAt: 9 }),
    ev('Draft', { updatedAt: 7 }),
    ev('Old expo', { date: '2025-05-01', updatedAt: 1, archived: true }),
  ]
  const names = (opts: Parameters<typeof hubEvents>[1]) => hubEvents(events, { today, ...opts }).map((e) => e.name)

  it('hides archived events except under Archived', () => {
    expect(names({ filter: 'all', sort: 'edited', query: '' })).toEqual(['Wedding', 'Draft', 'Summit', 'Gala'])
    expect(names({ filter: 'archived', sort: 'edited', query: '' })).toEqual(['Old expo'])
  })

  it('splits upcoming and past by the event date', () => {
    expect(names({ filter: 'upcoming', sort: 'date', query: '' })).toEqual(['Gala', 'Summit'])
    expect(names({ filter: 'past', sort: 'date', query: '' })).toEqual(['Wedding'])
  })

  it('finds shared events, by flag or by role', () => {
    expect(names({ filter: 'shared', sort: 'name', query: '', sharedIds: new Set(['Gala']) })).toEqual(['Gala', 'Summit'])
  })

  it('searches names and venues, ignoring case and accents', () => {
    expect(names({ filter: 'all', sort: 'edited', query: 'riverside' })).toEqual(['Gala'])
    expect(matchesQuery({ name: 'Boda en Mérida' }, 'merida')).toBe(true)
  })

  it('sorts undated events last by date', () => {
    expect(names({ filter: 'all', sort: 'date', query: '' })).toEqual(['Wedding', 'Gala', 'Summit', 'Draft'])
  })

  it('describes dates relative to today', () => {
    expect(eventDate('2026-11-14', today)).toMatchObject({ when: 'in 15 days', past: false })
    expect(eventDate('2026-10-31', today)?.when).toBe('tomorrow')
    expect(eventDate('2026-10-30', today)?.when).toBe('today')
    expect(eventDate('2026-10-03', today)).toMatchObject({ when: '27 days ago', past: true })
    expect(eventDate('2027-06-01', today)?.when).toBe('in 7 months')
    expect(eventDate('', today)).toBeNull()
    expect(eventDate('soon', today)).toBeNull()
    expect(isoDay(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('addresses', () => {
  it('map the hub and events to paths and back', () => {
    expect(parseRoute('/')).toEqual({ view: 'hub' })
    expect(parseRoute('/events/AbC_12-x')).toEqual({ view: 'editor', id: 'AbC_12-x' })
    expect(parseRoute('/events/AbC_12-x/')).toEqual({ view: 'editor', id: 'AbC_12-x' })
    expect(parseRoute('/events/../etc')).toEqual({ view: 'hub' })
    expect(parseRoute('/somewhere/else')).toEqual({ view: 'hub' })
    expect(pathFor('editor', 'AbC_12-x')).toBe('/events/AbC_12-x')
    expect(pathFor('hub', 'AbC_12-x')).toBe('/')
  })
})
