import type { Plan, PlanElement } from '../types'
import { CATALOG, isTableKind } from './catalog'
import { levelsOf, onLevel, venueOf } from './levels'
import { worldPoints } from './shapes'

/**
 * A plan reduced to simple shapes for the event cards in the hub. It holds numbers only (no labels
 * or colours from the plan), so it is small enough to keep in the event summary and safe to draw.
 *
 * `s` is a flat list of shapes:
 * - box or ellipse: [kind, tone, x, y, w, h, rotation]
 * - line or area:   [kind, tone, n, x1, y1, …, xn, yn]
 */
export interface Thumb { w: number; h: number; s: number[] }

export const SHAPE = { box: 0, ellipse: 1, line: 2, area: 3 } as const
/** Colour groups, drawn by PlanThumb. */
export const TONE = { table: 0, staging: 1, service: 2, safety: 3, area: 4, other: 5, barrier: 6 } as const

const MAX_SHAPES = 800
const SKIP_LAYERS = new Set(['workforce', 'notes'])
const r1 = (n: number) => Math.round(n * 10) / 10

function toneOf(e: PlanElement): number {
  const c = CATALOG[e.kind]
  if (isTableKind(e.kind)) return TONE.table
  if (e.points?.length) return c?.geometry === 'polygon' ? TONE.area : TONE.barrier
  if (c?.shape === 'zone') return TONE.area
  if (e.layer === 'staging') return TONE.staging
  if (e.layer === 'service') return TONE.service
  if (e.layer === 'safety') return TONE.safety
  return TONE.other
}

/** The first level, as the hub shows it. */
export function planThumb(plan: Plan): Thumb {
  const level = levelsOf(plan)[0].id
  const venue = venueOf(plan, level)
  const s: number[] = []
  let n = 0
  // Areas first so tables and objects draw on top of them
  const els = plan.elements
    .filter((e) => onLevel(e, level) && !e.hidden && !SKIP_LAYERS.has(e.layer) && CATALOG[e.kind]?.shape !== 'text')
    .sort((a, b) => Number(toneOf(b) === TONE.area) - Number(toneOf(a) === TONE.area))
  for (const e of els) {
    if (n++ >= MAX_SHAPES) break
    const tone = toneOf(e)
    if (e.points?.length) {
      const pts = worldPoints(e)
      s.push(CATALOG[e.kind]?.geometry === 'polygon' ? SHAPE.area : SHAPE.line, tone, pts.length, ...pts.flatMap((p) => [r1(p.x), r1(p.y)]))
      continue
    }
    const shape = CATALOG[e.kind]?.shape
    const round = shape === 'roundTable' || shape === 'circle' || shape === 'cocktail' || shape === 'plant' || shape === 'icon'
    // Icons are drawn as circles as wide as the object
    const h = shape === 'icon' ? e.w : e.h
    s.push(round ? SHAPE.ellipse : SHAPE.box, tone, r1(e.x), r1(e.y), r1(e.w), r1(h), Math.round(e.rotation))
  }
  return { w: r1(venue.widthM), h: r1(venue.heightM), s }
}

export type ThumbShape =
  | { kind: typeof SHAPE.box | typeof SHAPE.ellipse; tone: number; x: number; y: number; w: number; h: number; rotation: number }
  | { kind: typeof SHAPE.line | typeof SHAPE.area; tone: number; points: [number, number][] }

/** Reads the flat list back into shapes. Stops at anything malformed. */
export function readThumb(t: Thumb): ThumbShape[] {
  const out: ThumbShape[] = []
  const s = t.s
  for (let i = 0; i < s.length;) {
    const kind = s[i], tone = s[i + 1]
    if (kind === SHAPE.box || kind === SHAPE.ellipse) {
      if (i + 7 > s.length) break
      out.push({ kind, tone, x: s[i + 2], y: s[i + 3], w: s[i + 4], h: s[i + 5], rotation: s[i + 6] })
      i += 7
    } else if (kind === SHAPE.line || kind === SHAPE.area) {
      const n = s[i + 2]
      if (!(n >= 0) || i + 3 + n * 2 > s.length) break
      const points: [number, number][] = []
      for (let k = 0; k < n; k++) points.push([s[i + 3 + k * 2], s[i + 4 + k * 2]])
      out.push({ kind, tone, points })
      i += 3 + n * 2
    } else break
  }
  return out
}
