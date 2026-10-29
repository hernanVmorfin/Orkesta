import { useState } from 'react'
import { Copy, Link2, Mail, Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react'
import { usePlanStore } from '../../store/usePlanStore'
import { createInvite, deleteGroup, inviteUrl, removeMember, revokeInvite, saveGroup, setMemberRole } from '../../store/team'
import type { Invite, Member, Role, StaffGroup } from '../../lib/backend'
import { toast } from '../../lib/toast'
import { Avatar } from './Avatar'

const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', staff: 'Staff' }
const iconBtn = 'rounded p-1.5 text-muted pointer-coarse:p-3'
const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    toast('Invite link copied')
  } catch {
    toast('Couldn’t copy. Select the link and copy it.')
  }
}

/** The event's team. Admins invite people, change roles, remove people and manage staff groups. */
export function PeopleSection() {
  const people = usePlanStore((s) => s.people)
  const admin = usePlanStore((s) => s.role === 'admin')
  const me = usePlanStore((s) => s.account?.id)
  if (!people) return <p className="p-4 text-sm text-muted">Loading the team…</p>
  return (
    <div>
      {admin && <InviteForm />}
      <section className="border-b border-bg-2 p-4">
        <div className="eyebrow mb-2">Team · {people.members.length}</div>
        <ul>
          {people.members.map((m) => <MemberRow key={m.userId} m={m} me={m.userId === me} admin={admin} />)}
        </ul>
        {!admin && <p className="mt-2 text-xs text-muted">Only the event’s admins can change the team.</p>}
      </section>
      {admin && people.invites.length > 0 && <PendingInvites invites={people.invites} />}
      {admin && <Groups groups={people.groups} members={people.members} />}
    </div>
  )
}

function InviteForm() {
  const mock = usePlanStore((s) => s.backendMode === 'mock')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('staff')
  const [busy, setBusy] = useState(false)
  const [made, setMade] = useState<Invite | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const invite = await createInvite(email.trim() || null, role)
    setBusy(false)
    if (!invite) return
    setMade(invite)
    setEmail('')
  }

  return (
    <section className="space-y-2 border-b border-bg-2 p-4">
      <div className="eyebrow">Invite someone</div>
      <form className="flex gap-1" onSubmit={submit}>
        <input className="input min-w-0" type="email" placeholder="Email (optional)" aria-label="Email to invite" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select className="input w-[76px] shrink-0 px-1" aria-label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
        <button className="btn btn-primary h-[30px] shrink-0 px-2 pointer-coarse:h-10" disabled={busy}>
          {email.trim() ? <><UserPlus size={14} />Invite</> : <><Link2 size={14} />Get link</>}
        </button>
      </form>
      <p className="text-[11px] leading-snug text-muted">
        Staff see the plan and guest details, check guests in and read your messages. Admins can also edit the plan and manage the team. Leave the email empty for a link anyone can use.
      </p>
      {made && (
        <div className="rounded-lg border border-accent/40 bg-accent/5 p-3 text-xs">
          <div className="mb-1.5 flex items-start gap-2">
            <span className="flex-1 font-semibold text-ink">{made.email ? `Invite for ${made.email}` : 'Invite link'} · {ROLE_LABEL[made.role]}</span>
            <button type="button" aria-label="Close" className="-m-1 rounded p-1 text-muted hover:text-ink" onClick={() => setMade(null)}><X size={14} /></button>
          </div>
          <div className="flex gap-1">
            <input readOnly className="input font-mono text-[11px]" aria-label="Invite link" value={inviteUrl(made.token)} onFocus={(e) => e.target.select()} />
            <button type="button" className="btn btn-primary h-[30px] shrink-0 px-2 pointer-coarse:h-10" onClick={() => void copyLink(inviteUrl(made.token))}><Copy size={14} />Copy</button>
          </div>
          <p className="mt-1.5 leading-snug text-muted">
            {made.email ? `Send it to them. It works once, for 7 days.` : `Anyone with this link can join as ${made.role} for 7 days.`}
            {mock && ' Test mode: open it in another tab to join as them there.'}
          </p>
        </div>
      )}
    </section>
  )
}

function MemberRow({ m, me, admin }: { m: Member; me: boolean; admin: boolean }) {
  const changeRole = async (role: Role) => {
    if (me && role !== 'admin' && !confirm('Make yourself staff? You won’t be able to edit this event or manage its team any more.')) return
    await setMemberRole(m.userId, role)
  }
  const remove = async () => {
    const q = me ? 'Leave this event’s team? You’ll lose access to it.' : `Remove ${m.name} from this event? They lose access right away.`
    if (confirm(q)) await removeMember(m.userId)
  }
  return (
    <li className="flex items-center gap-2 py-1.5">
      <Avatar name={m.name} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-ink">{m.name}{me && <span className="text-muted"> (you)</span>}</div>
        {m.email && <div className="truncate text-[11px] text-muted">{m.email}</div>}
      </div>
      {admin ? (
        <>
          <select className="input h-7 w-[76px] px-1 text-xs pointer-coarse:h-10" aria-label={`Role for ${m.name}`} value={m.role} onChange={(e) => void changeRole(e.target.value as Role)}>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
          </select>
          <button title={me ? 'Leave the team' : `Remove ${m.name}`} className={`${iconBtn} hover:text-red-600`} onClick={() => void remove()}><Trash2 size={14} /></button>
        </>
      ) : (
        <span className="rounded-full bg-bg px-2 py-0.5 text-[11px] text-ink-2">{ROLE_LABEL[m.role]}</span>
      )}
    </li>
  )
}

function PendingInvites({ invites }: { invites: Invite[] }) {
  return (
    <section className="border-b border-bg-2 p-4">
      <div className="eyebrow mb-2">Pending invites · {invites.length}</div>
      <ul>
        {invites.map((i) => (
          <li key={i.id} className="flex items-center gap-2 py-1.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-dashed border-muted/40 text-muted">{i.email ? <Mail size={14} /> : <Link2 size={14} />}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-ink">{i.email ?? 'Anyone with the link'}</div>
              <div className="text-[11px] text-muted">{ROLE_LABEL[i.role]} · expires {fmtDate(i.expiresAt)}</div>
            </div>
            <button title="Copy invite link" className={`${iconBtn} hover:text-ink`} onClick={() => void copyLink(inviteUrl(i.token))}><Copy size={14} /></button>
            <button title="Cancel invite" className={`${iconBtn} hover:text-red-600`}
              onClick={() => { if (confirm('Cancel this invite? Its link stops working.')) void revokeInvite(i.id) }}><X size={14} /></button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Groups({ groups, members }: { groups: StaffGroup[]; members: Member[] }) {
  const [editing, setEditing] = useState<string | null>(null) // group id, or 'new'
  const nameOf = new Map(members.map((m) => [m.userId, m.name]))
  return (
    <section className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="eyebrow">Staff groups</div>
        {editing === null && <button className="btn h-7 px-2 text-xs pointer-coarse:h-10" onClick={() => setEditing('new')}><Plus size={13} />New group</button>}
      </div>
      {!groups.length && editing === null && <p className="text-xs text-muted">Groups let you message part of the team, like “Bar” or “Front door”.</p>}
      <ul>
        {groups.map((g) => (editing === g.id ? (
          <li key={g.id}><GroupEditor group={g} members={members} onDone={() => setEditing(null)} /></li>
        ) : (
          <li key={g.id} className="flex items-center gap-2 py-1.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-ink">{g.name} <span className="text-muted">· {g.memberIds.length}</span></div>
              <div className="truncate text-[11px] text-muted">{g.memberIds.map((id) => nameOf.get(id)).filter(Boolean).join(', ') || 'No one yet'}</div>
            </div>
            <button title={`Edit ${g.name}`} className={`${iconBtn} hover:text-ink`} onClick={() => setEditing(g.id)}><Pencil size={14} /></button>
            <button title={`Delete ${g.name}`} className={`${iconBtn} hover:text-red-600`}
              onClick={() => { if (confirm(`Delete the group “${g.name}”? Messages already sent to it stay.`)) void deleteGroup(g.id) }}><Trash2 size={14} /></button>
          </li>
        )))}
      </ul>
      {editing === 'new' && <GroupEditor members={members} onDone={() => setEditing(null)} />}
    </section>
  )
}

function GroupEditor({ group, members, onDone }: { group?: StaffGroup; members: Member[]; onDone: () => void }) {
  const [name, setName] = useState(group?.name ?? '')
  const [ids, setIds] = useState<string[]>(group?.memberIds ?? [])
  const [busy, setBusy] = useState(false)
  const toggle = (id: string) => setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const ok = await saveGroup({ id: group?.id, name, memberIds: ids })
    setBusy(false)
    if (ok) onDone()
  }

  return (
    <form onSubmit={save} className="my-1 space-y-2 rounded-lg bg-bg p-3">
      <input className="input" placeholder="Group name, e.g. Bar team" aria-label="Group name" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="panel-scroll max-h-48 overflow-y-auto">
        {members.map((m) => (
          <label key={m.userId} className="flex min-h-8 items-center gap-2 text-sm pointer-coarse:min-h-11">
            <input type="checkbox" className="accent-[#1ea7e8]" checked={ids.includes(m.userId)} onChange={() => toggle(m.userId)} />
            <span className="min-w-0 flex-1 truncate">{m.name}</span>
            <span className="text-[11px] text-muted">{ROLE_LABEL[m.role]}</span>
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-1">
        <button type="button" className="btn h-7 text-xs pointer-coarse:h-10" onClick={onDone}>Cancel</button>
        <button className="btn btn-primary h-7 text-xs pointer-coarse:h-10" disabled={busy || !name.trim()}>{group ? 'Save group' : 'Create group'}</button>
      </div>
    </form>
  )
}
