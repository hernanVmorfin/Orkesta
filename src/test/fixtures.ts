import type { Plan, PlanElement, Pt } from '../types'
import { CATALOG } from '../lib/catalog'
import { blankPlan } from '../data/blankPlan'
import { normalize } from '../lib/shapes'

let n = 0

/** A catalog object at a point, with its catalog size. */
export function el(kind: string, x: number, y: number, extra: Partial<PlanElement> = {}): PlanElement {
  const c = CATALOG[kind]
  return { id: `e${++n}`, kind, label: c.name, x, y, w: c.w, h: c.h, rotation: 0, layer: c.layer, seats: c.seats, ...extra }
}

/** A drawn line or area through plan points. */
export function shape(kind: string, pts: Pt[], extra: Partial<PlanElement> = {}): PlanElement {
  const c = CATALOG[kind]
  return { id: `e${++n}`, kind, label: c.name, rotation: 0, layer: c.layer, ...normalize(pts), ...extra }
}

export const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]

export const planWith = (elements: PlanElement[], extra: Partial<Plan> = {}): Plan => ({ ...blankPlan(), elements, ...extra })
