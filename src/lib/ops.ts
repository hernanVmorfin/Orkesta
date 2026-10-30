import type { ArrivalModel, Plan, PlanElement } from '../types'
import { CATALOG, LAYERS, isTableKind } from './catalog'
import { calcInputs, calcOf, crowdCapacity, exitFlow, lengthOf, postCount, safetyOf, sectionCount, areaOf } from './calcs'
import { distToRect } from './geometry'
import { activeLevel, levelsOf, onLevel } from './levels'
import { distToShape } from './shapes'

/** Ops tab figures: evacuation, arrival queues, power, schedule and inventory. All derived from the plan. */

const onShownLevel = (plan: Plan, levelId: string | null) => {
  const lv = activeLevel(plan, levelId).id
  return plan.elements.filter((e) => onLevel(e, lv))
}

// ---- Evacuation -------------------------------------------------------------

export interface Egress {
  seats: number
  standing: number
  occupancy: number
  overridden: boolean
  exits: { e: PlanElement; flow: number }[]
  /** people per minute through all usable exits */
  capacity: number
  /** the widest exit when the worst case is on */
  lost: PlanElement | null
  /** minutes to clear the occupancy; Infinity without exits */
  minutes: number
}

export function egress(plan: Plan, levelId: string | null): Egress {
  const els = onShownLevel(plan, levelId)
  const safety = safetyOf(plan)
  const seats = els.reduce((n, e) => n + (isTableKind(e.kind) ? e.seats ?? 0 : e.kind === 'chair' ? 1 : 0), 0)
  const standing = els.filter((e) => calcOf(e) === 'crowd').reduce((n, e) => n + crowdCapacity(e), 0)
  const exits = els.filter((e) => calcOf(e) === 'exit' && !e.hidden).map((e) => ({ e, flow: exitFlow(e, plan) }))
  const total = exits.reduce((n, x) => n + x.flow, 0)
  const widest = safety.worstCase && exits.length ? exits.reduce((a, b) => (b.flow > a.flow ? b : a)) : null
  const capacity = total - (widest?.flow ?? 0)
  const occupancy = safety.crowdSize ?? seats + standing
  return {
    seats, standing, occupancy, overridden: safety.crowdSize != null, exits, capacity, lost: widest?.e ?? null,
    minutes: capacity > 0 ? occupancy / capacity : Infinity,
  }
}

/** Layers whose objects may stand near an exit (signs, staff, safety kit). */
const EXIT_OK = new Set(['safety', 'wayfinding', 'workforce', 'notes'])

/** Objects closer than the clearance distance to each exit's edge. */
export function exitBlockers(plan: Plan, levelId: string | null) {
  const els = onShownLevel(plan, levelId).filter((e) => !e.hidden)
  const clear = safetyOf(plan).exitClearM
  return els.filter((e) => calcOf(e) === 'exit').map((exit) => ({
    exit,
    blockers: els.filter((o) => {
      if (o.id === exit.id || EXIT_OK.has(o.layer)) return false
      if (o.points?.length) {
        // Areas and routes may cover an exit; walls, barriers and fences may not
        if (CATALOG[o.kind]?.geometry === 'polygon' || calcOf(o) === 'route' || calcOf(o) === 'posts') return false
        return distToShape(exit, o, false) < clear + exit.w / 2
      }
      return distToRect(exit, o) < clear + exit.w / 2
    }),
  })).filter((x) => x.blockers.length)
}

// ---- Arrivals ---------------------------------------------------------------

export const DEFAULT_ARRIVAL: ArrivalModel = { start: '18:00', slots: [100, 250, 400, 300, 150] }

export interface ArrivalRow { time: string; arrivals: number; capacity: number; queue: number; waitMin: number; lengthM: number }

const addMinutes = (hhmm: string, m: number) => {
  const [h, mm] = hhmm.split(':').map(Number)
  const t = ((h * 60 + mm + m) % 1440 + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Entrances (desks, checkpoints, gates) on every level, and their throughput per 15 minutes. */
export const entrances = (plan: Plan) => plan.elements.filter((e) => calcOf(e) === 'throughput' && !e.hidden)
  .map((e) => ({ e, per15: Math.max(0, calcInputs(e).per15 ?? 0) }))

/**
 * Queue per 15-minute slot: queue = max(0, previous + arrivals − capacity); the longest wait is the
 * queue divided by capacity; a queue holds about 4 people per meter. Runs on until the queue clears.
 */
export function arrivalModel(plan: Plan): { rows: ArrivalRow[]; capacity: number } {
  const model = plan.arrival ?? DEFAULT_ARRIVAL
  const capacity = entrances(plan).reduce((n, x) => n + x.per15, 0)
  const rows: ArrivalRow[] = []
  let q = 0
  for (let i = 0; i < model.slots.length || (q > 0 && capacity > 0 && i < model.slots.length + 96); i++) {
    const a = model.slots[i] ?? 0
    q = Math.max(0, q + a - capacity)
    rows.push({ time: addMinutes(model.start, i * 15), arrivals: a, capacity, queue: q, waitMin: capacity ? (q / capacity) * 15 : q ? Infinity : 0, lengthM: Math.ceil(q / 4) })
  }
  return { rows, capacity }
}

// ---- Power ------------------------------------------------------------------

export interface PowerZone { zone: string; supply: number; draw: number; items: number }

export function powerBudget(plan: Plan): { supply: number; draw: number; zones: PowerZone[] } {
  const zones = new Map<string, PowerZone>()
  const zoneOf = (e: PlanElement) => e.setup?.zone?.trim() || 'No zone'
  for (const e of plan.elements) {
    const supply = calcOf(e) === 'supply' ? calcInputs(e).supplyKw ?? 0 : 0
    const draw = e.setup?.powerKw ?? 0
    if (!supply && !draw) continue
    const z = zones.get(zoneOf(e)) ?? { zone: zoneOf(e), supply: 0, draw: 0, items: 0 }
    z.supply += supply; z.draw += draw; z.items += 1
    zones.set(z.zone, z)
  }
  const list = [...zones.values()].sort((a, b) => a.zone.localeCompare(b.zone))
  return { supply: list.reduce((n, z) => n + z.supply, 0), draw: list.reduce((n, z) => n + z.draw, 0), zones: list }
}

// ---- Load-in schedule -------------------------------------------------------

export interface ScheduleItem { e: PlanElement; vendor: string; zone: string; start: number; end: number }
export interface Clash { a: ScheduleItem; b: ScheduleItem }

/** Objects with load-in/out times (a missing end means a 1-hour slot). */
export function scheduleItems(plan: Plan): ScheduleItem[] {
  return plan.elements.flatMap((e) => {
    const su = e.setup
    if (!su?.inAt && !su?.outAt) return []
    const start = Date.parse(su.inAt ?? su.outAt!)
    const end = su.outAt ? Date.parse(su.outAt) : start + 3600_000
    if (!Number.isFinite(start) || !Number.isFinite(end)) return []
    return [{ e, vendor: su.vendor?.trim() || 'No vendor', zone: su.zone?.trim() ?? '', start: Math.min(start, end), end: Math.max(start, end) }]
  })
}

/** Different vendors in the same zone at overlapping times. */
export function clashes(items: ScheduleItem[]): Clash[] {
  const out: Clash[] = []
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j]
      if (a.zone && a.zone === b.zone && a.vendor !== b.vendor && a.start < b.end && b.start < a.end) out.push({ a, b })
    }
  }
  return out
}

// ---- Inventory --------------------------------------------------------------

export interface InventoryLine { kind: string; name: string; layer: string; count: number; quantity: number; unit: string; lengthM: number; areaM2: number }

/** Quantity an object stands for: barrier sections, posts/cones, seats, or 1. */
export function quantityOf(e: PlanElement): { quantity: number; unit: string } {
  switch (calcOf(e)) {
    case 'segments': return { quantity: sectionCount(e), unit: 'sections' }
    case 'posts': return { quantity: postCount(e), unit: e.kind === 'cone-line' ? 'cones' : 'posts' }
    default: return { quantity: 1, unit: 'pcs' }
  }
}

/** Counts by object type across all levels, ordered by layer. */
export function inventory(plan: Plan, only?: (e: PlanElement) => boolean): InventoryLine[] {
  const lines = new Map<string, InventoryLine>()
  for (const e of plan.elements) {
    if (only && !only(e)) continue
    const c = CATALOG[e.kind]
    const { quantity, unit } = quantityOf(e)
    const l = lines.get(e.kind) ?? { kind: e.kind, name: c?.name ?? e.kind, layer: LAYERS.find((x) => x.id === e.layer)?.name ?? e.layer, count: 0, quantity: 0, unit, lengthM: 0, areaM2: 0 }
    l.count += 1
    l.quantity += quantity
    if (e.points?.length) {
      if (c?.geometry === 'polygon') l.areaM2 += areaOf(e)
      else l.lengthM += lengthOf(e)
    }
    lines.set(e.kind, l)
  }
  const order = Object.fromEntries(LAYERS.map((l, i) => [l.name, i]))
  return [...lines.values()].sort((a, b) => (order[a.layer] ?? 99) - (order[b.layer] ?? 99) || a.name.localeCompare(b.name))
}

/** Level name for an element (only meaningful when the plan has several). */
export const levelName = (plan: Plan, e: PlanElement) => levelsOf(plan).find((l) => l.id === (e.levelId ?? 'base'))?.name ?? ''

export const vendorsOf = (plan: Plan) => [...new Set(plan.elements.map((e) => e.setup?.vendor?.trim()).filter(Boolean))].sort() as string[]
