import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { usePlanStore } from '../../store/usePlanStore'
import { isTableKind } from '../../lib/catalog'
import { FilterChip, ObjectSheet, TagBadge } from './Sheets'

/** Phone Tables tab: every table with how full it is, filterable by tag. */
export function MobileTables({ onShowOnMap }: { onShowOnMap: (tableId: string) => void }) {
  const plan = usePlanStore((s) => s.plan)
  const [tag, setTag] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const tables = useMemo(
    () => plan.elements.filter((e) => isTableKind(e.kind)).sort((a, b) => (a.number ?? 0) - (b.number ?? 0)),
    [plan.elements],
  )
  const used = useMemo(() => {
    const m = new Map<string, number>()
    plan.guests.forEach((g) => g.tableId && m.set(g.tableId, (m.get(g.tableId) ?? 0) + 1))
    return m
  }, [plan.guests])

  const tagOf = (t: { tag?: string }) => t.tag ?? 'general'
  const tagsInUse = plan.tags.filter((t) => tables.some((x) => tagOf(x) === t.id))
  const shown = tag === 'all' ? tables : tables.filter((t) => tagOf(t) === tag)
  const seats = tables.reduce((n, t) => n + (t.seats ?? 0), 0)
  const seated = tables.reduce((n, t) => n + (used.get(t.id) ?? 0), 0)
  const open = tables.find((t) => t.id === openId)

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="shrink-0 px-4 pb-2 pt-3">
        <div className="text-[13px] text-muted">{tables.length} tables · {seats} seats · {seated} seated</div>
        {tagsInUse.length > 1 && (
          <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            <FilterChip active={tag === 'all'} onClick={() => setTag('all')}>All</FilterChip>
            {tagsInUse.map((t) => <FilterChip key={t.id} active={tag === t.id} onClick={() => setTag(t.id)}>{t.name}</FilterChip>)}
          </div>
        )}
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto border-t border-bg-2">
        {shown.map((t) => {
          const u = used.get(t.id) ?? 0
          const cap = t.seats ?? 0
          const tg = plan.tags.find((x) => x.id === tagOf(t))
          return (
            <li key={t.id} className="border-b border-bg-2">
              <button onClick={() => setOpenId(t.id)} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left active:bg-bg">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[15px] font-medium text-ink">
                    <span className="truncate">{t.label}</span>
                    {tg && tg.id !== 'general' && <TagBadge tag={tg} />}
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-bg-2">
                    <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, (u / (cap || 1)) * 100)}%`, background: tg?.color ?? '#1ea7e8' }} />
                  </div>
                </div>
                <span className={`font-mono text-sm ${u >= cap && cap > 0 ? 'text-ink' : 'text-muted'}`}>{u}/{cap}</span>
                <ChevronRight size={18} className="shrink-0 text-muted" />
              </button>
            </li>
          )
        })}
        {!tables.length && <li className="p-6 text-center text-sm text-muted">No tables in this plan yet.</li>}
      </ul>

      {open && <ObjectSheet e={open} foundGuest={null} onClose={() => setOpenId(null)} onShowOnMap={() => onShowOnMap(open.id)} />}
    </div>
  )
}
