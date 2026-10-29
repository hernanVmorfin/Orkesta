import { useState } from 'react'
import { Map as MapIcon, Armchair, Users, Info, Eye } from 'lucide-react'
import { usePlanStore } from '../../store/usePlanStore'
import { isTableKind } from '../../lib/catalog'
import { MobileMap } from './MobileMap'

type Tab = 'map' | 'tables' | 'guests' | 'details'

const TABS: { id: Tab; label: string; icon: typeof MapIcon }[] = [
  { id: 'map', label: 'Map', icon: MapIcon },
  { id: 'tables', label: 'Tables', icon: Armchair },
  { id: 'guests', label: 'Guests', icon: Users },
  { id: 'details', label: 'Details', icon: Info },
]

/** Phone layout: review the plan, tables and guests. Editing stays on desktop. */
export function MobileApp() {
  const plan = usePlanStore((s) => s.plan)
  const viewOnly = usePlanStore((s) => s.viewOnly)
  const [tab, setTab] = useState<Tab>('map')

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="flex shrink-0 items-center gap-3 border-b border-bg-2 px-4 pb-2.5" style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}>
        <img src="/brand/logo-inbest.png" alt="iNBest" className="h-5" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-ink">{plan.name}</div>
          <div className="truncate text-xs text-muted">{[plan.venue, plan.date].filter(Boolean).join(' · ') || 'No venue set'}</div>
        </div>
        {viewOnly && <span className="flex shrink-0 items-center gap-1 rounded-full bg-bg-2 px-2.5 py-1 text-xs text-ink-2"><Eye size={13} />View only</span>}
      </header>

      <main className="relative min-h-0 flex-1">
        {tab === 'map' ? <MobileMap /> : <ComingNext tab={tab} />}
      </main>

      <nav className="flex shrink-0 border-t border-bg-2 bg-white" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${tab === id ? 'text-accent-deep' : 'text-muted'}`}>
            <Icon size={21} />{label}
          </button>
        ))}
      </nav>
    </div>
  )
}

/** Tables, Guests and Details get their full screens in the next phases (see ROADMAP.md); until then, the headline numbers. */
function ComingNext({ tab }: { tab: Exclude<Tab, 'map'> }) {
  const plan = usePlanStore((s) => s.plan)
  const tables = plan.elements.filter((e) => isTableKind(e.kind))
  const seats = tables.reduce((n, t) => n + (t.seats ?? 0), 0)
  const seated = plan.guests.filter((g) => g.tableId).length
  const checkedIn = plan.guests.filter((g) => g.checkedIn).length
  const stats: Record<typeof tab, [string, string | number][]> = {
    tables: [['Tables', tables.length], ['Seats', seats], ['Seated', seated]],
    guests: [['Guests', plan.guests.length], ['Seated', seated], ['Checked in', checkedIn]],
    details: [['Tables', tables.length], ['Seats', seats], ['Guests', plan.guests.length]],
  }
  const next = {
    tables: 'The full table list is coming in the next update. Tap a table on the Map to see who sits there.',
    guests: 'Guest search and check-in are coming in the next update. You can already find a guest from the Map search.',
    details: 'The event summary, safety status and PDF download are coming soon.',
  }
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-3 gap-2">
        {stats[tab].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-bg p-3">
            <div className="text-xs text-muted">{label}</div>
            <div className="font-mono text-xl font-semibold text-ink">{value}</div>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted">{next[tab]}</p>
    </div>
  )
}
