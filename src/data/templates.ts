import { nanoid } from 'nanoid'
import type { Group, Plan, PlanElement, Pt } from '../types'
import { CATALOG, isTableKind } from '../lib/catalog'
import { blankPlan } from './blankPlan'
import { seatBlock } from '../lib/layouts'
import { normalize } from '../lib/shapes'

/**
 * Starter layouts that open as a new, editable event. Built from catalog objects so sizes stay
 * true to scale; exits, entrances and power are included so the Ops tab has something to show.
 */

export interface Template { id: string; name: string; description: string; build: () => Plan }

type Draft = Omit<PlanElement, 'id'>

function el(kind: string, x: number, y: number, extra: Partial<PlanElement> = {}): Draft {
  const c = CATALOG[kind]
  return { kind, label: c.name, x, y, w: c.w, h: c.h, rotation: 0, layer: c.layer, seats: c.seats, ...(isTableKind(kind) ? { tag: 'general' } : {}), ...extra }
}

/** A drawn line or area from plan points. */
function shape(kind: string, pts: Pt[], extra: Partial<PlanElement> = {}): Draft {
  const c = CATALOG[kind]
  return { kind, label: c.name, rotation: 0, layer: c.layer, ...normalize(pts), ...extra }
}

/** Gives ids and table numbers; folders become groups. */
function finish(p: Plan, drafts: Draft[], folders: { name: string; drafts: Draft[] }[] = []): Plan {
  let n = 0
  const groups: Group[] = []
  const make = (d: Draft, groupId?: string): PlanElement => {
    const number = isTableKind(d.kind) ? ++n : undefined
    return { ...d, id: nanoid(8), groupId, number, label: number != null ? `Table ${number}` : d.label }
  }
  const elements = drafts.map((d) => make(d))
  for (const f of folders) {
    const id = nanoid(8)
    groups.push({ id, name: f.name, layer: f.drafts[0]?.layer ?? 'seating', visible: true, locked: false })
    elements.push(...f.drafts.map((d) => make(d, id)))
  }
  return { ...p, elements, groups: groups.length ? groups : undefined, updatedAt: Date.now() }
}

const exits = (w: number, h: number): Draft[] => [
  el('exit', 1.2, 1.2, { label: 'Exit A' }), el('exit', w - 1.2, 1.2, { label: 'Exit B' }),
  el('exit', 1.2, h - 1.2, { label: 'Exit C' }), el('exit', w - 1.2, h - 1.2, { label: 'Exit D' }),
]

export const TEMPLATES: Template[] = [
  {
    id: 'gala', name: 'Gala dinner', description: '20 round tables of 10, stage, dance floor, two bars · 40 × 30 m',
    build: () => {
      const p = { ...blankPlan(), name: 'Gala dinner', widthM: 40, heightM: 30 }
      const d: Draft[] = [
        el('stage', 20, 3), el('screen', 9, 1.5, { label: 'LED screen L' }), el('screen', 31, 1.5, { label: 'LED screen R' }), el('podium', 23.5, 3),
        el('dance-floor', 20, 9.5, { w: 8, h: 6 }),
        el('bar', 2.5, 15, { label: 'Bar 1' }), el('bar', 37.5, 15, { label: 'Bar 2' }),
        el('foh', 20, 28), el('registration', 6, 28.4), el('registration', 34, 28.4),
        el('firstaid', 38.6, 22), el('extinguisher', 1.2, 8), el('extinguisher', 38.8, 8),
        el('generator', 36, 26.5, { setup: { vendor: 'Power Co', zone: 'Back of house' } }),
        ...exits(40, 30),
      ]
      for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) d.push(el('round-10', 8 + c * 6, 15 + r * 3.6 + (c % 2 ? 1.2 : 0)))
      return finish(p, d)
    },
  },
  {
    id: 'conference', name: 'Conference', description: '240-seat theatre with center aisle, stage, registration, coffee · 32 × 26 m',
    build: () => {
      const p = { ...blankPlan(), name: 'Conference', widthM: 32, heightM: 26 }
      const block = { style: 'theatre' as const, rows: 12, perRow: 20, seatW: 0.5, rowGap: 0.9, aisleEvery: 10, aisleW: 1.4, perTable: 3 }
      const d: Draft[] = [
        el('stage', 16, 3, { w: 10, h: 4 }), el('podium', 19, 3.5), el('screen', 6, 1.5), el('screen', 26, 1.5),
        el('camera', 16, 19.5), el('foh', 16, 21),
        el('registration', 8, 24.6), el('registration', 12, 24.6), el('registration', 20, 24.6),
        el('coffee', 2.5, 18, { rotation: 90 }), el('coffee', 29.5, 18, { rotation: 90 }),
        el('firstaid', 30.8, 23), ...exits(32, 26),
      ]
      return finish(p, d, [{ name: 'Theatre block · 240 seats', drafts: seatBlock(block, 16 - 5.7, 7) }])
    },
  },
  {
    id: 'cocktail', name: 'Cocktail reception', description: 'Standing area, 16 cocktail tables, bars, DJ, lounges · 26 × 18 m',
    build: () => {
      const p = { ...blankPlan(), name: 'Cocktail reception', widthM: 26, heightM: 18 }
      const d: Draft[] = [
        shape('crowd-area', [{ x: 3, y: 3 }, { x: 23, y: 3 }, { x: 23, y: 14 }, { x: 3, y: 14 }], { calc: { sqmPerPerson: 1 } }),
        el('bar', 1.5, 9, { label: 'Bar' }), el('champagne-bar', 13, 1.4), el('dj-booth', 24, 9, { rotation: 90 }),
        el('lounge', 5, 16, { label: 'Lounge 1' }), el('lounge', 21, 16, { label: 'Lounge 2' }),
        el('registration', 13, 17.2), el('coat-check', 8.5, 17.4),
        exits(26, 18)[0], exits(26, 18)[1], exits(26, 18)[3],
      ]
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) d.push(el('cocktail', 6 + c * 4.6, 5 + r * 2.6))
      return finish(p, d)
    },
  },
  {
    id: 'wedding', name: 'Wedding', description: 'Head table, 12 round tables of 8, dance floor, cake, DJ, photo booth · 30 × 24 m',
    build: () => {
      const p = { ...blankPlan(), name: 'Wedding', widthM: 30, heightM: 24 }
      const d: Draft[] = [
        el('head-table', 15, 2.5), el('dance-floor', 15, 8.5), el('dj-booth', 22, 6),
        el('cake-table', 8, 6.5), el('gift-table', 27.5, 21), el('photo-booth', 27, 3), el('bar', 1.5, 12),
        el('flower-arch', 15, 22.5), el('registration', 15, 23.3, { label: 'Welcome table' }),
        ...exits(30, 24),
      ]
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) d.push(el('round-8', 6 + c * 6, 13.5 + r * 3.4))
      return finish(p, d)
    },
  },
  {
    id: 'expo', name: 'Expo', description: '24 booths of 3 × 3 m in two double rows, 3 m aisles, info desk · 40 × 30 m',
    build: () => {
      const p = { ...blankPlan(), name: 'Expo', widthM: 40, heightM: 30 }
      const booths: Draft[] = []
      for (const y0 of [6, 18]) for (const row of [0, 1]) for (let c = 0; c < 6; c++) {
        booths.push(el('booth-3x3', 7.5 + c * 3 + (c >= 3 ? 7 : 0), y0 + row * 3, { label: `Booth ${booths.length + 1}` }))
      }
      const d: Draft[] = [
        el('info-desk', 20, 27), el('registration', 15, 28.4), el('registration', 25, 28.4), el('badge-print', 20, 28.6),
        el('coffee', 3, 15, { rotation: 90 }), el('toilet-block', 36, 3, { rotation: 0 }),
        el('mains', 39.2, 15, { setup: { zone: 'Hall' } }),
        ...exits(40, 30),
      ]
      return finish(p, d, [{ name: 'Booths', drafts: booths }])
    },
  },
]
