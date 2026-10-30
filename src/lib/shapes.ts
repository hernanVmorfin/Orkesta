import type { PlanElement, Pt } from '../types'

/**
 * Lines and areas drawn point by point. Points are stored relative to the element's (x, y) and
 * before its rotation, so moving, rotating, nudging and duplicating work like any other object.
 */

const rad = (d: number) => (d * Math.PI) / 180

/** Element-local point to plan meters. */
export function toPlan(e: PlanElement, p: Pt): Pt {
  const a = rad(e.rotation), c = Math.cos(a), s = Math.sin(a)
  return { x: e.x + p.x * c - p.y * s, y: e.y + p.x * s + p.y * c }
}

/** Plan meters to element-local. */
export function toLocal(e: PlanElement, p: Pt): Pt {
  const a = rad(-e.rotation), c = Math.cos(a), s = Math.sin(a)
  const dx = p.x - e.x, dy = p.y - e.y
  return { x: dx * c - dy * s, y: dx * s + dy * c }
}

export const isShape = (e: PlanElement) => !!e.points?.length

export const worldPoints = (e: PlanElement) => (e.points ?? []).map((p) => toPlan(e, p))

export const segLen = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y)

export function pathLength(pts: Pt[], closed = false) {
  let n = 0
  for (let i = 1; i < pts.length; i++) n += segLen(pts[i - 1], pts[i])
  if (closed && pts.length > 2) n += segLen(pts[pts.length - 1], pts[0])
  return n
}

/** Shoelace area, m². */
export function polygonArea(pts: Pt[]) {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length]
    a += p.x * q.y - q.x * p.y
  }
  return Math.abs(a) / 2
}

/** Area centroid (falls back to the vertex average for degenerate shapes). */
export function centroid(pts: Pt[]): Pt {
  let a = 0, cx = 0, cy = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length]
    const f = p.x * q.y - q.x * p.y
    a += f; cx += (p.x + q.x) * f; cy += (p.y + q.y) * f
  }
  if (Math.abs(a) < 1e-9) return { x: pts.reduce((n, p) => n + p.x, 0) / pts.length, y: pts.reduce((n, p) => n + p.y, 0) / pts.length }
  return { x: cx / (3 * a), y: cy / (3 * a) }
}

/** Point halfway along a path, with the direction of the segment it falls on. */
export function midpointAlong(pts: Pt[]): { p: Pt; angle: number } {
  const total = pathLength(pts)
  let walked = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = segLen(a, b)
    if (walked + l >= total / 2 && l > 0) {
      const t = (total / 2 - walked) / l
      return { p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, angle: Math.atan2(b.y - a.y, b.x - a.x) }
    }
    walked += l
  }
  return { p: pts[0] ?? { x: 0, y: 0 }, angle: 0 }
}

/** Evenly spaced positions along a path (pattern marks, posts, cones). */
export function marksAlong(pts: Pt[], spacing: number, offset = spacing / 2, max = 2000): { p: Pt; angle: number }[] {
  const out: { p: Pt; angle: number }[] = []
  if (spacing <= 0) return out
  let next = offset
  let walked = 0
  for (let i = 1; i < pts.length && out.length < max; i++) {
    const a = pts[i - 1], b = pts[i], l = segLen(a, b)
    const angle = Math.atan2(b.y - a.y, b.x - a.x)
    while (next <= walked + l && out.length < max) {
      const t = l ? (next - walked) / l : 0
      out.push({ p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, angle })
      next += spacing
    }
    walked += l
  }
  return out
}

function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt) {
  const o = (p: Pt, q: Pt, r: Pt) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x))
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0
}

/** True when two non-adjacent edges of a closed shape cross. */
export function selfIntersects(pts: Pt[]) {
  const n = pts.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue
      if (segmentsCross(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true
    }
  }
  return false
}

/** Closest point on a segment to `p`. */
function nearestOnSegment(p: Pt, a: Pt, b: Pt): Pt {
  const dx = b.x - a.x, dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0
  return { x: a.x + dx * t, y: a.y + dy * t }
}

export const distToSegment = (p: Pt, a: Pt, b: Pt) => segLen(p, nearestOnSegment(p, a, b))

/** Closest point on a drawn line (or an area's outline) to a plan point, and its distance. */
export function nearestOnShape(p: Pt, e: PlanElement, closed: boolean): { q: Pt; d: number } {
  const w = worldPoints(e)
  let best = { q: w[0] ?? p, d: Infinity }
  const n = closed && w.length > 2 ? w.length : w.length - 1
  for (let i = 0; i < n; i++) {
    const q = nearestOnSegment(p, w[i], w[(i + 1) % w.length])
    const d = segLen(p, q)
    if (d < best.d) best = { q, d }
  }
  return best
}

export const distToShape = (p: Pt, e: PlanElement, closed: boolean) => nearestOnShape(p, e, closed).d

/**
 * Re-centers a shape on its bounding box. Takes absolute plan points (or local points plus the
 * current element) and returns x, y, w, h and local points with rotation unchanged.
 */
export function normalize(points: Pt[], rotation = 0): Pick<PlanElement, 'x' | 'y' | 'w' | 'h' | 'points'> {
  // Work in the element's rotated frame so the bounding box follows the shape
  const a = rad(-rotation), c = Math.cos(a), s = Math.sin(a)
  const local = points.map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }))
  const xs = local.map((p) => p.x), ys = local.map((p) => p.y)
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const mid = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }
  // Back to plan space for the new center
  const b = rad(rotation), cb = Math.cos(b), sb = Math.sin(b)
  return {
    x: +(mid.x * cb - mid.y * sb).toFixed(3),
    y: +(mid.x * sb + mid.y * cb).toFixed(3),
    w: +(x1 - x0).toFixed(3),
    h: +(y1 - y0).toFixed(3),
    points: local.map((p) => ({ x: +(p.x - mid.x).toFixed(3), y: +(p.y - mid.y).toFixed(3) })),
  }
}

/** Re-centers an existing shape after its points were edited (local points in, same rotation). */
export function renormalize(e: PlanElement): PlanElement {
  if (!e.points?.length) return e
  return { ...e, ...normalize(worldPoints(e), e.rotation) }
}

export const fmtLen = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(m < 10 ? 2 : 1)} m`)
export const fmtArea = (m2: number) => `${Math.round(m2).toLocaleString()} m²`
