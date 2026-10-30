import type { PlanElement, Pt } from '../types'
import { CATALOG } from './catalog'
import { nearestOnShape } from './shapes'

export const GRID = 0.25
export const snap = (v: number, step = GRID) => Math.round(v / step) * step
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

/** Chair + seated guest depth added around a table edge. */
export const CHAIR_ZONE = 0.75

export function footprintRadius(e: PlanElement) {
  const shape = CATALOG[e.kind]?.shape
  if (shape === 'roundTable') return e.w / 2 + CHAIR_ZONE
  if (shape === 'rectTable') return Math.hypot(e.w / 2 + CHAIR_ZONE, e.h / 2 + CHAIR_ZONE) * 0.85
  return Math.max(e.w, e.h) / 2
}

/** Distance from point to an element's rotated rectangle (0 when inside). */
export function distToRect(p: Pt, e: PlanElement) {
  const a = (-e.rotation * Math.PI) / 180
  const dx = p.x - e.x, dy = p.y - e.y
  const lx = dx * Math.cos(a) - dy * Math.sin(a)
  const ly = dx * Math.sin(a) + dy * Math.cos(a)
  const ox = Math.max(Math.abs(lx) - e.w / 2, 0)
  const oy = Math.max(Math.abs(ly) - e.h / 2, 0)
  return Math.hypot(ox, oy)
}

export interface ClearanceIssue { a: PlanElement; b: PlanElement; gap: number; pa: Pt; pb: Pt }

const OBSTACLE_SHAPES = new Set(['rect', 'line'])
const IGNORE = new Set(['chair', 'banner', 'speaker'])
/** Drawn lines that block people: walls, barriers and fences (not routes or queue lines). */
const isBlockingLine = (e: PlanElement) => e.kind === 'wall-line' || CATALOG[e.kind]?.calc === 'segments'

/** Aisle check: table-to-table and table-to-obstacle gaps below `min` meters. */
export function clearanceIssues(elements: PlanElement[], min: number): ClearanceIssue[] {
  const tables = elements.filter((e) => {
    const s = CATALOG[e.kind]?.shape
    return s === 'roundTable' || s === 'rectTable'
  })
  const obstacles = elements.filter((e) => (e.points?.length ? isBlockingLine(e) : OBSTACLE_SHAPES.has(CATALOG[e.kind]?.shape) && !IGNORE.has(e.kind)))
  const out: ClearanceIssue[] = []
  for (let i = 0; i < tables.length; i++) {
    const a = tables[i]
    const ra = footprintRadius(a)
    for (let j = i + 1; j < tables.length; j++) {
      const b = tables[j]
      const d = dist(a, b)
      const gap = d - ra - footprintRadius(b)
      if (gap < min) {
        const ux = (b.x - a.x) / (d || 1), uy = (b.y - a.y) / (d || 1)
        out.push({ a, b, gap, pa: { x: a.x + ux * ra, y: a.y + uy * ra }, pb: { x: b.x - ux * footprintRadius(b), y: b.y - uy * footprintRadius(b) } })
      }
    }
    for (const o of obstacles) {
      if (o.points?.length) {
        const { q, d } = nearestOnShape(a, o, false)
        const gap = d - ra
        if (gap < min) {
          const ux = (q.x - a.x) / (d || 1), uy = (q.y - a.y) / (d || 1)
          out.push({ a, b: o, gap, pa: { x: a.x + ux * ra, y: a.y + uy * ra }, pb: q })
        }
        continue
      }
      const gap = distToRect(a, o) - ra
      if (gap < min) out.push({ a, b: o, gap, pa: { x: a.x, y: a.y }, pb: { x: o.x, y: o.y } })
    }
  }
  return out
}

export function bounds(els: PlanElement[]) {
  if (!els.length) return null
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const e of els) {
    const r = Math.max(e.w, e.h) / 2
    x0 = Math.min(x0, e.x - r); y0 = Math.min(y0, e.y - r)
    x1 = Math.max(x1, e.x + r); y1 = Math.max(y1, e.y + r)
  }
  return { x0, y0, x1, y1 }
}
