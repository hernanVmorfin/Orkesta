import type { Guest, Plan, PlanElement } from '../types'
import { isTableKind } from './catalog'
import { dist } from './geometry'

/** 'order' fills table 1 first; 'even' spreads guests so tables fill at a similar rate. */
export type FillMode = 'order' | 'even'
export interface SeatingOptions { mode: FillMode; reseatAll: boolean }
export interface SeatingSummary {
  seated: number
  /** guests still without a seat */
  unseated: number
  /** free seats left at tagged (VIP, Sponsor…) tables, which untagged guests never take */
  reservedFree: number
}

const GENERAL = 'general'
const tagOf = (tag?: string) => tag || GENERAL

/**
 * Seats guests without a table (or everyone, with `reseatAll`):
 * - tagged guests go to tables with the same tag, overflowing to General tables, never to other tags;
 * - guests sharing a group (or company) sit together; biggest groups are placed first;
 * - a group that fits nowhere whole is split across the tables nearest each other.
 */
export function autoSeat(plan: Plan, opts: SeatingOptions): SeatingSummary & { assign: Map<string, string | null> } {
  const tables = plan.elements.filter((e) => isTableKind(e.kind)).sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
  const cap = new Map(tables.map((t) => [t.id, t.seats ?? 0]))
  const free = new Map(cap)
  const assign = new Map<string, string | null>()

  const pending: Guest[] = []
  for (const g of plan.guests) {
    if (!opts.reseatAll && g.tableId && free.has(g.tableId)) free.set(g.tableId, free.get(g.tableId)! - 1)
    else {
      pending.push(g)
      if (g.tableId) assign.set(g.id, null)
    }
  }

  const groupsOf = (guests: Guest[]) => {
    const m = new Map<string, Guest[]>()
    guests.forEach((g) => {
      const k = g.group || g.company || g.id
      m.set(k, [...(m.get(k) ?? []), g])
    })
    return [...m.values()].sort((a, b) => b.length - a.length)
  }

  const fill = (t: PlanElement) => (cap.get(t.id)! - free.get(t.id)!) / (cap.get(t.id) || 1)

  /** Seats one group within `pool`; returns guests left over. */
  const seatGroup = (grp: Guest[], pool: PlanElement[]) => {
    const open = pool.filter((t) => free.get(t.id)! > 0)
    if (!open.length) return grp
    const whole = open.filter((t) => free.get(t.id)! >= grp.length)
    let order: PlanElement[]
    if (whole.length) {
      // the emptiest table (after seating the group) when spreading, else the lowest number
      order = [opts.mode === 'even'
        ? whole.reduce((a, b) => ((fill(b) + grp.length / cap.get(b.id)!) < (fill(a) + grp.length / cap.get(a.id)!) ? b : a))
        : whole[0]]
    } else {
      const seed = opts.mode === 'even' ? open.reduce((a, b) => (free.get(b.id)! > free.get(a.id)! ? b : a)) : open[0]
      order = [...open].sort((a, b) => dist(a, seed) - dist(b, seed))
    }
    const rest = [...grp]
    for (const t of order) {
      while (rest.length && free.get(t.id)! > 0) {
        assign.set(rest.shift()!.id, t.id)
        free.set(t.id, free.get(t.id)! - 1)
      }
      if (!rest.length) break
    }
    return rest
  }

  const poolFor = (tag: string) => tables.filter((t) => tagOf(t.tag) === tag)

  // Tagged guests first, at their own tables; whatever doesn't fit joins the General round ahead of untagged guests
  const overflow: Guest[][] = []
  for (const tag of plan.tags.map((t) => t.id).filter((id) => id !== GENERAL)) {
    for (const grp of groupsOf(pending.filter((g) => tagOf(g.tag) === tag))) {
      const rest = seatGroup(grp, poolFor(tag))
      if (rest.length) overflow.push(rest)
    }
  }
  const known = new Set(plan.tags.map((t) => t.id))
  const general = pending.filter((g) => tagOf(g.tag) === GENERAL || !known.has(g.tag!))
  let unseated = 0
  for (const grp of [...overflow, ...groupsOf(general)]) unseated += seatGroup(grp, poolFor(GENERAL)).length

  const reservedFree = tables.filter((t) => tagOf(t.tag) !== GENERAL).reduce((n, t) => n + free.get(t.id)!, 0)
  const seated = [...assign.values()].filter(Boolean).length
  return { assign, seated, unseated, reservedFree }
}
