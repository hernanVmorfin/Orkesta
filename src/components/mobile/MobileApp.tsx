import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Map as MapIcon, Armchair, Users, Info, Eye, MessagesSquare, Gauge, ChevronLeft } from 'lucide-react'
import { usePlanStore } from '../../store/usePlanStore'
import { showPin, useUnread } from '../../store/team'
import { isTableKind } from '../../lib/catalog'
import { requestFocus, type FocusRequest } from '../../lib/canvas'
import type { MessagePin } from '../../lib/backend'
import { TeamPanel } from '../team/TeamPanel'
import { UrgentBanner } from '../team/UrgentBanner'
import { MobileMap } from './MobileMap'
import { MobileTables } from './MobileTables'
import { MobileGuests } from './MobileGuests'
import { MobileDetails } from './MobileDetails'

const OpsPanel = lazy(() => import('../OpsPanel').then((m) => ({ default: m.OpsPanel })))

type Tab = 'map' | 'tables' | 'guests' | 'ops' | 'team' | 'details'

const TABS: { id: Tab; label: string; icon: typeof MapIcon }[] = [
  { id: 'map', label: 'Map', icon: MapIcon },
  { id: 'tables', label: 'Tables', icon: Armchair },
  { id: 'guests', label: 'Guests', icon: Users },
  { id: 'ops', label: 'Ops', icon: Gauge },
  { id: 'team', label: 'Team', icon: MessagesSquare },
  { id: 'details', label: 'Details', icon: Info },
]

/** Phone layout: review the plan, tables, guests and Ops figures, check guests in and read team messages. Editing stays on desktop. */
export function MobileApp() {
  const plan = usePlanStore((s) => s.plan)
  const viewOnly = usePlanStore((s) => s.viewOnly)
  const linkViewOnly = usePlanStore((s) => s.linkViewOnly)
  const role = usePlanStore((s) => s.role)
  const unread = useUnread()
  const [tab, setTab] = useState<Tab>('map')
  const [foundGuest, setFoundGuest] = useState<string | null>(null)
  const focus = useRef<FocusRequest | null>(null)

  /** "Show on map" from another tab: select it, switch tabs, then center it once the map is visible again. */
  const showOnMap = (id: string, guestId: string | null = null) => {
    const e = plan.elements.find((x) => x.id === id)
    if (!e) return
    usePlanStore.getState().set({ selection: [id], highlightTable: isTableKind(e.kind) ? id : null })
    setFoundGuest(guestId)
    focus.current = { x: e.x, y: e.y, zoom: 28 }
    setTab('map')
  }

  /** From the Ops tab: the object or comment is already selected; center it on the map. */
  const showPoint = (p: { x: number; y: number }) => {
    setFoundGuest(null)
    focus.current = { x: p.x, y: p.y, zoom: 28 }
    setTab('map')
  }

  const showPinOnMap = (pin: MessagePin) => {
    focus.current = showPin(pin, false)
    setFoundGuest(null)
    setTab('map')
  }

  const openTeamMessages = () => {
    usePlanStore.setState({ teamView: 'messages' })
    setTab('team')
  }

  useEffect(() => {
    if (tab !== 'map' || !focus.current) return
    requestFocus(focus.current)
    focus.current = null
  }, [tab])

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="flex shrink-0 items-center gap-3 border-b border-bg-2 px-4 pb-2.5" style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}>
        {linkViewOnly ? <img src="/brand/logo-inbest.png" alt="iNBest" className="h-5" /> : (
          <button aria-label="All events" className="-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-ink-2 active:bg-bg" onClick={() => void usePlanStore.getState().showHub()}>
            <ChevronLeft size={22} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold text-ink">{plan.name}</div>
          <div className="truncate text-xs text-muted">{[plan.venue, plan.date].filter(Boolean).join(' · ') || 'No venue set'}</div>
        </div>
        {viewOnly && <span className="flex shrink-0 items-center gap-1 rounded-full bg-bg-2 px-2.5 py-1 text-xs text-ink-2"><Eye size={13} />{!linkViewOnly && role === 'staff' ? 'Staff' : 'View only'}</span>}
      </header>

      <main className="relative min-h-0 flex-1">
        {/* The map stays mounted (hidden) on other tabs: zoom is kept and PDF export always has a canvas */}
        <div className={tab === 'map' ? 'absolute inset-0' : 'hidden'}>
          <MobileMap foundGuest={foundGuest} setFoundGuest={setFoundGuest} />
        </div>
        {tab === 'tables' && <MobileTables onShowOnMap={(id) => showOnMap(id)} />}
        {tab === 'guests' && <MobileGuests onShowOnMap={showOnMap} />}
        {tab === 'ops' && (
          <div className="absolute inset-0 overflow-y-auto">
            <Suspense fallback={<p className="p-4 text-sm text-muted">Loading…</p>}><OpsPanel readOnly onShow={showPoint} /></Suspense>
          </div>
        )}
        {tab === 'team' && <div className="absolute inset-0 overflow-y-auto"><TeamPanel onShowPin={showPinOnMap} /></div>}
        {tab === 'details' && <MobileDetails />}
        <UrgentBanner onView={openTeamMessages} className="absolute inset-x-3 top-3 z-30" />
      </main>

      <nav className="flex shrink-0 border-t border-bg-2 bg-white" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {TABS.filter((t) => t.id !== 'team' || !linkViewOnly).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
            aria-label={id === 'team' && unread > 0 ? `${label}, ${unread} unread` : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${tab === id ? 'text-accent-deep' : 'text-muted'}`}>
            <span className="relative">
              <Icon size={21} />
              {id === 'team' && unread > 0 && <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-semibold leading-4 text-white">{unread}</span>}
            </span>
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
