import { usePlanStore, type RightTab } from '../store/usePlanStore'
import { showPin, useUnread } from '../store/team'
import { Inspector } from './Inspector'
import { TablesPanel } from './TablesPanel'
import { LayersPanel } from './LayersPanel'
import { VenuePanel } from './VenuePanel'
import { OpsPanel } from './OpsPanel'
import { TeamPanel } from './team/TeamPanel'

const TABS: { id: RightTab; label: string }[] = [
  { id: 'tables', label: 'Seating' },
  { id: 'inspect', label: 'Inspect' },
  { id: 'layers', label: 'Layers' },
  { id: 'venue', label: 'Venue' },
  { id: 'ops', label: 'Ops' },
  { id: 'team', label: 'Team' },
]

export function RightPanel() {
  const tab = usePlanStore((s) => s.rightTab)
  const set = usePlanStore((s) => s.set)
  // View-only links have no team
  const linkViewOnly = usePlanStore((s) => s.linkViewOnly)
  const unread = useUnread()
  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-bg-2 bg-white">
      <nav className="flex border-b border-bg-2 px-2">
        {TABS.filter((t) => t.id !== 'team' || !linkViewOnly).map((t) => (
          <button key={t.id} onClick={() => set({ rightTab: t.id })}
            className={`-mb-px flex items-center gap-1 border-b-2 px-2.5 py-3 text-xs font-medium ${tab === t.id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
            {t.label}
            {t.id === 'team' && unread > 0 && <span className="rounded-full bg-red-600 px-1.5 text-[10px] leading-4 text-white" aria-label={`${unread} unread`}>{unread}</span>}
          </button>
        ))}
      </nav>
      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto">
        {tab === 'tables' && <TablesPanel />}
        {tab === 'inspect' && <Inspector />}
        {tab === 'layers' && <LayersPanel />}
        {tab === 'venue' && <VenuePanel />}
        {tab === 'ops' && <OpsPanel />}
        {tab === 'team' && !linkViewOnly && <TeamPanel onShowPin={(pin) => { showPin(pin) }} />}
      </div>
    </aside>
  )
}
