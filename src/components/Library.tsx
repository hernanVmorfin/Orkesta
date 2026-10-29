import { useState } from 'react'
import { Search, ChevronDown } from 'lucide-react'
import { LIBRARY_GROUPS } from '../lib/catalog'
import { ICONS } from '../lib/icons'
import type { CatalogItem } from '../types'
import { usePlanStore } from '../store/usePlanStore'
import { useIsWide } from '../lib/useMediaQuery'

function Thumb({ item }: { item: CatalogItem }) {
  const Icon = item.icon ? ICONS[item.icon] : undefined
  if (Icon) return <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: item.color }}><Icon size={16} color="#fff" /></span>
  if (item.shape === 'roundTable' || item.shape === 'cocktail' || item.shape === 'plant')
    return <span className="h-7 w-7 rounded-full border-2" style={{ borderColor: item.shape === 'plant' ? '#16a34a' : '#1ea7e8', background: item.shape === 'plant' ? '#22c55e' : '#fff' }} />
  if (item.shape === 'zone') return <span className="h-6 w-8 rounded border-2 border-dashed" style={{ borderColor: item.color }} />
  const r = Math.min(item.w / item.h, 3)
  return <span className="rounded-sm" style={{ background: item.shape === 'rectTable' ? '#fff' : item.color, border: item.shape === 'rectTable' ? '2px solid #1ea7e8' : undefined, width: r >= 1 ? 32 : 32 * r + 6, height: r >= 1 ? Math.max(6, 32 / r) : 28 }} />
}

export function Library() {
  const [q, setQ] = useState('')
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const placing = usePlanStore((s) => s.placing)
  const set = usePlanStore((s) => s.set)
  const wide = useIsWide()

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-bg-2 bg-white">
      <div className="p-3">
        <div className="eyebrow mb-2">Object library</div>
        <label className="relative block">
          <Search size={14} className="absolute left-2 top-2 text-muted" />
          <input className="input pl-7" placeholder="Search tables, exits, staff…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <div className="panel-scroll flex-1 overflow-y-auto px-3 pb-4">
        {LIBRARY_GROUPS.map((g) => {
          const items = g.items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()))
          if (!items.length) return null
          const isClosed = closed[g.id] && !q
          return (
            <section key={g.id} className="mb-2">
              <button className="flex w-full items-center justify-between py-1.5 text-xs font-semibold text-ink-2"
                onClick={() => setClosed((c) => ({ ...c, [g.id]: !c[g.id] }))}>
                {g.name}
                <ChevronDown size={14} className={isClosed ? '-rotate-90 transition' : 'transition'} />
              </button>
              {!isClosed && (
                <div className="grid grid-cols-3 gap-1.5">
                  {items.map((i) => (
                    <button key={i.kind} draggable
                      onDragStart={(e) => e.dataTransfer.setData('application/x-kind', i.kind)}
                      // As a drawer (below 1280 px) the library gets out of the way so the plan can be tapped
                      onClick={() => set({ placing: placing === i.kind ? null : i.kind, tool: 'select', ...(wide ? {} : { showLibrary: false }) })}
                      title={`${i.name} · ${i.w} × ${i.h} m`}
                      className={`flex h-[68px] flex-col items-center justify-center gap-1 rounded-lg border text-center text-[10px] leading-tight transition ${placing === i.kind ? 'border-accent bg-accent/10' : 'border-bg-2 hover:border-accent/50 hover:bg-bg'}`}>
                      <span className="grid h-8 place-items-center"><Thumb item={i} /></span>
                      <span className="line-clamp-2 px-0.5 text-ink-2">{i.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )
        })}
        <p className="mt-3 text-[11px] leading-snug text-muted">Drag onto the plan or click, then click the plan. All items are true to scale in meters.</p>
      </div>
    </aside>
  )
}
