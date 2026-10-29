import { usePlanStore, type RightTab } from '../store/usePlanStore'
import { Inspector } from './Inspector'
import { TablesPanel } from './TablesPanel'
import { LayersPanel } from './LayersPanel'
import { VenuePanel } from './VenuePanel'

const TABS: { id: RightTab; label: string }[] = [
  { id: 'tables', label: 'Tables & guests' },
  { id: 'inspect', label: 'Inspect' },
  { id: 'layers', label: 'Layers' },
  { id: 'venue', label: 'Venue' },
]

export function RightPanel() {
  const tab = usePlanStore((s) => s.rightTab)
  const set = usePlanStore((s) => s.set)
  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-bg-2 bg-white">
      <nav className="flex border-b border-bg-2 px-2">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => set({ rightTab: t.id })}
            className={`-mb-px border-b-2 px-3 py-3 text-xs font-medium ${tab === t.id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto">
        {tab === 'tables' && <TablesPanel />}
        {tab === 'inspect' && <Inspector />}
        {tab === 'layers' && <LayersPanel />}
        {tab === 'venue' && <VenuePanel />}
      </div>
    </aside>
  )
}
