import { nanoid } from 'nanoid'
import type { Plan } from '../types'
import * as db from '../lib/db'
import { toast } from '../lib/toast'
import { requestFocus } from '../lib/canvas'
import { isTableKind } from '../lib/catalog'
import {
  BackendError, getBackend,
  type Backend, type EventStatus, type Message, type MessagePin, type NewMessage, type ReadReceipt, type Role,
} from '../lib/backend'
import { usePlanStore } from './usePlanStore'

/**
 * Team features on top of the plan store: signing in, sharing an event, per-event roles, people, check-ins and
 * messages. An admin's edits to a shared event are sent to the server shortly after they're made; everyone else's
 * copy follows the server's. View-only links never load any of it.
 */

const PUBLISH_DELAY = 1200
/** Last known role per shared event for the signed-in account, so shared events open with the right permissions before the server answers. */
const ACCESS_KEY = 'inbest-floorplan:access'
/** Per event: the server version (updatedAt) this device last fetched or sent, and for which role (staff copies have no guest emails). */
const SYNCED_KEY = 'inbest-floorplan:synced'

interface Access { accountId: string; roles: Record<string, Role> }
interface Synced { at: number; role: Role }

const state = usePlanStore.getState
const setState = usePlanStore.setState
let backend: Backend | null = null

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch { /* storage unavailable */ }
}

function cachedRole(eventId: string) {
  const a = readJson<Access>(ACCESS_KEY)
  const account = state().account
  // Before the backend loads there's no account yet: trust the last one
  return a && (!account || a.accountId === account.id) ? a.roles[eventId] ?? null : null
}

function cacheRole(eventId: string, role: Role | null) {
  const account = state().account
  if (!account) return
  const a = readJson<Access>(ACCESS_KEY)
  const roles = a?.accountId === account.id ? { ...a.roles } : {}
  if (role) roles[eventId] = role
  else delete roles[eventId]
  writeJson(ACCESS_KEY, { accountId: account.id, roles })
}

const synced = readJson<Record<string, Synced>>(SYNCED_KEY) ?? {}
function setSynced(eventId: string, v: Synced) {
  synced[eventId] = v
  writeJson(SYNCED_KEY, synced)
}

const errorText = (err: unknown) =>
  err instanceof BackendError ? err.message : 'Couldn’t reach the server. Check your connection and try again.'

// ---- Sending an admin's edits ----

let dirty: Plan | null = null
let publishTimer: ReturnType<typeof setTimeout> | undefined
let publishing: Promise<void> = Promise.resolve()
let inFlight = false

/** Sends the latest unsent edit, one request at a time. */
function publishNow() {
  clearTimeout(publishTimer)
  publishing = publishing.then(async () => {
    const plan = dirty
    if (!plan || !backend) return
    dirty = null
    inFlight = true
    try {
      await backend.publishEvent(plan, synced[plan.id]?.at ?? null)
      setSynced(plan.id, { at: plan.updatedAt, role: 'admin' })
      if (!dirty) setState({ syncState: 'synced' })
    } catch (err) {
      if (err instanceof BackendError && err.status === 409) await keepMineShowTheirs(plan.id)
      else if (err instanceof BackendError && (err.status === 403 || err.status === 404)) void requestSync() // no longer an admin, or no longer shared
      else setState({ syncState: 'error' }) // sent again on the next sync
    } finally {
      inFlight = false
    }
  })
  return publishing
}

usePlanStore.subscribe((s, prev) => {
  if (s.plan === prev.plan || !prev.hydrated || s.plan.id !== prev.plan.id) return
  if (!backend || !s.plan.shared || s.role !== 'admin') return
  // Only edits made on top of a known server version are sent (sync settles the rest), and versions the server
  // already has aren't sent again: its latest copy, or a check-in (those keep updatedAt)
  const seen = synced[s.plan.id]
  if (!seen || s.plan.updatedAt === seen.at) return
  dirty = s.plan
  if (s.syncState !== 'syncing') setState({ syncState: 'syncing' })
  clearTimeout(publishTimer)
  publishTimer = setTimeout(() => void publishNow(), PUBLISH_DELAY)
})

usePlanStore.subscribe((s, prev) => {
  if (s.plan.id === prev.plan.id) return
  // Send what's left of the event being closed
  if (dirty?.id === prev.plan.id) void publishNow()
  setState({ role: s.plan.shared ? cachedRole(s.plan.id) : null, messages: [], people: null, syncState: 'idle' })
  if (backend) refreshAll()
})

// A new role in the same event (joined, promoted, removed, another account) changes what you can load
usePlanStore.subscribe((s, prev) => {
  if (s.role === prev.role || s.plan.id !== prev.plan.id || !backend) return
  void refreshMessages()
  void refreshPeople()
})

// ---- Following the server's copy ----

const pendingCheckIns = new Map<string, boolean>()

/** Fills in check-ins from the server (they're kept apart from the plan), leaving ones still being sent alone. */
function mergeCheckIns(eventId: string, checkedIn: string[]) {
  const s = state()
  if (s.plan.id !== eventId) return
  const inSet = new Set(checkedIn)
  let changed = false
  const guests = s.plan.guests.map((g) => {
    const v = pendingCheckIns.get(g.id) ?? inSet.has(g.id)
    if (!!g.checkedIn === v) return g
    changed = true
    return { ...g, checkedIn: v }
  })
  if (changed) setState({ plan: { ...s.plan, guests } })
}

/** Replaces this device's copy of the open event with the server's. */
async function applyRemote(eventId: string, role: Role) {
  const remote = await backend?.fetchEvent(eventId)
  if (!remote || state().plan.id !== eventId) return
  const plan: Plan = { ...remote, shared: true }
  setSynced(eventId, { at: plan.updatedAt, role })
  setState((s) => ({
    plan, role, past: [], future: [],
    selection: s.selection.filter((id) => plan.elements.some((e) => e.id === id)),
    // This device now matches the server, unless an edit is still waiting to go out
    ...(dirty ? {} : { syncState: 'synced' as const }),
  }))
}

/** Someone else saved first: keep this device's version as its own event, then show theirs. */
async function keepMineShowTheirs(eventId: string) {
  const b = backend
  if (!b) return
  const open = state().plan.id === eventId
  const mine = open ? state().plan : await db.getPlan(eventId).catch(() => undefined)
  let name = ''
  if (mine) {
    const copy: Plan = { ...mine, id: nanoid(10), name: `${mine.name} (your version)`, shared: undefined, updatedAt: Date.now() }
    name = copy.name
    try {
      await db.savePlan(copy)
      setState((s) => ({ events: [db.summarize(copy), ...s.events] }))
    } catch { /* storage unavailable */ }
  }
  try {
    const status = await b.eventStatus(eventId)
    if (status && open) await applyRemote(eventId, status.role)
    else if (status) {
      const remote = await b.fetchEvent(eventId)
      if (remote) {
        setSynced(eventId, { at: remote.updatedAt, role: status.role })
        await db.savePlan({ ...remote, shared: true })
      }
    }
  } catch {
    setState({ syncState: 'error' })
  }
  toast(`Another admin saved changes at the same time. Your version is kept as “${name}”.`)
}

async function reconcile(id: string, status: EventStatus) {
  const { role } = status
  const local = state().plan
  const seen = synced[id]
  const setRole = () => { if (state().role !== role) setState({ role }) }
  // One of our edits is waiting or on its way: sending it settles any difference (or finds a conflict)
  if (dirty?.id === id || inFlight) {
    setRole()
    mergeCheckIns(id, status.checkedIn)
    return
  }
  if (seen?.role === role && status.updatedAt === local.updatedAt) {
    if (seen.at !== local.updatedAt) setSynced(id, { at: local.updatedAt, role })
    setRole()
    mergeCheckIns(id, status.checkedIn)
    return
  }
  const mineChanged = role === 'admin' && seen?.role === 'admin' && local.updatedAt !== seen.at
  const theirsChanged = !seen || seen.role !== role || status.updatedAt !== seen.at
  if (mineChanged && !theirsChanged) {
    setRole()
    mergeCheckIns(id, status.checkedIn)
    dirty = state().plan
    void publishNow()
    return
  }
  // Both changed (or this device's copy looks newer but we can't tell what the server saw): keep both
  if (mineChanged || (role === 'admin' && !seen && local.updatedAt > status.updatedAt)) await keepMineShowTheirs(id)
  else await applyRemote(id, role)
}

async function syncOnce() {
  const b = backend
  const s = state()
  if (!b || !s.account || s.linkViewOnly || !s.plan.shared) return
  const id = s.plan.id
  try {
    const status = await b.eventStatus(id)
    if (state().plan.id !== id) return
    cacheRole(id, status?.role ?? null)
    if (!status) {
      // Removed from the event, or it's no longer shared: the copy on this device stays, read-only
      if (state().role) setState({ role: null })
      return
    }
    await reconcile(id, status)
    if (!dirty && !inFlight && state().syncState !== 'synced') setState({ syncState: 'synced' })
  } catch {
    setState({ syncState: 'error' })
  }
}

let syncRun: Promise<void> | null = null
let syncAgain = false

/** Brings the open shared event up to date with the server; overlapping requests run once more afterwards. */
function requestSync(): Promise<void> {
  if (syncRun) {
    syncAgain = true
    return syncRun
  }
  syncRun = (async () => {
    try {
      do {
        syncAgain = false
        await syncOnce()
      } while (syncAgain)
    } finally {
      syncRun = null
    }
  })()
  return syncRun
}

function refreshAll() {
  void requestSync()
  void refreshMessages()
  void refreshPeople()
}

// ---- Account ----

let starting: Promise<void> | undefined

/** Loads the backend once the plan store has hydrated. View-only links don't use it. */
export function initTeam() {
  return (starting ??= (async () => {
    if (state().linkViewOnly) return
    try {
      backend = await getBackend()
    } catch (err) {
      console.error('Team backend failed to load', err)
      return
    }
    backend.subscribe(refreshAll)
    await accountChanged()
  })())
}

/** After signing in or out (or switching test accounts): forget the last account's roles and reload everything. */
async function accountChanged() {
  const account = backend?.account() ?? null
  if (readJson<Access>(ACCESS_KEY)?.accountId !== account?.id) writeJson(ACCESS_KEY, null)
  const s = state()
  setState({
    account, backendMode: backend?.mode ?? null,
    role: account && s.plan.shared ? cachedRole(s.plan.id) : null,
    messages: [], people: null, sharedEvents: [], syncState: 'idle',
  })
  await Promise.all([requestSync(), refreshMessages(), refreshPeople(), refreshSharedList()])
}

export async function signIn() {
  if (!backend) return
  await backend.signIn()
  await accountChanged()
}

export async function signOut() {
  if (!backend) return
  await publishNow()
  await backend.signOut()
  await accountChanged()
}

/** Test backend only: accounts to switch between, to see the app as another member. */
export const testUsers = () => backend?.testUsers?.() ?? []

export async function switchTestUser(userId: string) {
  if (!backend?.switchUser) return
  await publishNow()
  await backend.switchUser(userId)
  await accountChanged()
}

export async function refreshSharedList() {
  const b = backend
  if (!b || !state().account) {
    if (state().sharedEvents.length) setState({ sharedEvents: [] })
    return
  }
  try {
    setState({ sharedEvents: await b.listMyEvents() })
  } catch { /* offline: keep the last list */ }
}

// ---- Sharing and joining ----

/** Puts the open event on the server with you as its admin, so you can invite people. */
export async function shareEvent() {
  const b = backend
  const before = state().plan
  if (!b || !state().account) return
  const plan: Plan = { ...before, shared: true, updatedAt: Date.now() }
  try {
    await b.publishEvent(plan, null)
  } catch (err) {
    toast(errorText(err))
    return
  }
  setSynced(plan.id, { at: plan.updatedAt, role: 'admin' })
  cacheRole(plan.id, 'admin')
  const now = state().plan
  if (now.id !== plan.id) return
  // Edits made while it was being shared go out with the next send
  setState({ plan: now === before ? plan : { ...now, shared: true }, role: 'admin', syncState: 'synced', teamView: 'people' })
  refreshAll()
  void refreshSharedList()
}

/** Opens an event shared with you: this device's copy if there is one (sync brings it up to date), otherwise the server's. */
export async function openShared(eventId: string) {
  const b = backend
  if (!b) return
  await publishNow()
  const local = await db.getPlan(eventId).catch(() => undefined)
  if (local) {
    if (state().plan.id !== eventId) await state().openEvent(eventId)
    if (!state().plan.shared) setState((s) => ({ plan: { ...s.plan, shared: true } }))
    await requestSync()
    return
  }
  try {
    const [remote, status] = await Promise.all([b.fetchEvent(eventId), b.eventStatus(eventId)])
    if (!remote || !status) {
      toast('This event isn’t shared with you any more.')
      void refreshSharedList()
      return
    }
    setSynced(eventId, { at: remote.updatedAt, role: status.role })
    cacheRole(eventId, status.role)
    await state().openPlan({ ...remote, shared: true })
    setState({ role: status.role })
  } catch (err) {
    toast(errorText(err))
  }
}

export const inviteUrl = (token: string) => `${window.location.origin}${window.location.pathname}#invite=${token}`

/** Reads an invite token from the address (#invite=…) and removes it, so a reload doesn't use it again. */
export function takeInviteToken() {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('invite')
  if (token) history.replaceState(null, '', window.location.pathname + window.location.search)
  return token
}

/** Joins an event from an invite link and opens it. */
export async function acceptInvite(token: string) {
  const b = backend
  if (!b) return
  await publishNow()
  try {
    const { eventId, role } = await b.acceptInvite(token)
    // The test backend signs this tab in as the invited person
    if (b.account()?.id !== state().account?.id) await accountChanged()
    cacheRole(eventId, role)
    await openShared(eventId)
    toast(role === 'admin' ? 'You joined this event as an admin.' : 'You joined this event as staff.')
  } catch (err) {
    toast(errorText(err))
  }
}

// ---- Check-in ----

/** Admins and staff check guests in; view-only links can't. */
export const useCanCheckIn = () => usePlanStore((s) => !s.linkViewOnly && (!s.plan.shared || !!s.role))

/** Not part of undo. On a shared event it goes to the server right away, and is undone here if that fails. */
export function checkIn(guestId: string, checkedIn: boolean) {
  const s = state()
  const eventId = s.plan.id
  if (s.plan.shared && !backend) {
    toast('Still connecting. Try again in a moment.')
    return
  }
  const setLocal = (v: boolean) => setState((st) => (st.plan.id !== eventId ? st : {
    plan: { ...st.plan, guests: st.plan.guests.map((g) => (g.id === guestId ? { ...g, checkedIn: v } : g)) },
  }))
  setLocal(checkedIn)
  if (!s.plan.shared || !backend) return
  pendingCheckIns.set(guestId, checkedIn)
  backend.setCheckIn(eventId, guestId, checkedIn)
    .catch((err) => {
      setLocal(!checkedIn)
      toast(err instanceof BackendError ? err.message : 'Check-in not saved. Check your connection and try again.')
    })
    .finally(() => { if (pendingCheckIns.get(guestId) === checkedIn) pendingCheckIns.delete(guestId) })
}

// ---- People (admins change them; the server checks) ----

let peopleWatchers = 0

/** The Team panel loads people while it's showing. Returns a stop function. */
export function watchPeople() {
  peopleWatchers++
  void refreshPeople()
  return () => { peopleWatchers-- }
}

async function refreshPeople() {
  const b = backend
  const s = state()
  if (!peopleWatchers) return
  if (!b || !s.account || !s.plan.shared || !s.role) {
    if (s.people) setState({ people: null })
    return
  }
  const id = s.plan.id
  const admin = s.role === 'admin'
  try {
    const [members, invites, groups] = await Promise.all([b.listMembers(id), admin ? b.listInvites(id) : [], admin ? b.listGroups(id) : []])
    if (state().plan.id === id) setState({ people: { members, invites, groups } })
  } catch { /* keep what's shown */ }
}

/** Runs a team change on the open event and reloads the team; null (after a message) if it failed. */
async function teamAction<T>(fn: (b: Backend, eventId: string) => Promise<T>): Promise<{ value: T } | null> {
  const b = backend
  if (!b) return null
  try {
    const value = await fn(b, state().plan.id)
    await refreshPeople()
    return { value }
  } catch (err) {
    toast(errorText(err))
    return null
  }
}

export const createInvite = async (email: string | null, role: Role) =>
  (await teamAction((b, id) => b.createInvite(id, { email, role })))?.value ?? null
export const revokeInvite = (inviteId: string) => teamAction((b, id) => b.revokeInvite(id, inviteId))
export const setMemberRole = (userId: string, role: Role) => teamAction(async (b, id) => {
  await b.setRole(id, userId, role)
  // Changing your own role changes what you can do here
  if (userId === state().account?.id) await requestSync()
})
export const removeMember = (userId: string) => teamAction((b, id) => b.removeMember(id, userId))
export const saveGroup = (group: { id?: string; name: string; memberIds: string[] }) => teamAction((b, id) => b.saveGroup(id, group))
export const deleteGroup = (groupId: string) => teamAction((b, id) => b.deleteGroup(id, groupId))

// ---- Messages ----

/** Message ids already shown per event, so only new urgent ones buzz the phone. */
const seenMessages = new Map<string, Set<string>>()

async function refreshMessages() {
  const b = backend
  const s = state()
  if (!b || !s.account || !s.plan.shared || !s.role) {
    if (s.messages.length) setState({ messages: [] })
    return
  }
  const id = s.plan.id
  let messages: Message[]
  try {
    messages = await b.listMessages(id)
  } catch {
    return
  }
  if (state().plan.id !== id) return
  const seen = seenMessages.get(id)
  if (seen && state().role === 'staff' && messages.some((m) => !seen.has(m.id) && m.priority === 'urgent' && !m.readByMe)) {
    navigator.vibrate?.([200, 100, 200])
  }
  seenMessages.set(id, new Set(messages.map((m) => m.id)))
  setState({ messages })
}

export async function sendMessage(msg: NewMessage) {
  const b = backend
  if (!b) return false
  try {
    await b.sendMessage(state().plan.id, msg)
    await refreshMessages()
    return true
  } catch (err) {
    toast(errorText(err))
    return false
  }
}

/** Shown as read right away; if the server misses it, it's sent again the next time they're shown. */
export async function markRead(ids: string[]) {
  const b = backend
  if (!b || !ids.length) return
  const id = state().plan.id
  setState((s) => ({ messages: s.messages.map((m) => (ids.includes(m.id) ? { ...m, readByMe: true } : m)) }))
  try {
    await b.markRead(id, ids)
  } catch { /* see above */ }
}

export async function loadReceipts(messageId: string): Promise<ReadReceipt[] | null> {
  const b = backend
  if (!b) return null
  try {
    return await b.readReceipts(state().plan.id, messageId)
  } catch (err) {
    toast(errorText(err))
    return null
  }
}

/** Staff only: messages not read yet. */
export const useUnread = () => usePlanStore((s) => (s.role === 'staff' ? s.messages.filter((m) => !m.readByMe).length : 0))

/** Desktop: opens the Team panel on messages (the phone switches its own tab). */
export const openMessages = () => setState({ rightTab: 'team', teamView: 'messages', showPanel: true })

/**
 * Selects a message's pinned object, if it's still on the plan, and centers the plan on it (where it is now).
 * Returns the point, for the phone to focus once its map tab is showing.
 */
export function showPin(pin: MessagePin, focus = true) {
  const e = pin.elementId ? state().plan.elements.find((x) => x.id === pin.elementId) : undefined
  setState({ selection: e ? [e.id] : [], highlightTable: e && isTableKind(e.kind) ? e.id : null, ...(e ? { levelId: e.levelId ?? state().levelId } : {}) })
  const at = { x: e?.x ?? pin.x, y: e?.y ?? pin.y, zoom: 28 }
  if (focus) requestFocus(at)
  return at
}
