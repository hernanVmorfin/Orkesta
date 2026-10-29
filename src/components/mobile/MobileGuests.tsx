import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { usePlanStore } from '../../store/usePlanStore'
import { CheckInToggle, FilterChip, GuestSheet } from './Sheets'

type Filter = 'all' | 'unseated' | 'in' | 'out'

/** Phone Guests tab: search, filter and check guests in at the door. */
export function MobileGuests({ onShowOnMap }: { onShowOnMap: (tableId: string, guestId: string) => void }) {
  const plan = usePlanStore((s) => s.plan)
  const linkViewOnly = usePlanStore((s) => s.linkViewOnly)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const tableById = useMemo(() => new Map(plan.elements.map((e) => [e.id, e])), [plan.elements])
  const tagName = useMemo(() => new Map(plan.tags.map((t) => [t.id, t.name])), [plan.tags])
  const seated = plan.guests.filter((g) => g.tableId && tableById.has(g.tableId)).length
  const checkedIn = plan.guests.filter((g) => g.checkedIn).length
  const counts: Record<Filter, number> = {
    all: plan.guests.length,
    unseated: plan.guests.length - seated,
    in: checkedIn,
    out: plan.guests.length - checkedIn,
  }

  const list = useMemo(() => {
    const k = q.trim().toLowerCase()
    return plan.guests
      .filter((g) => {
        if (filter === 'unseated' && g.tableId && tableById.has(g.tableId)) return false
        if (filter === 'in' && !g.checkedIn) return false
        if (filter === 'out' && g.checkedIn) return false
        return !k || `${g.name} ${g.company ?? ''} ${g.group ?? ''}`.toLowerCase().includes(k)
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
  }, [plan.guests, q, filter, tableById])
  const open = plan.guests.find((g) => g.id === openId)

  if (!plan.guests.length) {
    return (
      <p className="p-6 text-center text-sm text-muted">
        {linkViewOnly ? 'Guest names aren’t included in this link.' : 'No guests yet. Add or import them on a computer.'}
      </p>
    )
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="shrink-0 space-y-2 px-4 pb-2 pt-3">
        <div className="text-[13px] text-muted">{seated} of {plan.guests.length} seated · {checkedIn} checked in</div>
        <label className="flex h-11 items-center gap-2 rounded-xl border border-bg-2 bg-white px-3">
          <Search size={17} className="shrink-0 text-muted" />
          <input className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" placeholder="Search name, company or group"
            value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" />
          {q && <button aria-label="Clear search" onClick={() => setQ('')} className="-mr-2 grid h-10 w-10 place-items-center text-muted"><X size={17} /></button>}
        </label>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {([['all', 'All'], ['unseated', 'Unseated'], ['in', 'Checked in'], ['out', 'Not yet']] as const).map(([id, label]) => (
            <FilterChip key={id} active={filter === id} onClick={() => setFilter(id)}>{label} <span className="font-mono text-muted">{counts[id]}</span></FilterChip>
          ))}
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto border-t border-bg-2">
        {list.map((g) => {
          const t = g.tableId ? tableById.get(g.tableId) : undefined
          const sub = [g.company, g.tag && tagName.get(g.tag)].filter(Boolean).join(' · ')
          return (
            <li key={g.id} className="flex items-center gap-2 border-b border-bg-2 pl-4 pr-3">
              <button className="flex min-h-14 min-w-0 flex-1 flex-col justify-center py-2 text-left" onClick={() => setOpenId(g.id)}>
                <span className="truncate text-[15px] text-ink">{g.name}</span>
                {sub && <span className="truncate text-xs text-muted">{sub}</span>}
              </button>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-xs ${t ? 'border-bg-2 text-ink-2' : 'border-red-200 text-red-600'}`}>
                {t ? (t.number != null ? `T${t.number}` : t.label) : 'None'}
              </span>
              <CheckInToggle g={g} />
            </li>
          )
        })}
        {!list.length && <li className="p-6 text-center text-sm text-muted">No guests match.</li>}
      </ul>

      {open && <GuestSheet g={open} onClose={() => setOpenId(null)} onShowOnMap={(tableId) => onShowOnMap(tableId, open.id)} />}
    </div>
  )
}
