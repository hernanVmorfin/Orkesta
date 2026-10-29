import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { Guest, LayerId, LayerState, Plan, PlanElement, Pt } from '../types'
import { CATALOG, isTableKind } from '../lib/catalog'
import { blankPlan } from '../data/blankPlan'
import { readShared } from '../lib/share'
import * as db from '../lib/db'
import type { EventSummary } from '../lib/db'
import { autoSeat, type SeatingOptions, type SeatingSummary } from '../lib/seating'

/** 'geo' drags the satellite under the plan to line it up with the venue. */
export type Tool = 'select' | 'measure' | 'geo'
export type RightTab = 'inspect' | 'tables' | 'layers' | 'venue'
export type SaveState = 'saved' | 'saving' | 'error'

/** Pre-IndexedDB single-plan autosave, migrated on first load. */
const LEGACY_KEY = 'inbest-floorplan:v1'
const CURRENT_KEY = 'inbest-floorplan:current'
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
  showSatellite: boolean
  showClearance: boolean
  showLabels: boolean
  /** Below 1280 px the library and right panel are slide-over drawers; these open them. */
  showLibrary: boolean
  showPanel: boolean
  viewOnly: boolean
  measure: { a: Pt; b: Pt } | null
  rightTab: RightTab
  highlightTable: string | null
  /** False until the current event has been read from IndexedDB. */
  hydrated: boolean
  saveState: SaveState
  events: EventSummary[]

  set: (p: Partial<State>) => void
  checkpoint: () => void
  mutate: (fn: (p: Plan) => Plan, record?: boolean) => void
  hydrate: () => Promise<void>
  openEvent: (id: string) => Promise<void>
  newEvent: () => Promise<void>
  duplicateEvent: () => Promise<void>
  deleteEvent: (id: string) => Promise<void>
  /** Adds a plan (JSON file, shared copy) as a new event, so it never overwrites an existing one. */
  importPlan: (p: Plan) => Promise<void>
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
  autoAssign: (opts: SeatingOptions) => SeatingSummary
}

const touch = (p: Plan): Plan => ({ ...p, updatedAt: Date.now() })

/** View-only links render straight from the URL; everything else waits for `hydrate`. */
const shared = readShared()
const init = shared?.viewOnly ? shared : { plan: blankPlan(), viewOnly: false }

const rememberCurrent = (id: string) => {
  try { localStorage.setItem(CURRENT_KEY, id) } catch { /* storage unavailable */ }
}

/** Moves the old localStorage autosave into IndexedDB once. */
async function migrateLegacy() {
  let raw: string | null = null
  try { raw = localStorage.getItem(LEGACY_KEY) } catch { return }
  if (!raw) return
  let plan: Plan
  try { plan = JSON.parse(raw) as Plan } catch { return }
  await db.savePlan(plan)
  rememberCurrent(plan.id)
  try { localStorage.removeItem(LEGACY_KEY) } catch { /* ignore */ }
}

const clearHistory = { past: [], future: [], selection: [], highlightTable: null, measure: null }
let hydrating: Promise<void> | undefined

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
  showSatellite: true,
  showClearance: true,
  showLabels: true,
  showLibrary: false,
  showPanel: false,
  viewOnly: init.viewOnly,
  measure: null,
  rightTab: 'tables',
  highlightTable: null,
  hydrated: init.viewOnly,
  saveState: 'saved',
  events: [],

  set: (p) => set(p),
  checkpoint: () => set((s) => ({ past: [...s.past.slice(-HISTORY_LIMIT), s.plan], future: [] })),
  mutate: (fn, record = true) =>
    set((s) => (record
      ? { past: [...s.past.slice(-HISTORY_LIMIT), s.plan], future: [], plan: touch(fn(s.plan)) }
      : { plan: touch(fn(s.plan)) })),
  hydrate: () => (hydrating ??= (async () => {
    if (get().hydrated) return
    let plan: Plan | undefined
    let events: EventSummary[] = []
    try {
      if (shared) {
        // Editable copy from a link: keep it as its own event and drop the hash so a reload doesn't import it again
        plan = { ...shared.plan, id: nanoid(10), updatedAt: Date.now() }
        await db.savePlan(plan)
        history.replaceState(null, '', window.location.pathname + window.location.search)
      } else {
        await migrateLegacy()
        let id: string | null = null
        try { id = localStorage.getItem(CURRENT_KEY) } catch { /* storage unavailable */ }
        plan = id ? await db.getPlan(id) : undefined
      }
      events = await db.listEvents()
      if (!plan && events[0]) plan = await db.getPlan(events[0].id)
    } catch {
      set({ saveState: 'error' })
    }
    plan ??= blankPlan()
    rememberCurrent(plan.id)
    set({ plan, events, hydrated: true, ...clearHistory })
    navigator.storage?.persist?.().catch(() => {})
  })()),
  openEvent: async (id) => {
    if (id === get().plan.id) return
    await flushSave()
    const plan = await db.getPlan(id).catch(() => undefined)
    if (!plan) return
    rememberCurrent(id)
    set({ plan, ...clearHistory })
  },
  newEvent: () => get().importPlan(blankPlan()),
  duplicateEvent: () => {
    const p = get().plan
    return get().importPlan({ ...p, name: `${p.name} (copy)` })
  },
  deleteEvent: async (id) => {
    const current = id === get().plan.id
    if (current) cancelSave()
    try { await db.deletePlan(id) } catch { set({ saveState: 'error' }); return }
    set((s) => ({ events: s.events.filter((e) => e.id !== id) }))
    if (!current) return
    const next = get().events[0]
    if (next) await get().openEvent(next.id)
    else await get().newEvent()
  },
  importPlan: async (p) => {
    await flushSave()
    const plan = { ...p, id: nanoid(10), updatedAt: Date.now() }
    rememberCurrent(plan.id)
    set({ plan, ...clearHistory })
    await persist(plan)
  },
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
  autoAssign: (opts) => {
    const { assign, ...summary } = autoSeat(get().plan, opts)
    get().mutate((p) => ({ ...p, guests: p.guests.map((g) => (assign.has(g.id) ? { ...g, tableId: assign.get(g.id) ?? null } : g)) }))
    return summary
  },
}))

// Autosave to IndexedDB (local only; real-time sync is the Phase 2 backend, see PROMPT.md)
let t: ReturnType<typeof setTimeout> | undefined
let pending: Plan | null = null

async function persist(plan: Plan) {
  usePlanStore.setState({ saveState: 'saving' })
  try {
    await db.savePlan(plan)
    const sum = db.summarize(plan)
    usePlanStore.setState((s) => ({ saveState: 'saved', events: [sum, ...s.events.filter((e) => e.id !== sum.id)] }))
  } catch {
    usePlanStore.setState({ saveState: 'error' })
  }
}

/** Writes any debounced edit now (before switching events). */
async function flushSave() {
  clearTimeout(t)
  const p = pending
  pending = null
  if (p) await persist(p)
}

function cancelSave() {
  clearTimeout(t)
  pending = null
}

usePlanStore.subscribe((s, prev) => {
  // Switching events (id change) or finishing hydration loads a plan; it doesn't edit one
  if (s.plan === prev.plan || s.viewOnly || !prev.hydrated || s.plan.id !== prev.plan.id) return
  pending = s.plan
  clearTimeout(t)
  t = setTimeout(() => { void flushSave() }, 400)
})
