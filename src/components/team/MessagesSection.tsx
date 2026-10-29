import { useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronUp, MapPin, Send, TriangleAlert } from 'lucide-react'
import { usePlanStore } from '../../store/usePlanStore'
import { loadReceipts, markRead, sendMessage } from '../../store/team'
import type { Message, MessagePin, ReadReceipt } from '../../lib/backend'

function fmtTime(t: number) {
  const d = new Date(t)
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`
}

/** Admins write to all staff or a group and see who has read it; staff read (no replies). */
export function MessagesSection({ onShowPin }: { onShowPin: (pin: MessagePin) => void }) {
  const messages = usePlanStore((s) => s.messages)
  const role = usePlanStore((s) => s.role)
  const admin = role === 'admin'
  // Staff: what's shown here counts as read; ones that were new (or arrive while it's open) stay marked "New"
  const [openedAt] = useState(() => Date.now())
  const [unreadAtOpen] = useState(() => new Set(messages.filter((m) => !m.readByMe).map((m) => m.id)))

  useEffect(() => {
    if (role !== 'staff') return
    const ids = messages.filter((m) => !m.readByMe).map((m) => m.id)
    if (ids.length) void markRead(ids)
  }, [messages, role])

  return (
    <div>
      {admin && <Compose />}
      <section className="p-4">
        <div className="eyebrow mb-2">{admin ? 'Sent' : 'From the event admins'}</div>
        {!messages.length && (
          <p className="text-sm text-muted">
            {admin ? 'No messages yet. What you send here shows up for your staff right away.' : 'No messages yet. Messages from the event’s admins show up here.'}
          </p>
        )}
        <ul className="space-y-2">
          {messages.map((m) => (
            <MessageItem key={m.id} m={m} admin={admin} isNew={!admin && (unreadAtOpen.has(m.id) || m.createdAt > openedAt)} onShowPin={onShowPin} />
          ))}
        </ul>
      </section>
    </div>
  )
}

function Compose() {
  const groups = usePlanStore((s) => s.people?.groups)
  const selected = usePlanStore((s) => s.plan.elements.find((e) => e.id === s.selection[0]))
  const [to, setTo] = useState('all')
  const [urgent, setUrgent] = useState(false)
  const [body, setBody] = useState('')
  const [pinOn, setPinOn] = useState(false)
  const [busy, setBusy] = useState(false)
  // A deleted group falls back to everyone
  const target = to !== 'all' && groups?.some((g) => g.id === to) ? to : 'all'

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    setBusy(true)
    const pin: MessagePin | null = pinOn && selected ? { x: selected.x, y: selected.y, label: selected.label, elementId: selected.id } : null
    const ok = await sendMessage({ audience: target === 'all' ? 'all' : 'group', groupId: target === 'all' ? null : target, priority: urgent ? 'urgent' : 'normal', body, pin })
    setBusy(false)
    if (!ok) return
    setBody('')
    setUrgent(false)
    setPinOn(false)
  }

  return (
    <form className="space-y-2 border-b border-bg-2 p-4" onSubmit={send}>
      <div className="eyebrow">New message</div>
      <div className="flex gap-1">
        <select className="input min-w-0" aria-label="Send to" value={target} onChange={(e) => setTo(e.target.value)}>
          <option value="all">All staff</option>
          {groups?.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.memberIds.length})</option>)}
        </select>
        <button type="button" aria-pressed={urgent} onClick={() => setUrgent(!urgent)} title="Urgent messages show as a banner on staff screens"
          className={`btn h-[30px] shrink-0 border px-2 text-xs pointer-coarse:h-10 ${urgent ? 'border-red-600 bg-red-600 text-white hover:bg-red-700' : 'border-bg-2'}`}>
          <TriangleAlert size={13} />Urgent
        </button>
      </div>
      <textarea className="input h-20 resize-none py-1.5" maxLength={1000} placeholder="Message to your staff…" aria-label="Message" value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="flex items-center gap-2">
        {selected ? (
          <label className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-ink-2">
            <input type="checkbox" className="accent-[#1ea7e8]" checked={pinOn} onChange={(e) => setPinOn(e.target.checked)} />
            <MapPin size={13} className="shrink-0 text-muted" /><span className="truncate">Pin “{selected.label}” on the map</span>
          </label>
        ) : (
          <span className="flex-1 text-[11px] leading-snug text-muted">To pin a place, select it on the plan first.</span>
        )}
        <button className="btn btn-primary shrink-0" disabled={busy || !body.trim()}><Send size={14} />Send</button>
      </div>
    </form>
  )
}

function MessageItem({ m, admin, isNew, onShowPin }: { m: Message; admin: boolean; isNew: boolean; onShowPin: (pin: MessagePin) => void }) {
  const [open, setOpen] = useState(false)
  const [receipts, setReceipts] = useState<ReadReceipt[] | null>(null)
  const urgent = m.priority === 'urgent'

  // Reload who has read it while the list is open, as read counts change
  useEffect(() => {
    if (!open) return
    let live = true
    void loadReceipts(m.id).then((r) => { if (live) setReceipts(r) })
    return () => { live = false }
  }, [open, m.id, m.readCount])

  return (
    <li className={`rounded-lg border p-3 ${urgent ? 'border-red-200 bg-red-50' : isNew ? 'border-accent/40 bg-accent/5' : 'border-bg-2'}`}>
      <div className="mb-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted">
        {urgent && <span className="rounded bg-red-600 px-1.5 py-px font-semibold uppercase tracking-wide text-white">Urgent</span>}
        {isNew && <span className="font-semibold text-accent-deep">New</span>}
        <span>{admin ? `To ${m.groupName ?? 'all staff'}` : `${m.senderName}${m.groupName ? ` to ${m.groupName}` : ''}`}</span>
        <span>· {fmtTime(m.createdAt)}</span>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm text-ink">{m.body}</p>
      {(m.pin || admin) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {m.pin && (
            <button className="btn h-7 max-w-full border border-bg-2 bg-white px-2 text-xs pointer-coarse:h-10" onClick={() => onShowPin(m.pin!)}>
              <MapPin size={13} className="shrink-0" /><span className="truncate">{m.pin.label}</span>
            </button>
          )}
          {admin && (
            <button className="ml-auto flex items-center gap-1 text-[11px] text-muted hover:text-ink pointer-coarse:min-h-10" aria-expanded={open} onClick={() => setOpen(!open)}>
              Read by {m.readCount ?? 0} of {m.recipientCount ?? 0}{open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>
      )}
      {admin && open && (
        <ul className="mt-2 space-y-1 border-t border-bg-2 pt-2 text-xs">
          {receipts === null ? <li className="text-muted">Loading…</li>
            : !receipts.length ? <li className="text-muted">No one gets this message yet.</li>
            : receipts.map((r) => (
              <li key={r.userId} className="flex items-center gap-2">
                {r.readAt ? <Check size={12} className="shrink-0 text-green-600" /> : <span className="w-3 shrink-0" />}
                <span className="min-w-0 flex-1 truncate text-ink">{r.name}</span>
                <span className="shrink-0 text-muted">{r.readAt ? fmtTime(r.readAt) : 'Not read yet'}</span>
              </li>
            ))}
        </ul>
      )}
    </li>
  )
}
