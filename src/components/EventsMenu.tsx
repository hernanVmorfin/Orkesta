import { useState } from 'react'
import { ChevronDown, Plus, Copy, Trash2 } from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'
import { summarize } from '../lib/db'

/** Events stored in this browser: switch, create, duplicate, delete. */
export function EventsMenu() {
  const s = usePlanStore()
  const [open, setOpen] = useState(false)
  // A fresh, unedited plan isn't saved yet, so list it anyway
  const events = s.events.some((e) => e.id === s.plan.id) ? s.events : [summarize(s.plan), ...s.events]

  const act = (fn: () => Promise<void>) => { setOpen(false); void fn() }

  return (
    <div className="relative">
      <button className="btn h-7 px-1" title="Your events" onClick={() => setOpen(!open)}><ChevronDown size={16} /></button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-9 z-30 w-80 rounded-lg border border-bg-2 bg-white p-1 text-sm shadow-lg">
            <div className="eyebrow px-3 pb-1 pt-2">Events in this browser</div>
            <ul className="panel-scroll max-h-72 overflow-y-auto">
              {events.map((e) => (
                <li key={e.id} className={`group flex items-center rounded-md hover:bg-bg ${e.id === s.plan.id ? 'bg-accent/10' : ''}`}>
                  <button className="min-w-0 flex-1 px-3 py-2 text-left" onClick={() => act(() => s.openEvent(e.id))}>
                    <div className="truncate font-medium text-ink">{e.name || 'Untitled event'}</div>
                    <div className="truncate text-[11px] text-muted">
                      {[e.venue, e.date].filter(Boolean).join(' · ') || 'No venue yet'} · edited {new Date(e.updatedAt).toLocaleDateString()}
                    </div>
                  </button>
                  <button title="Delete event" className="mr-1 rounded p-1.5 text-muted opacity-0 hover:text-red-600 group-hover:opacity-100"
                    onClick={() => { if (confirm(`Delete "${e.name || 'Untitled event'}"? It will be removed from this browser.`)) act(() => s.deleteEvent(e.id)) }}>
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
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
