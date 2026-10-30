import type { Plan } from '../../types'
import type { ProfilePatch } from '../profile'

/**
 * Everything the app needs from a server: sign-in, shared events, per-event people and roles, staff groups and
 * messages. Only the in-browser test backend (mock.ts) exists for now; a real server implements the same interface
 * and must enforce the same rules (the browser can't be trusted to).
 */

/** Per event. Admins edit the plan, manage people and send messages; staff view, check guests in and read messages. */
export type Role = 'admin' | 'staff'

export interface Account {
  id: string
  email: string
  name: string
  title?: string
  company?: string
  phone?: string
  color?: string
  photo?: string
  /** when the person last saved their profile; missing until they've set it up */
  setupAt?: number
}

export interface Member {
  userId: string
  name: string
  title?: string
  company?: string
  color?: string
  photo?: string
  /** only returned to admins */
  email?: string
  /** only returned to admins */
  phone?: string
  role: Role
  joinedAt: number
}

export interface Invite {
  id: string
  /** null for a shareable link anyone can use */
  email: string | null
  role: Role
  token: string
  createdAt: number
  expiresAt: number
}

export interface SharedEventInfo { eventId: string; name: string; role: Role; updatedAt: number }

/** Small enough to poll: your role, which plan version is on the server, and who is checked in. */
export interface EventStatus {
  role: Role
  /** `updatedAt` of the plan stored on the server */
  updatedAt: number
  /** Guest ids. Check-ins are stored apart from the plan so an admin's save never undoes a staff check-in. */
  checkedIn: string[]
}

export interface StaffGroup { id: string; name: string; memberIds: string[] }

export interface MessagePin { x: number; y: number; label: string; elementId?: string }

export interface Message {
  id: string
  senderName: string
  audience: 'all' | 'group'
  groupId: string | null
  groupName: string | null
  priority: 'normal' | 'urgent'
  body: string
  pin: MessagePin | null
  createdAt: number
  readByMe: boolean
  /** admins only: how many recipients have read it, out of how many */
  readCount?: number
  recipientCount?: number
}

export interface NewMessage { audience: 'all' | 'group'; groupId: string | null; priority: 'normal' | 'urgent'; body: string; pin: MessagePin | null }

export interface ReadReceipt { userId: string; name: string; readAt: number | null }

export class BackendError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export interface Backend {
  readonly mode: 'mock' | 'server'
  /** Restores the signed-in session, if any. */
  init(): Promise<Account | null>
  account(): Account | null
  /** A real server may redirect to its sign-in page and back; the test backend signs in its test owner. */
  signIn(): Promise<void>
  signOut(): Promise<void>
  /**
   * Saves your own name, title, company, phone and avatar (rules in lib/profile: `cleanProfile`) and marks
   * the profile as set up. Returns the updated account. Email changes need a confirmation link, so they
   * aren't part of this.
   */
  updateProfile(patch: ProfilePatch): Promise<Account>

  /**
   * Creates the shared event (the caller becomes its admin) or updates it (admins only). `baseUpdatedAt` is the
   * server version this edit started from; if someone else saved since, it fails with 409 instead of overwriting.
   * Check-ins in the plan are ignored after the first save (see `setCheckIn`).
   */
  publishEvent(plan: Plan, baseUpdatedAt: number | null): Promise<void>
  /** The latest shared plan with check-ins filled in. Staff get guests without emails. null if you're not a member. */
  fetchEvent(eventId: string): Promise<Plan | null>
  listMyEvents(): Promise<SharedEventInfo[]>
  /** null when the event isn't shared or you're not a member. */
  eventStatus(eventId: string): Promise<EventStatus | null>
  /** Admins and staff. */
  setCheckIn(eventId: string, guestId: string, checkedIn: boolean): Promise<void>

  listMembers(eventId: string): Promise<Member[]>
  listInvites(eventId: string): Promise<Invite[]>
  createInvite(eventId: string, input: { email: string | null; role: Role }): Promise<Invite>
  revokeInvite(eventId: string, inviteId: string): Promise<void>
  setRole(eventId: string, userId: string, role: Role): Promise<void>
  removeMember(eventId: string, userId: string): Promise<void>
  acceptInvite(token: string): Promise<{ eventId: string; role: Role }>

  listGroups(eventId: string): Promise<StaffGroup[]>
  saveGroup(eventId: string, group: { id?: string; name: string; memberIds: string[] }): Promise<StaffGroup>
  deleteGroup(eventId: string, groupId: string): Promise<void>

  /** Staff see messages to everyone and to their groups; admins see all, with read counts. */
  listMessages(eventId: string): Promise<Message[]>
  sendMessage(eventId: string, msg: NewMessage): Promise<Message>
  markRead(eventId: string, messageIds: string[]): Promise<void>
  readReceipts(eventId: string, messageId: string): Promise<ReadReceipt[]>
  /** Calls back whenever shared data may have changed (live push or polling); returns an unsubscribe function. */
  subscribe(onChange: () => void): () => void

  /** Test backend only: accounts you can switch between to see the app as another member. */
  testUsers?(): Account[]
  switchUser?(userId: string): Promise<void>
}
