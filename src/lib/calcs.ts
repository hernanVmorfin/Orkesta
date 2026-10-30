import type { CalcId, Plan, PlanElement, SafetySettings } from '../types'
import { CATALOG } from './catalog'
import { fmtArea, fmtLen, pathLength, polygonArea } from './shapes'

/**
 * Inspector calculators. Inputs live on the element (`calc`), falling back to the catalog
 * defaults; results are recomputed from the geometry every render, so editing a point updates them.
 */

export interface CalcField {
  key: string
  label: string
  unit?: string
  step?: number
  min?: number
  options?: { value: number; label: string }[]
}
export interface CalcResult { label: string; value: string }
interface CalcDef {
  title: string
  fields: CalcField[]
  run: (e: PlanElement, v: Record<string, number>, plan: Plan) => CalcResult[]
  hint?: string
}

export const DEFAULT_SAFETY: SafetySettings = { flowRate: 82, worstCase: true, exitClearM: 1.5 }
export const safetyOf = (plan: Plan) => ({ ...DEFAULT_SAFETY, ...plan.safety })

export const calcOf = (e: PlanElement): CalcId | undefined => CATALOG[e.kind]?.calc
export const calcInputs = (e: PlanElement): Record<string, number> => ({ ...CATALOG[e.kind]?.calcDefaults, ...e.calc })

export const lengthOf = (e: PlanElement) => pathLength(e.points ?? [])
export const areaOf = (e: PlanElement) => (e.points?.length ? polygonArea(e.points) : e.w * e.h)

const n0 = (n: number) => Math.max(0, Math.floor(n)).toLocaleString()

/** Each exit's flow in people per minute: clear width × flow rate (stairs flow at 66/82 of level). */
export function exitFlow(e: PlanElement, plan: Plan) {
  const v = calcInputs(e)
  const rate = safetyOf(plan).flowRate * (v.stairs ? 66 / 82 : 1)
  return Math.max(0, (v.widthM ?? 0) * rate)
}

export const crowdCapacity = (e: PlanElement) => Math.floor(areaOf(e) / Math.max(0.05, calcInputs(e).sqmPerPerson ?? 0.5))
/** Extra pieces to order on top of the line (corners, gates, damage). */
export const sparesOf = (e: PlanElement) => Math.max(0, Math.round(calcInputs(e).spares ?? 0))
/** Sections to cover the line, rounded up, plus spares. */
export const sectionCount = (e: PlanElement) => Math.ceil(lengthOf(e) / Math.max(0.1, calcInputs(e).segmentM ?? 2) - 1e-9) + sparesOf(e)
/** Posts or cones at both ends and every `spacingM` between, plus spares. */
export const postCount = (e: PlanElement) => (e.points?.length ? Math.floor(lengthOf(e) / Math.max(0.1, calcInputs(e).spacingM ?? 1) + 1e-9) + 1 + sparesOf(e) : 0)
const withSpares = (e: PlanElement, total: number) => `${n0(total)}${sparesOf(e) ? ` (incl. ${sparesOf(e)} spare)` : ''}`
const SPARES: CalcField = { key: 'spares', label: 'Spares', unit: 'pcs', step: 1, min: 0 }

function minutes(m: number) {
  const s = Math.round(m * 60)
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ''}`
}

export const CALCS: Record<CalcId, CalcDef> = {
  crowd: {
    title: 'Crowd capacity',
    fields: [{
      key: 'sqmPerPerson', label: 'Space per person', options: [
        { value: 2, label: 'Comfortable · 2 m²' }, { value: 1, label: 'Relaxed · 1 m²' }, { value: 0.5, label: 'Standard · 0.5 m²' },
        { value: 0.33, label: 'Busy · 0.33 m²' }, { value: 0.25, label: 'Dense · 0.25 m²' },
      ],
    }],
    run: (e) => [{ label: 'Area', value: fmtArea(areaOf(e)) }, { label: 'Capacity', value: `${n0(crowdCapacity(e))} people` }],
    hint: 'A planning guide only. Confirm densities with your safety officer and local rules.',
  },
  segments: {
    title: 'Sections',
    fields: [{ key: 'segmentM', label: 'Section length', unit: 'm', step: 0.05, min: 0.2 }, SPARES],
    run: (e) => [{ label: 'Length', value: fmtLen(lengthOf(e)) }, { label: 'Sections', value: withSpares(e, sectionCount(e)) }],
    hint: 'Rounded up to cover the full length. Add spares for corners, gates and damage; they count in the inventory.',
  },
  posts: {
    title: 'Posts',
    fields: [{ key: 'spacingM', label: 'Spacing', unit: 'm', step: 0.05, min: 0.2 }, SPARES],
    run: (e) => [{ label: 'Length', value: fmtLen(lengthOf(e)) }, { label: e.kind === 'cone-line' ? 'Cones' : 'Posts', value: withSpares(e, postCount(e)) }],
  },
  route: {
    title: 'Travel time',
    fields: [{ key: 'speedKmh', label: 'Average speed', unit: 'km/h', step: 0.5, min: 0.5 }],
    run: (e, v) => [{ label: 'Length', value: fmtLen(lengthOf(e)) }, { label: 'Travel time', value: minutes((lengthOf(e) / 1000 / Math.max(0.5, v.speedKmh ?? 5)) * 60) }],
  },
  camping: {
    title: 'Camping capacity',
    fields: [
      { key: 'sqmPerTent', label: 'Density', options: [{ value: 24, label: 'Low · 24 m²/tent' }, { value: 18, label: 'Medium · 18 m²/tent' }, { value: 6, label: 'High · 6 m²/tent' }] },
      { key: 'perTent', label: 'People per tent', step: 1, min: 1 },
    ],
    run: (e, v) => {
      const tents = Math.floor(areaOf(e) / (v.sqmPerTent || 18))
      return [{ label: 'Area', value: fmtArea(areaOf(e)) }, { label: 'Tents', value: n0(tents) }, { label: 'People', value: n0(tents * (v.perTent || 1)) }]
    },
  },
  parking: {
    title: 'Parking capacity',
    fields: [
      { key: 'sqmPerCar', label: 'Traffic flow', options: [{ value: 28.8, label: 'One-way aisles' }, { value: 32.5, label: 'Two-way aisles' }] },
      { key: 'perCar', label: 'People per car', step: 1, min: 1 },
    ],
    run: (e, v) => {
      const cars = Math.floor(areaOf(e) / (v.sqmPerCar || 28.8))
      return [{ label: 'Area', value: fmtArea(areaOf(e)) }, { label: 'Cars', value: n0(cars) }, { label: 'People', value: n0(cars * (v.perCar || 1)) }]
    },
  },
  exit: {
    title: 'Exit capacity',
    fields: [
      { key: 'widthM', label: 'Clear width', unit: 'm', step: 0.05, min: 0.5 },
      { key: 'stairs', label: 'Route', options: [{ value: 0, label: 'Level' }, { value: 1, label: 'Stairs' }] },
    ],
    run: (e, _v, plan) => [{ label: 'Flow', value: `${n0(exitFlow(e, plan))} people/min` }],
    hint: 'Feeds the evacuation estimate in the Ops tab.',
  },
  throughput: {
    title: 'Entry throughput',
    fields: [{ key: 'per15', label: 'People per 15 min', step: 5, min: 1 }],
    run: (_e, v) => [{ label: 'Per minute', value: ((v.per15 ?? 0) / 15).toFixed(1) }],
    hint: 'Feeds the arrival queue model in the Ops tab.',
  },
  supply: {
    title: 'Power supply',
    fields: [{ key: 'supplyKw', label: 'Supplies', unit: 'kW', step: 1, min: 0 }],
    run: (_e, v) => [{ label: 'Available', value: `${v.supplyKw ?? 0} kW` }],
    hint: 'Feeds the power budget in the Ops tab.',
  },
}

/** Short figure shown under an area's label on the plan. */
export function planSummary(e: PlanElement): string | null {
  switch (calcOf(e)) {
    case 'crowd': return `${n0(crowdCapacity(e))} people`
    case 'camping': return `${n0(areaOf(e) / (calcInputs(e).sqmPerTent || 18))} tents`
    case 'parking': return `${n0(areaOf(e) / (calcInputs(e).sqmPerCar || 28.8))} cars`
    default: return null
  }
}
