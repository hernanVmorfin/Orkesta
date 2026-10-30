import { useState } from 'react'
import { ChevronDown, Plus, Copy, Users, History, LayoutGrid } from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'
import { openShared, refreshSharedList } from '../store/team'
import { summarize } from '../lib/db'

const ROLE_LABEL = { admin: 'Admin', staff: 'Staff' }

/** Events on this device (switch, create, duplicate, delete) and events shared with you that aren't here yet. */
export function EventsMenu() {
  const s = usePlanStore()
  const [open, setOpen] = useState(false)
  // A fresh, unedited plan isn't saved yet, so list it anyway. The hub has the full list.
  const all = s.events.some((e) => e.id === s.plan.id) ? s.events : [summarize(s.plan), ...s.events]
  const events = all.filter((e) => !e.archived || e.id === s.plan.id).slice(0, 8)
  const roleOf = new Map(s.sharedEvents.map((e) => [e.eventId, e.role]))
  const elsewhere = s.sharedEvents.filter((e) => !all.some((x) => x.id === e.eventId))

  const act = (fn: () => Promise<void>) => { setOpen(false); void fn() }
  const toggle = () => {
    if (!open) void refreshSharedList()
    setOpen(!open)
  }

  return (
    <div className="relative">
      <button className="btn h-7 pointer-coarse:h-10 px-1" title="Your events" onClick={toggle}><ChevronDown size={16} /></button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-9 z-30 w-80 rounded-lg border border-bg-2 bg-white p-1 text-sm shadow-lg">
            <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left font-medium hover:bg-bg" onClick={() => act(s.showHub)}><LayoutGrid size={15} />All events</button>
            <div className="eyebrow px-3 pb-1 pt-2">Recent events</div>
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
              <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-bg" onClick={() => { setOpen(false); s.set({ dialog: 'newEvent', newEventStart: 'blank' }) }}><Plus size={15} />New event…</button>
              <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-bg" onClick={() => act(s.duplicateEvent)}><Copy size={15} />Duplicate this event</button>
              <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-bg" onClick={() => { setOpen(false); s.set({ dialog: 'history' }) }}><History size={15} />Version history…</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
