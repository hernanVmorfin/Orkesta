import { nanoid } from 'nanoid'
import type { Plan } from '../../types'
import {
  BackendError,
  type Account, type Backend, type EventStatus, type Invite, type Member, type Message, type NewMessage,
  type ReadReceipt, type Role, type SharedEventInfo, type StaffGroup,
} from './types'
import { applyProfile, cleanProfile, type ProfilePatch } from '../profile'

/**
 * In-browser stand-in for a server, so people, invites and messages can be tried before one exists. It applies the
 * rules a server must enforce and keeps its data in its own IndexedDB database. Each browser tab signs in on its own
 * (sessionStorage), so two tabs can act as an admin and a staff member and see messages arrive live.
 */

interface StoredMember { userId: string; role: Role; joinedAt: number }
interface StoredMessage extends Omit<Message, 'senderName' | 'readByMe' | 'readCount' | 'recipientCount'> {
  senderId: string
  /** userId -> read time */
  reads: Record<string, number>
}
interface StoredEvent {
  plan: Plan
  checkedIn: string[]
  members: StoredMember[]
  invites: Invite[]
  groups: StaffGroup[]
  messages: StoredMessage[]
}
interface State { users: Account[]; events: Record<string, StoredEvent> }

const OWNER: Account = { id: 'u-owner', email: 'owner@test.local', name: 'Test Owner' }
const USER_KEY = 'inbest-mock-backend:user'
const INVITE_DAYS = 7
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const fresh = (): State => ({ users: [OWNER], events: {} })

let dbp: Promise<IDBDatabase> | undefined
const openDb = () => (dbp ??= new Promise((res, rej) => {
  const req = indexedDB.open('inbest-mock-backend', 1)
  req.onupgradeneeded = () => req.result.createObjectStore('kv')
  req.onsuccess = () => res(req.result)
  req.onerror = () => rej(req.error)
}))

async function readState() {
  const tx = (await openDb()).transaction('kv')
  return new Promise<State>((res, rej) => {
    const req = tx.objectStore('kv').get('state')
    req.onsuccess = () => res((req.result as State | undefined) ?? fresh())
    req.onerror = () => rej(req.error)
  })
}

/** Reads, changes and writes the state in one transaction, so two tabs can't overwrite each other's changes. */
async function updateState<T>(fn: (s: State) => T) {
  const tx = (await openDb()).transaction('kv', 'readwrite')
  const done = new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = tx.onabort = () => rej(tx.error) })
  done.catch(() => {}) // a rejected change aborts on purpose; the caller gets that error instead
  const store = tx.objectStore('kv')
  const out = await new Promise<{ state: State; result: T }>((res, rej) => {
    const req = store.get('state')
    req.onsuccess = () => {
      const state = (req.result as State | undefined) ?? fresh()
      try {
        const result = fn(state)
        store.put(state, 'state')
        res({ state, result })
      } catch (err) {
        tx.abort()
        rej(err)
      }
    }
    req.onerror = () => rej(req.error)
  })
  await done
  return out
}

const roleOf = (e: StoredEvent, userId: string) => e.members.find((m) => m.userId === userId)?.role ?? null
const userOf = (s: State, id: string) => s.users.find((u) => u.id === id)
const nameFromEmail = (email: string) => email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

function access(s: State, eventId: string, userId: string, need?: 'admin') {
  const e = s.events[eventId]
  if (!e) throw new BackendError(404, 'This event isn’t shared.')
  const role = roleOf(e, userId)
  if (!role) throw new BackendError(403, 'You’re not a member of this event.')
  if (need && role !== 'admin') throw new BackendError(403, 'Only event admins can do that.')
  return { e, role }
}

function keepAnAdmin(e: StoredEvent, userId: string) {
  const admins = e.members.filter((m) => m.role === 'admin')
  if (admins.length === 1 && admins[0].userId === userId) throw new BackendError(409, 'An event needs at least one admin. Make someone else an admin first.')
}

/** Worked out when read, so people added to a group later also see its earlier messages. */
const recipients = (e: StoredEvent, m: { audience: string; groupId: string | null }) =>
  m.audience === 'all'
    ? e.members.filter((x) => x.role === 'staff').map((x) => x.userId)
    : (e.groups.find((g) => g.id === m.groupId)?.memberIds ?? []).filter((id) => roleOf(e, id))

function toMessage(s: State, e: StoredEvent, m: StoredMessage, me: string, admin: boolean): Message {
  const { senderId, reads, ...rest } = m
  const base: Message = { ...rest, senderName: userOf(s, senderId)?.name ?? 'Admin', readByMe: !!reads[me] }
  if (!admin) return base
  const to = recipients(e, m)
  return { ...base, recipientCount: to.length, readCount: to.filter((id) => reads[id]).length }
}

export class MockBackend implements Backend {
  readonly mode = 'mock' as const
  private state: State = fresh()
  private userId: string | null = null
  private listeners = new Set<() => void>()
  private channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('inbest-mock-backend') : null

  async init() {
    this.state = await readState()
    let id: string | null = OWNER.id
    try {
      const saved = sessionStorage.getItem(USER_KEY)
      if (saved !== null) id = saved || null
    } catch { /* storage unavailable */ }
    this.userId = id
    // Another tab changed the shared test data
    if (this.channel) this.channel.onmessage = () => { void readState().then((s) => { this.state = s; this.emit() }) }
    return this.account()
  }

  account() { return (this.userId && userOf(this.state, this.userId)) || null }
  private setUser(id: string | null) {
    this.userId = id
    try { sessionStorage.setItem(USER_KEY, id ?? '') } catch { /* storage unavailable */ }
  }
  async signIn() { this.setUser(OWNER.id) }
  async signOut() { this.setUser(null) }
  async updateProfile(patch: ProfilePatch) {
    const clean = cleanProfile(patch)
    if (!clean.ok) throw new BackendError(400, clean.error)
    return this.change((s, me) => {
      const i = s.users.findIndex((u) => u.id === me.id)
      if (i < 0) throw new BackendError(401, 'Sign in first.')
      s.users[i] = { ...applyProfile(s.users[i], clean.patch), setupAt: Date.now() }
      return s.users[i]
    })
  }
  testUsers() { return this.state.users }
  async switchUser(userId: string) { this.setUser(userId) }

  subscribe(onChange: () => void) {
    this.listeners.add(onChange)
    return () => { this.listeners.delete(onChange) }
  }
  private emit() { this.listeners.forEach((l) => l()) }

  private me() {
    const a = this.account()
    if (!a) throw new BackendError(401, 'Sign in first.')
    return a
  }

  /** Applies a change to the latest stored data, then tells this tab and the others. */
  private async change<T>(fn: (s: State, me: Account) => T) {
    const me = this.me()
    const { state, result } = await updateState((s) => fn(s, me))
    this.state = state
    this.channel?.postMessage('changed')
    this.emit()
    return result
  }

  async publishEvent(plan: Plan, baseUpdatedAt: number | null) {
    await this.change((s, me) => {
      const e = s.events[plan.id]
      if (!e) {
        s.events[plan.id] = {
          plan,
          checkedIn: plan.guests.filter((g) => g.checkedIn).map((g) => g.id),
          members: [{ userId: me.id, role: 'admin', joinedAt: Date.now() }],
          invites: [], groups: [], messages: [],
        }
        return
      }
      access(s, plan.id, me.id, 'admin')
      if (baseUpdatedAt !== null && baseUpdatedAt !== e.plan.updatedAt) throw new BackendError(409, 'Someone else saved this event first.')
      e.plan = plan
    })
  }

  async fetchEvent(eventId: string) {
    const me = this.account()
    const e = this.state.events[eventId]
    const role = me && e ? roleOf(e, me.id) : null
    if (!e || !role) return null
    const inSet = new Set(e.checkedIn)
    const plan = structuredClone(e.plan)
    // Guest emails stay with admins
    plan.guests = plan.guests.map(({ email, ...g }) => ({ ...g, ...(role === 'admin' && email ? { email } : {}), checkedIn: inSet.has(g.id) }))
    return plan
  }

  async listMyEvents(): Promise<SharedEventInfo[]> {
    const me = this.account()
    if (!me) return []
    return Object.entries(this.state.events).flatMap(([eventId, e]) => {
      const role = roleOf(e, me.id)
      return role ? [{ eventId, name: e.plan.name, role, updatedAt: e.plan.updatedAt }] : []
    })
  }

  async eventStatus(eventId: string): Promise<EventStatus | null> {
    const me = this.account()
    const e = this.state.events[eventId]
    const role = me && e ? roleOf(e, me.id) : null
    if (!e || !role) return null
    return { role, updatedAt: e.plan.updatedAt, checkedIn: [...e.checkedIn] }
  }

  async setCheckIn(eventId: string, guestId: string, checkedIn: boolean) {
    await this.change((s, me) => {
      const { e } = access(s, eventId, me.id)
      if (!e.plan.guests.some((g) => g.id === guestId)) throw new BackendError(404, 'That guest isn’t on the list any more.')
      e.checkedIn = checkedIn ? [...new Set([...e.checkedIn, guestId])] : e.checkedIn.filter((id) => id !== guestId)
    })
  }

  async listMembers(eventId: string): Promise<Member[]> {
    const { e, role } = access(this.state, eventId, this.me().id)
    return e.members.map((m) => {
      const u = userOf(this.state, m.userId)
      return {
        userId: m.userId, name: u?.name ?? 'Unknown', role: m.role, joinedAt: m.joinedAt,
        title: u?.title, company: u?.company, color: u?.color, photo: u?.photo,
        // Contact details only for admins
        ...(role === 'admin' ? { email: u?.email, phone: u?.phone } : {}),
      }
    })
  }

  async listInvites(eventId: string) {
    const { e } = access(this.state, eventId, this.me().id, 'admin')
    return e.invites.filter((i) => i.expiresAt > Date.now())
  }

  async createInvite(eventId: string, input: { email: string | null; role: Role }) {
    return this.change((s, me) => {
      const { e } = access(s, eventId, me.id, 'admin')
      const email = input.email?.trim().toLowerCase() || null
      if (email && !EMAIL.test(email)) throw new BackendError(400, 'That email address doesn’t look right.')
      if (email && e.members.some((m) => userOf(s, m.userId)?.email === email)) throw new BackendError(409, `${email} is already on the team.`)
      const now = Date.now()
      const invite: Invite = { id: nanoid(8), email, role: input.role, token: nanoid(24), createdAt: now, expiresAt: now + INVITE_DAYS * 864e5 }
      // A new invite for the same email replaces the old one
      e.invites = [...e.invites.filter((i) => !email || i.email !== email), invite]
      return invite
    })
  }

  async revokeInvite(eventId: string, inviteId: string) {
    await this.change((s, me) => {
      const { e } = access(s, eventId, me.id, 'admin')
      e.invites = e.invites.filter((i) => i.id !== inviteId)
    })
  }

  async setRole(eventId: string, userId: string, role: Role) {
    await this.change((s, me) => {
      const { e } = access(s, eventId, me.id, 'admin')
      const m = e.members.find((x) => x.userId === userId)
      if (!m) throw new BackendError(404, 'That person isn’t on the team.')
      if (role !== 'admin') keepAnAdmin(e, userId)
      m.role = role
    })
  }

  async removeMember(eventId: string, userId: string) {
    await this.change((s, me) => {
      const { e } = access(s, eventId, me.id, 'admin')
      keepAnAdmin(e, userId)
      e.members = e.members.filter((m) => m.userId !== userId)
      e.groups = e.groups.map((g) => ({ ...g, memberIds: g.memberIds.filter((id) => id !== userId) }))
    })
  }

  /** Test backend: opening an invite link signs this tab in as the invited person (made up for link invites). */
  async acceptInvite(token: string) {
    const current = this.userId
    const { state, result } = await updateState((s) => {
      const found = Object.entries(s.events).find(([, e]) => e.invites.some((i) => i.token === token))
      if (!found) throw new BackendError(404, 'This invite link is invalid or was revoked.')
      const [eventId, e] = found
      const invite = e.invites.find((i) => i.token === token)!
      if (invite.expiresAt < Date.now()) throw new BackendError(410, 'This invite has expired. Ask an admin for a new one.')
      const create = (email: string) => {
        const u = { id: `u-${nanoid(6)}`, email, name: nameFromEmail(email) }
        s.users.push(u)
        return u
      }
      const signedIn = current ? userOf(s, current) : undefined
      const user = invite.email
        ? s.users.find((u) => u.email === invite.email) ?? create(invite.email)
        : signedIn && !roleOf(e, signedIn.id) ? signedIn : create(`guest-${nanoid(4).toLowerCase()}@test.local`)
      if (!roleOf(e, user.id)) e.members.push({ userId: user.id, role: invite.role, joinedAt: Date.now() })
      // Email invites are single use; link invites work until they expire or are revoked
      if (invite.email) e.invites = e.invites.filter((i) => i.id !== invite.id)
      return { eventId, role: roleOf(e, user.id)!, userId: user.id }
    })
    this.state = state
    this.setUser(result.userId)
    this.channel?.postMessage('changed')
    this.emit()
    return { eventId: result.eventId, role: result.role }
  }

  async listGroups(eventId: string) {
    return access(this.state, eventId, this.me().id, 'admin').e.groups
  }

  async saveGroup(eventId: string, group: { id?: string; name: string; memberIds: string[] }) {
    return this.change((s, me) => {
      const { e } = access(s, eventId, me.id, 'admin')
      const name = group.name.trim()
      if (!name) throw new BackendError(400, 'Give the group a name.')
      if (group.id && !e.groups.some((g) => g.id === group.id)) throw new BackendError(404, 'That group was deleted.')
      const saved: StaffGroup = { id: group.id ?? nanoid(8), name, memberIds: group.memberIds.filter((id) => roleOf(e, id)) }
      e.groups = group.id ? e.groups.map((g) => (g.id === group.id ? saved : g)) : [...e.groups, saved]
      return saved
    })
  }

  async deleteGroup(eventId: string, groupId: string) {
    await this.change((s, me) => {
      const { e } = access(s, eventId, me.id, 'admin')
      e.groups = e.groups.filter((g) => g.id !== groupId)
    })
  }

  async listMessages(eventId: string) {
    const me = this.me().id
    const { e, role } = access(this.state, eventId, me)
    const admin = role === 'admin'
    return e.messages
      .filter((m) => admin || recipients(e, m).includes(me))
      .map((m) => toMessage(this.state, e, m, me, admin))
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  async sendMessage(eventId: string, msg: NewMessage) {
    return this.change((s, me) => {
      const { e } = access(s, eventId, me.id, 'admin')
      const body = msg.body.trim()
      if (!body) throw new BackendError(400, 'Write a message first.')
      if (body.length > 1000) throw new BackendError(400, 'Keep messages under 1,000 characters.')
      const group = msg.audience === 'group' ? e.groups.find((g) => g.id === msg.groupId) : undefined
      if (msg.audience === 'group' && !group) throw new BackendError(400, 'Pick a group to send to.')
      const stored: StoredMessage = {
        id: nanoid(10), senderId: me.id, audience: msg.audience, groupId: group?.id ?? null, groupName: group?.name ?? null,
        priority: msg.priority, body, pin: msg.pin, createdAt: Date.now(), reads: {},
      }
      e.messages.push(stored)
      return toMessage(s, e, stored, me.id, true)
    })
  }

  async markRead(eventId: string, messageIds: string[]) {
    const me = this.me().id
    const e = this.state.events[eventId]
    // Nothing new to record: skip the write (and the change notification it would send)
    if (!e?.messages.some((m) => messageIds.includes(m.id) && !m.reads[me])) return
    await this.change((s) => {
      const { e } = access(s, eventId, me)
      const now = Date.now()
      e.messages.forEach((m) => { if (messageIds.includes(m.id) && !m.reads[me]) m.reads[me] = now })
    })
  }

  async readReceipts(eventId: string, messageId: string): Promise<ReadReceipt[]> {
    const { e } = access(this.state, eventId, this.me().id, 'admin')
    const m = e.messages.find((x) => x.id === messageId)
    if (!m) throw new BackendError(404, 'Message not found.')
    return recipients(e, m).map((id) => ({ userId: id, name: userOf(this.state, id)?.name ?? 'Unknown', readAt: m.reads[id] ?? null }))
  }
}
