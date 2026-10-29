import { useState } from 'react'
import { ChevronDown, Plus, Copy, Trash2, Users } from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'
import { openShared, refreshSharedList } from '../store/team'
import { summarize, type EventSummary } from '../lib/db'

const ROLE_LABEL = { admin: 'Admin', staff: 'Staff' }

/** Events on this device (switch, create, duplicate, delete) and events shared with you that aren't here yet. */
export function EventsMenu() {
  const s = usePlanStore()
  const [open, setOpen] = useState(false)
  // A fresh, unedited plan isn't saved yet, so list it anyway
  const events = s.events.some((e) => e.id === s.plan.id) ? s.events : [summarize(s.plan), ...s.events]
  const roleOf = new Map(s.sharedEvents.map((e) => [e.eventId, e.role]))
  const elsewhere = s.sharedEvents.filter((e) => !events.some((x) => x.id === e.eventId))

  const act = (fn: () => Promise<void>) => { setOpen(false); void fn() }
  const toggle = () => {
    if (!open) void refreshSharedList()
    setOpen(!open)
  }
  const remove = (e: EventSummary) => {
    const name = e.name || 'Untitled event'
    const q = e.shared
      ? `Remove "${name}" from this device? It stays shared with your team, and you can open it again from "Shared with you".`
      : `Delete "${name}"? It will be removed from this browser.`
    if (confirm(q)) act(() => s.deleteEvent(e.id))
  }

  return (
    <div className="relative">
      <button className="btn h-7 pointer-coarse:h-10 px-1" title="Your events" onClick={toggle}><ChevronDown size={16} /></button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-9 z-30 w-80 rounded-lg border border-bg-2 bg-white p-1 text-sm shadow-lg">
            <div className="eyebrow px-3 pb-1 pt-2">Events on this device</div>
            <ul className="panel-scroll max-h-72 overflow-y-auto">
              {events.map((e) => (
                <li key={e.id} className={`group flex items-center rounded-md hover:bg-bg ${e.id === s.plan.id ? 'bg-accent/10' : ''}`}>
                  <button className="min-w-0 flex-1 px-3 py-2 text-left" onClick={() => act(() => s.openEvent(e.id))}>
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-ink">{e.name || 'Untitled event'}</span>
                      {(e.shared || roleOf.has(e.id)) && (
                        <span className="shrink-0 rounded-full bg-accent/10 px-1.5 text-[10px] font-medium leading-4 text-accent-deep">{ROLE_LABEL[roleOf.get(e.id)!] ?? 'Shared'}</span>
                      )}
                    </div>
                    <div className="truncate text-[11px] text-muted">
                      {[e.venue, e.date].filter(Boolean).join(' · ') || 'No venue yet'} · edited {new Date(e.updatedAt).toLocaleDateString()}
                    </div>
                  </button>
                  <button title={e.shared ? 'Remove from this device' : 'Delete event'} className="mr-1 rounded p-1.5 text-muted opacity-0 hover:text-red-600 group-hover:opacity-100 pointer-coarse:opacity-100"
                    onClick={() => remove(e)}>
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
            {elsewhere.length > 0 && (
              <>
                <div className="eyebrow px-3 pb-1 pt-3">Shared with you</div>
                <ul className="panel-scroll max-h-48 overflow-y-auto">
                  {elsewhere.map((e) => (
                    <li key={e.eventId}>
                      <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-bg" onClick={() => act(() => openShared(e.eventId))}>
                        <Users size={15} className="shrink-0 text-muted" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-ink">{e.name || 'Untitled event'}</div>
                          <div className="truncate text-[11px] text-muted">{ROLE_LABEL[e.role]} · not on this device yet</div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="mt-1 border-t border-bg-2 pt-1">
              <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-bg" onClick={() => act(s.newEvent)}><Plus size={15} />New event</button>
              <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-bg" onClick={() => act(s.duplicateEvent)}><Copy size={15} />Duplicate this event</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
