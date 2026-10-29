import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { Guest, LayerId, LayerState, Plan, PlanElement, Pt } from '../types'
import { CATALOG, isTableKind } from '../lib/catalog'
import { blankPlan } from '../data/blankPlan'
import { readShared } from '../lib/share'

export type Tool = 'select' | 'measure'
export type RightTab = 'inspect' | 'tables' | 'layers' | 'venue'

const STORAGE_KEY = 'inbest-floorplan:v1'
const HISTORY_LIMIT = 100

interface State {
  plan: Plan
  past: Plan[]
  future: Plan[]
  selection: string[]
  tool: Tool
  placing: string | null
  zoom: number // px per meter
  pan: Pt
  showGrid: boolean
  snapOn: boolean
  showBasemap: boolean
  showClearance: boolean
  showLabels: boolean
  viewOnly: boolean
  measure: { a: Pt; b: Pt } | null
  rightTab: RightTab
  highlightTable: string | null

  set: (p: Partial<State>) => void
  checkpoint: () => void
  mutate: (fn: (p: Plan) => Plan, record?: boolean) => void
  loadPlan: (p: Plan) => void
  undo: () => void
  redo: () => void

  addElement: (kind: string, at: Pt) => string
  updateElement: (id: string, patch: Partial<PlanElement>, record?: boolean) => void
  updateMany: (fn: (e: PlanElement) => PlanElement, ids: string[], record?: boolean) => void
  deleteSelected: () => void
  duplicateSelected: () => void
  select: (ids: string[], additive?: boolean) => void
  setLayer: (id: LayerId, patch: Partial<LayerState>) => void

  addGuests: (g: Omit<Guest, 'id'>[] | Guest[]) => void
  updateGuest: (id: string, patch: Partial<Guest>) => void
  removeGuest: (id: string) => void
  assignGuest: (guestId: string, tableId: string | null) => boolean
  autoAssign: () => number
}

const touch = (p: Plan): Plan => ({ ...p, updatedAt: Date.now() })

function initialPlan(): { plan: Plan; viewOnly: boolean } {
  const shared = readShared()
  if (shared) return shared
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { plan: JSON.parse(raw) as Plan, viewOnly: false }
  } catch { /* storage unavailable */ }
  return { plan: blankPlan(), viewOnly: false }
}

const init = initialPlan()

export const seatsUsed = (plan: Plan, tableId: string) => plan.guests.filter((g) => g.tableId === tableId).length

export const usePlanStore = create<State>((set, get) => ({
  plan: init.plan,
  past: [],
  future: [],
  selection: [],
  tool: 'select',
  placing: null,
  zoom: 16,
  pan: { x: 40, y: 20 },
  showGrid: true,
  snapOn: true,
  showBasemap: true,
  showClearance: true,
  showLabels: true,
  viewOnly: init.viewOnly,
  measure: null,
  rightTab: 'tables',
  highlightTable: null,

  set: (p) => set(p),
  checkpoint: () => set((s) => ({ past: [...s.past.slice(-HISTORY_LIMIT), s.plan], future: [] })),
  mutate: (fn, record = true) =>
    set((s) => (record
      ? { past: [...s.past.slice(-HISTORY_LIMIT), s.plan], future: [], plan: touch(fn(s.plan)) }
      : { plan: touch(fn(s.plan)) })),
  loadPlan: (p) => set({ plan: p, past: [], future: [], selection: [] }),
  undo: () => set((s) => {
    const prev = s.past[s.past.length - 1]
    if (!prev) return {}
    return { plan: prev, past: s.past.slice(0, -1), future: [s.plan, ...s.future], selection: [] }
  }),
  redo: () => set((s) => {
    const next = s.future[0]
    if (!next) return {}
    return { plan: next, future: s.future.slice(1), past: [...s.past, s.plan], selection: [] }
  }),

  addElement: (kind, at) => {
    const c = CATALOG[kind]
    const id = nanoid(8)
    get().mutate((p) => {
      const isTable = isTableKind(kind)
      const nextNum = isTable ? Math.max(0, ...p.elements.map((e) => e.number ?? 0)) + 1 : undefined
      const e: PlanElement = {
        id, kind, x: at.x, y: at.y, w: c.w, h: c.h, rotation: 0, layer: c.layer, seats: c.seats,
        label: isTable ? `Table ${nextNum}` : c.name, number: nextNum, tag: isTable ? 'general' : undefined,
      }
      return { ...p, elements: [...p.elements, e] }
    })
    set({ selection: [id] })
    return id
  },
  updateElement: (id, patch, record = true) =>
    get().mutate((p) => ({ ...p, elements: p.elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) }), record),
  updateMany: (fn, ids, record = true) => {
    const set_ = new Set(ids)
    get().mutate((p) => ({ ...p, elements: p.elements.map((e) => (set_.has(e.id) ? fn(e) : e)) }), record)
  },
  deleteSelected: () => {
    const sel = new Set(get().selection)
    if (!sel.size) return
    get().mutate((p) => ({
      ...p,
      elements: p.elements.filter((e) => !sel.has(e.id) || e.locked),
      guests: p.guests.map((g) => (g.tableId && sel.has(g.tableId) ? { ...g, tableId: null } : g)),
    }))
    set({ selection: [] })
  },
  duplicateSelected: () => {
    const { selection, plan } = get()
    if (!selection.length) return
    let num = Math.max(0, ...plan.elements.map((e) => e.number ?? 0))
    const copies = plan.elements
      .filter((e) => selection.includes(e.id))
      .map((e) => {
        const n = e.number != null ? ++num : undefined
        return { ...e, id: nanoid(8), x: e.x + 1, y: e.y + 1, locked: false, number: n, label: n != null ? `Table ${n}` : e.label }
      })
    get().mutate((p) => ({ ...p, elements: [...p.elements, ...copies] }))
    set({ selection: copies.map((c) => c.id) })
  },
  select: (ids, additive) => set((s) => {
    if (!additive) return { selection: ids }
    const cur = new Set(s.selection)
    ids.forEach((id) => (cur.has(id) ? cur.delete(id) : cur.add(id)))
    return { selection: [...cur] }
  }),
  setLayer: (id, patch) =>
    get().mutate((p) => ({ ...p, layers: { ...p.layers, [id]: { ...p.layers[id], ...patch } } }), false),

  addGuests: (gs) =>
    get().mutate((p) => ({ ...p, guests: [...p.guests, ...gs.map((g) => ({ id: nanoid(8), ...g }))] })),
  updateGuest: (id, patch) =>
    get().mutate((p) => ({ ...p, guests: p.guests.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
  removeGuest: (id) => get().mutate((p) => ({ ...p, guests: p.guests.filter((g) => g.id !== id) })),
  assignGuest: (guestId, tableId) => {
    const { plan } = get()
    if (tableId) {
      const t = plan.elements.find((e) => e.id === tableId)
      const g = plan.guests.find((x) => x.id === guestId)
      if (!t || (g?.tableId !== tableId && seatsUsed(plan, tableId) >= (t.seats ?? 0))) return false
    }
    get().updateGuest(guestId, { tableId })
    return true
  },
  /** Greedy fill: keeps guests of the same group together, fills lowest table numbers first. */
  autoAssign: () => {
    const { plan } = get()
    const tables = plan.elements.filter((e) => isTableKind(e.kind)).sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
    const free = new Map(tables.map((t) => [t.id, (t.seats ?? 0) - seatsUsed(plan, t.id)]))
    const pending = plan.guests.filter((g) => !g.tableId)
    const groups = new Map<string, Guest[]>()
    pending.forEach((g) => {
      const k = g.group || g.company || g.id
      groups.set(k, [...(groups.get(k) ?? []), g])
    })
    const assign = new Map<string, string>()
    ;[...groups.values()].sort((a, b) => b.length - a.length).forEach((grp) => {
      let rest = [...grp]
      // try a table that fits the whole group, otherwise spill across tables
      const fit = tables.find((t) => (free.get(t.id) ?? 0) >= rest.length)
      const order = fit ? [fit, ...tables] : tables
      for (const t of order) {
        while (rest.length && (free.get(t.id) ?? 0) > 0) {
          assign.set(rest.shift()!.id, t.id)
          free.set(t.id, (free.get(t.id) ?? 0) - 1)
        }
        if (!rest.length) break
      }
    })
    get().mutate((p) => ({ ...p, guests: p.guests.map((g) => (assign.has(g.id) ? { ...g, tableId: assign.get(g.id) } : g)) }))
    return assign.size
  },
}))

// Autosave (local only; real-time sync is the Phase 2 backend, see PROMPT.md)
let t: ReturnType<typeof setTimeout> | undefined
usePlanStore.subscribe((s, prev) => {
  if (s.plan === prev.plan || s.viewOnly) return
  clearTimeout(t)
  t = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s.plan)) } catch { /* quota or private mode */ }
  }, 400)
})
