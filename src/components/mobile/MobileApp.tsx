import { useEffect, useRef, useState } from 'react'
import { Map as MapIcon, Armchair, Users, Info, Eye } from 'lucide-react'
import { usePlanStore } from '../../store/usePlanStore'
import { isTableKind } from '../../lib/catalog'
import { requestFocus } from '../../lib/canvas'
import { MobileMap } from './MobileMap'
import { MobileTables } from './MobileTables'
import { MobileGuests } from './MobileGuests'
import { MobileDetails } from './MobileDetails'

type Tab = 'map' | 'tables' | 'guests' | 'details'

const TABS: { id: Tab; label: string; icon: typeof MapIcon }[] = [
  { id: 'map', label: 'Map', icon: MapIcon },
  { id: 'tables', label: 'Tables', icon: Armchair },
  { id: 'guests', label: 'Guests', icon: Users },
  { id: 'details', label: 'Details', icon: Info },
]

/** Phone layout: review the plan, tables and guests, and check guests in. Editing stays on desktop. */
export function MobileApp() {
  const plan = usePlanStore((s) => s.plan)
  const viewOnly = usePlanStore((s) => s.viewOnly)
  const [tab, setTab] = useState<Tab>('map')
  const [foundGuest, setFoundGuest] = useState<string | null>(null)
  const focusId = useRef<string | null>(null)

  /** "Show on map" from another tab: select it, switch tabs, then center it once the map is visible again. */
  const showOnMap = (id: string, guestId: string | null = null) => {
    const e = plan.elements.find((x) => x.id === id)
    if (!e) return
    usePlanStore.getState().set({ selection: [id], highlightTable: isTableKind(e.kind) ? id : null })
    setFoundGuest(guestId)
    focusId.current = id
    setTab('map')
  }

  useEffect(() => {
    if (tab !== 'map' || !focusId.current) return
    const e = usePlanStore.getState().plan.elements.find((x) => x.id === focusId.current)
    focusId.current = null
    if (e) requestFocus({ x: e.x, y: e.y, zoom: 28 })
  }, [tab])

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
        {/* The map stays mounted (hidden) on other tabs: zoom is kept and PDF export always has a canvas */}
        <div className={tab === 'map' ? 'absolute inset-0' : 'hidden'}>
          <MobileMap foundGuest={foundGuest} setFoundGuest={setFoundGuest} />
        </div>
        {tab === 'tables' && <MobileTables onShowOnMap={(id) => showOnMap(id)} />}
        {tab === 'guests' && <MobileGuests onShowOnMap={showOnMap} />}
        {tab === 'details' && <MobileDetails />}
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
