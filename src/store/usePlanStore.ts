import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { Group, Guest, LayerId, LayerState, Plan, PlanElement, Pt } from '../types'
import { CATALOG, isTableKind } from '../lib/catalog'
import { blankPlan } from '../data/blankPlan'
import { readShared } from '../lib/share'
import * as db from '../lib/db'
import type { EventSummary } from '../lib/db'
import { autoSeat, type SeatingOptions, type SeatingSummary } from '../lib/seating'
import { normalize, selfIntersects } from '../lib/shapes'
import { BASE_LEVEL, currentLevel } from '../lib/levels'
import { registerCustomItems } from '../lib/catalog'
import type { Account, Invite, Member, Message, Role, SharedEventInfo, StaffGroup } from '../lib/backend'

/** 'geo' drags the satellite under the plan to line it up with the venue; 'comment' drops comment pins. */
export type Tool = 'select' | 'measure' | 'geo' | 'comment'
export type RightTab = 'inspect' | 'tables' | 'layers' | 'venue' | 'ops' | 'team'
export type SaveState = 'saved' | 'saving' | 'error'
/** Shared events only: whether this device's edits have reached the server. */
export type SyncState = 'idle' | 'syncing' | 'synced' | 'error'
export interface People { members: Member[]; invites: Invite[]; groups: StaffGroup[] }

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
  /** Opened from a view-only link: shown straight from the URL and never saved. */
  linkViewOnly: boolean
  /** Nothing can be edited: view-only links, and shared events unless you're one of the event's admins. */
  viewOnly: boolean
  measure: { a: Pt; b: Pt } | null
  /** A line or area being drawn (plan meters) */
  drawing: { kind: string; points: Pt[] } | null
  /** Level being shown; null = the first */
  levelId: string | null
  /** Modal dialogs opened from menus */
  dialog: 'repeat' | 'seatBlock' | 'templates' | 'schedule' | 'history' | 'customItem' | 'export' | null
  showComments: boolean
  showResolved: boolean
  /** Open comment thread, or a new comment being written at a point */
  activeComment: string | null
  commentDraft: Pt | null
  rightTab: RightTab
  highlightTable: string | null
  /** False until the current event has been read from IndexedDB. */
  hydrated: boolean
  saveState: SaveState
  events: EventSummary[]

  // Team (see store/team.ts)
  account: Account | null
  /** null until the backend has loaded */
  backendMode: 'mock' | 'server' | null
  /** Your role in the open event when it's shared; null for your own unshared events */
  role: Role | null
  syncState: SyncState
  /** Events shared with your account, from the server */
  sharedEvents: SharedEventInfo[]
  /** Open event's messages, newest first */
  messages: Message[]
  /** Open event's team; loaded while the Team panel is showing */
  people: People | null
  teamView: 'messages' | 'people'

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
  /** Saves a plan under its own id (a shared event from the server) and opens it. */
  openPlan: (p: Plan) => Promise<void>
  undo: () => void
  redo: () => void

  addElement: (kind: string, at: Pt) => string
  /** Adds a point to the line or area being drawn (starts one if needed). */
  drawPoint: (kind: string, at: Pt) => void
  /** Removes the last drawn point; cancels when none are left. */
  undoDrawPoint: () => void
  /** Turns the drawing into an element. Returns an error message when the shape is invalid. */
  finishDrawing: () => string | null
  /** Moves, inserts or removes a vertex of a drawn shape (local coordinates). */
  editPoints: (id: string, fn: (pts: Pt[]) => Pt[], record?: boolean) => void
  updateElement: (id: string, patch: Partial<PlanElement>, record?: boolean) => void
  updateMany: (fn: (e: PlanElement) => PlanElement, ids: string[], record?: boolean) => void
  deleteSelected: () => void
  duplicateSelected: () => void
  /** Adds ready-made elements (seating blocks, templates, pasted objects), renumbering tables. */
  addElements: (els: Omit<PlanElement, 'id'>[], select?: boolean) => string[]
  copySelected: () => number
  cutSelected: () => void
  /** Pastes the clipboard, centered on `at` or offset from the originals. */
  paste: (at?: Pt) => number
  reorder: (dir: 'front' | 'back' | 'forward' | 'backward') => void
  setHidden: (ids: string[], hidden: boolean) => void
  /** Copies one object into a grid of columns × rows with gaps between them, along its rotation. */
  repeat: (id: string, cols: number, rows: number, gapX: number, gapY: number) => void
  groupSelected: (name?: string) => string | null
  ungroup: (groupId: string) => void
  updateGroup: (groupId: string, patch: Partial<Group>) => void
  addLevel: (name?: string) => void
  renameLevel: (id: string, name: string) => void
  duplicateLevel: (id: string) => void
  moveLevel: (id: string, dir: -1 | 1) => void
  deleteLevel: (id: string) => void
  addComment: (at: Pt, body: string) => void
  replyComment: (id: string, body: string) => void
  resolveComment: (id: string, resolved: boolean) => void
  deleteComment: (id: string, replyId?: string) => void
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

const clearHistory = { past: [], future: [], selection: [], highlightTable: null, measure: null, drawing: null, levelId: null }

/**
 * The plan with an explicit levels list. The first time a second level is added, every object and
 * comment without a level is stamped with the first level's id, so reordering can't move them.
 */
function withLevels(p: Plan): Plan {
  if (p.levels?.length) return p
  return {
    ...p,
    levels: [{ id: BASE_LEVEL, name: 'Level 1' }],
    elements: p.elements.map((e) => (e.levelId ? e : { ...e, levelId: BASE_LEVEL })),
    comments: p.comments?.map((c) => (c.levelId ? c : { ...c, levelId: BASE_LEVEL })),
  }
}

/** Comment author: the signed-in account, else a name remembered on this device. */
function authorName() {
  const acc = usePlanStore.getState().account
  if (acc?.name) return acc.name
  try { return localStorage.getItem('inbest-floorplan:author') || 'You' } catch { return 'You' }
}

/** Copied objects; also kept in localStorage so they can be pasted into another event. */
const CLIPBOARD_KEY = 'inbest-floorplan:clipboard'
let clipboard: { els: PlanElement[]; pastes: number } | null = null
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
  linkViewOnly: init.viewOnly,
  viewOnly: init.viewOnly,
  measure: null,
  drawing: null,
  levelId: null,
  dialog: null,
  showComments: true,
  showResolved: false,
  activeComment: null,
  commentDraft: null,
  rightTab: 'tables',
  highlightTable: null,
  hydrated: init.viewOnly,
  saveState: 'saved',
  events: [],
  account: null,
  backendMode: null,
  role: null,
  syncState: 'idle',
  sharedEvents: [],
  messages: [],
  people: null,
  teamView: 'messages',

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
        plan = { ...shared.plan, id: nanoid(10), updatedAt: Date.now(), shared: undefined }
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
    const plan = { ...p, id: nanoid(10), updatedAt: Date.now(), shared: undefined }
    rememberCurrent(plan.id)
    set({ plan, ...clearHistory })
    await persist(plan)
  },
  openPlan: async (plan) => {
    await flushSave()
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
        levelId: currentLevel(p, get().levelId),
      }
      return { ...p, elements: [...p.elements, e] }
    })
    set({ selection: [id] })
    return id
  },
  drawPoint: (kind, at) => set((s) => ({
    drawing: s.drawing?.kind === kind ? { kind, points: [...s.drawing.points, at] } : { kind, points: [at] },
  })),
  undoDrawPoint: () => set((s) => {
    const pts = s.drawing?.points.slice(0, -1) ?? []
    return { drawing: pts.length && s.drawing ? { ...s.drawing, points: pts } : null }
  }),
  finishDrawing: () => {
    const { drawing, zoom } = get()
    if (!drawing) return null
    // A double-click lands extra points on top of the last one
    const pts = drawing.points.filter((p, i, a) => i === 0 || Math.hypot(p.x - a[i - 1].x, p.y - a[i - 1].y) * zoom > 4)
    const c = CATALOG[drawing.kind]
    const area = c?.geometry === 'polygon'
    if (area && pts.length < 3) return 'An area needs at least 3 points'
    if (!area && pts.length < 2) return 'A line needs at least 2 points'
    if (area && selfIntersects(pts)) return 'The area crosses itself. Move a point so its edges don’t cross.'
    const id = nanoid(8)
    get().mutate((p) => ({
      ...p,
      elements: [...p.elements, { id, kind: drawing.kind, label: c.name, rotation: 0, layer: c.layer, ...normalize(pts), levelId: currentLevel(p, get().levelId) }],
    }))
    set({ drawing: null, placing: null, selection: [id] })
    return null
  },
  editPoints: (id, fn, record = true) =>
    get().mutate((p) => ({ ...p, elements: p.elements.map((e) => (e.id === id && e.points ? { ...e, points: fn(e.points) } : e)) }), record),
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
  addElements: (els, select = true) => {
    const ids: string[] = []
    get().mutate((p) => {
      let num = Math.max(0, ...p.elements.map((e) => e.number ?? 0))
      const added = els.map((e) => {
        const id = nanoid(8)
        ids.push(id)
        const n = e.number != null ? ++num : undefined
        return { ...e, id, number: n, label: n != null ? `Table ${n}` : e.label } as PlanElement
      })
      return { ...p, elements: [...p.elements, ...added] }
    })
    if (select) set({ selection: ids })
    return ids
  },
  copySelected: () => {
    const { plan, selection } = get()
    const els = plan.elements.filter((e) => selection.includes(e.id))
    if (!els.length) return 0
    clipboard = { els, pastes: 0 }
    try { localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(els)) } catch { /* too big or unavailable */ }
    return els.length
  },
  cutSelected: () => {
    if (get().copySelected()) get().deleteSelected()
  },
  paste: (at) => {
    if (!clipboard) {
      try {
        const raw = localStorage.getItem(CLIPBOARD_KEY)
        if (raw) clipboard = { els: JSON.parse(raw) as PlanElement[], pastes: 0 }
      } catch { /* nothing to paste */ }
    }
    if (!clipboard?.els.length) return 0
    const { plan } = get()
    const groups = new Set((plan.groups ?? []).map((g) => g.id))
    clipboard.pastes += 1
    const cx = clipboard.els.reduce((n, e) => n + e.x, 0) / clipboard.els.length
    const cy = clipboard.els.reduce((n, e) => n + e.y, 0) / clipboard.els.length
    const dx = at ? at.x - cx : clipboard.pastes, dy = at ? at.y - cy : clipboard.pastes
    const ids = get().addElements(clipboard.els.map(({ id: _id, ...e }) => ({
      ...e, x: +(e.x + dx).toFixed(3), y: +(e.y + dy).toFixed(3), locked: false,
      groupId: e.groupId && groups.has(e.groupId) ? e.groupId : undefined, levelId: currentLevel(plan, get().levelId),
    })))
    return ids.length
  },
  reorder: (dir) => {
    const { selection } = get()
    if (!selection.length) return
    const sel = new Set(selection)
    get().mutate((p) => {
      const z = new Map<string, number>()
      for (const layer of new Set(p.elements.filter((e) => sel.has(e.id)).map((e) => e.layer))) {
        // Siblings in their current stacking order, then move the selected ones
        let order = p.elements.map((e, i) => ({ e, i })).filter(({ e }) => e.layer === layer)
          .sort((a, b) => (a.e.z ?? 0) - (b.e.z ?? 0) || a.i - b.i).map(({ e }) => e)
        if (dir === 'front') order = [...order.filter((e) => !sel.has(e.id)), ...order.filter((e) => sel.has(e.id))]
        else if (dir === 'back') order = [...order.filter((e) => sel.has(e.id)), ...order.filter((e) => !sel.has(e.id))]
        else {
          const up = dir === 'forward'
          const idx = order.map((_, i) => i)
          for (const i of up ? [...idx].reverse() : idx) {
            const j = up ? i + 1 : i - 1
            if (j < 0 || j >= order.length || !sel.has(order[i].id) || sel.has(order[j].id)) continue
            ;[order[i], order[j]] = [order[j], order[i]]
          }
        }
        order.forEach((e, i) => z.set(e.id, i))
      }
      return { ...p, elements: p.elements.map((e) => (z.has(e.id) ? { ...e, z: z.get(e.id) } : e)) }
    })
  },
  setHidden: (ids, hidden) => {
    const set_ = new Set(ids)
    get().mutate((p) => ({ ...p, elements: p.elements.map((e) => (set_.has(e.id) ? { ...e, hidden: hidden || undefined } : e)) }))
    if (hidden) set((s) => ({ selection: s.selection.filter((id) => !set_.has(id)) }))
  },
  repeat: (id, cols, rows, gapX, gapY) => {
    const e = get().plan.elements.find((x) => x.id === id)
    if (!e) return
    const a = (e.rotation * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a)
    const stepX = e.w + gapX, stepY = e.h + gapY
    const copies: Omit<PlanElement, 'id'>[] = []
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        if (!r && !k) continue
        const lx = k * stepX, ly = r * stepY
        const { id: _id, ...rest } = e
        copies.push({ ...rest, x: +(e.x + lx * c - ly * sn).toFixed(3), y: +(e.y + lx * sn + ly * c).toFixed(3), locked: false })
      }
    }
    const ids = get().addElements(copies, false)
    set({ selection: [id, ...ids] })
  },
  groupSelected: (name) => {
    const { plan, selection } = get()
    const els = plan.elements.filter((e) => selection.includes(e.id))
    if (!els.length) return null
    const id = nanoid(8)
    // A group lives in one layer: the one most of its objects are in
    const counts = new Map<LayerId, number>()
    els.forEach((e) => counts.set(e.layer, (counts.get(e.layer) ?? 0) + 1))
    const layer = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const n = (plan.groups ?? []).length + 1
    get().mutate((p) => ({
      ...p,
      groups: [...(p.groups ?? []), { id, name: name ?? `Group ${n}`, layer, visible: true, locked: false }],
      elements: p.elements.map((e) => (selection.includes(e.id) ? { ...e, groupId: id, layer } : e)),
    }))
    return id
  },
  ungroup: (groupId) => get().mutate((p) => ({
    ...p,
    groups: (p.groups ?? []).filter((g) => g.id !== groupId),
    elements: p.elements.map((e) => (e.groupId === groupId ? { ...e, groupId: undefined } : e)),
  })),
  updateGroup: (groupId, patch) => get().mutate((p) => ({
    ...p, groups: (p.groups ?? []).map((g) => (g.id === groupId ? { ...g, ...patch } : g)),
  }), patch.name === undefined),
  addLevel: (name) => {
    const id = nanoid(8)
    get().mutate((p) => {
      const levels = withLevels(p)
      return { ...levels, levels: [...levels.levels!, { id, name: name ?? `Level ${levels.levels!.length + 1}` }] }
    })
    set({ levelId: id, selection: [] })
  },
  renameLevel: (id, name) => get().mutate((p) => ({ ...withLevels(p), levels: withLevels(p).levels!.map((l) => (l.id === id ? { ...l, name } : l)) })),
  duplicateLevel: (id) => {
    const nid = nanoid(8)
    get().mutate((p) => {
      const q = withLevels(p)
      const src = q.levels!.find((l) => l.id === id)!
      const base = src.id === BASE_LEVEL ? { widthM: q.widthM, heightM: q.heightM, basemap: q.basemap } : { widthM: src.widthM, heightM: src.heightM, basemap: src.basemap }
      // Copy the level's folders and objects; tables get new numbers
      const groupMap = new Map<string, string>()
      const groups = (q.groups ?? []).filter((g) => q.elements.some((e) => e.levelId === id && e.groupId === g.id))
        .map((g) => { const gid = nanoid(8); groupMap.set(g.id, gid); return { ...g, id: gid } })
      let num = Math.max(0, ...q.elements.map((e) => e.number ?? 0))
      const copies = q.elements.filter((e) => e.levelId === id).map((e) => {
        const n = e.number != null ? ++num : undefined
        return { ...e, id: nanoid(8), levelId: nid, groupId: e.groupId ? groupMap.get(e.groupId) : undefined, number: n, label: n != null ? `Table ${n}` : e.label }
      })
      const idx = q.levels!.findIndex((l) => l.id === id)
      const levels = [...q.levels!]
      levels.splice(idx + 1, 0, { id: nid, name: `${src.name} (copy)`, ...base })
      return { ...q, levels, groups: [...(q.groups ?? []), ...groups], elements: [...q.elements, ...copies] }
    })
    set({ levelId: nid, selection: [] })
  },
  moveLevel: (id, dir) => get().mutate((p) => {
    const levels = [...withLevels(p).levels!]
    const i = levels.findIndex((l) => l.id === id), j = i + dir
    if (i < 0 || j < 0 || j >= levels.length) return p
    ;[levels[i], levels[j]] = [levels[j], levels[i]]
    return { ...withLevels(p), levels }
  }),
  deleteLevel: (id) => {
    const p0 = get().plan
    if ((p0.levels?.length ?? 1) < 2) return
    get().mutate((p) => {
      const gone = new Set(p.elements.filter((e) => (e.levelId ?? BASE_LEVEL) === id).map((e) => e.id))
      return {
        ...p,
        levels: p.levels!.filter((l) => l.id !== id),
        elements: p.elements.filter((e) => !gone.has(e.id)),
        guests: p.guests.map((g) => (g.tableId && gone.has(g.tableId) ? { ...g, tableId: null } : g)),
        comments: p.comments?.filter((c) => (c.levelId ?? BASE_LEVEL) !== id),
      }
    })
    set({ levelId: null, selection: [] })
  },
  addComment: (at, body) => {
    const id = nanoid(8)
    get().mutate((p) => ({
      ...p,
      comments: [...(p.comments ?? []), { id, x: at.x, y: at.y, levelId: currentLevel(p, get().levelId), author: authorName(), body, createdAt: Date.now(), replies: [] }],
    }))
    set({ commentDraft: null, activeComment: id, tool: 'select' })
  },
  replyComment: (id, body) => get().mutate((p) => ({
    ...p,
    comments: (p.comments ?? []).map((c) => (c.id === id ? { ...c, replies: [...c.replies, { id: nanoid(8), author: authorName(), body, createdAt: Date.now() }] } : c)),
  })),
  resolveComment: (id, resolved) => {
    get().mutate((p) => ({ ...p, comments: (p.comments ?? []).map((c) => (c.id === id ? { ...c, resolved: resolved || undefined } : c)) }))
    if (resolved && !get().showResolved) set({ activeComment: null })
  },
  deleteComment: (id, replyId) => {
    get().mutate((p) => ({
      ...p,
      comments: replyId
        ? (p.comments ?? []).map((c) => (c.id === id ? { ...c, replies: c.replies.filter((r) => r.id !== replyId) } : c))
        : (p.comments ?? []).filter((c) => c.id !== id),
    }))
    if (!replyId) set({ activeComment: null })
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

// Autosave to IndexedDB. Shared events are also sent to the server, see store/team.ts
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
  // Switching events (id change) or finishing hydration loads a plan; it doesn't edit one.
  // Staff copies of shared events are saved too: check-ins and the latest version from the server.
  if (s.plan === prev.plan || s.linkViewOnly || !prev.hydrated || s.plan.id !== prev.plan.id) return
  pending = s.plan
  clearTimeout(t)
  t = setTimeout(() => { void flushSave() }, 400)
})

// Custom objects travel with the plan; make them known to the catalog whenever they change
registerCustomItems(init.plan.customItems)
usePlanStore.subscribe((s, prev) => {
  if (s.plan.customItems !== prev.plan.customItems) registerCustomItems(s.plan.customItems)
})

// Shared events can only be edited by their admins
usePlanStore.subscribe((s) => {
  const viewOnly = s.linkViewOnly || (!!s.plan.shared && s.role !== 'admin')
  if (viewOnly !== s.viewOnly) usePlanStore.setState({ viewOnly, ...(viewOnly ? { placing: null, tool: 'select' as const, measure: null, drawing: null } : {}) })
})
