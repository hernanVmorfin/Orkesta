import { useMemo, useRef, useState } from 'react'
import { Upload, Download, Wand2, UserPlus, Trash2, CheckCircle2, Circle, GripVertical } from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'
import { checkIn, useCanCheckIn } from '../store/team'
import { isTableKind } from '../lib/catalog'
import { CSV_TEMPLATE, download, guestsToCsv, parseGuestsCsv } from '../lib/csv'
import type { FillMode } from '../lib/seating'

type Filter = 'all' | 'unassigned' | 'assigned'

export function TablesPanel() {
  const s = usePlanStore()
  const { plan, viewOnly } = s
  const canCheckIn = useCanCheckIn()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [autoOpen, setAutoOpen] = useState(false)
  const [mode, setMode] = useState<FillMode>('order')
  const [reseatAll, setReseatAll] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const tables = useMemo(
    () => plan.elements.filter((e) => isTableKind(e.kind)).sort((a, b) => (a.number ?? 0) - (b.number ?? 0)),
    [plan.elements],
  )
  const used = useMemo(() => {
    const m = new Map<string, number>()
    plan.guests.forEach((g) => g.tableId && m.set(g.tableId, (m.get(g.tableId) ?? 0) + 1))
    return m
  }, [plan.guests])
  const seats = tables.reduce((n, t) => n + (t.seats ?? 0), 0)
  const assigned = plan.guests.filter((g) => g.tableId).length
  const checked = plan.guests.filter((g) => g.checkedIn).length
  const tagById = new Map(plan.tags.map((t) => [t.id, t]))

  const guests = plan.guests.filter((g) => {
    if (filter === 'unassigned' && g.tableId) return false
    if (filter === 'assigned' && !g.tableId) return false
    const hay = `${g.name} ${g.company ?? ''} ${g.group ?? ''}`.toLowerCase()
    return hay.includes(q.toLowerCase())
  })

  const onImport = async (f: File) => {
    const list = parseGuestsCsv(await f.text(), plan)
    s.addGuests(list)
    toast(`Imported ${list.length} guests`)
  }

  const runAuto = () => {
    if (reseatAll && assigned > 0 && !confirm(`Re-seat all ${plan.guests.length} guests? Current seating will be replaced (you can undo).`)) return
    const r = s.autoAssign({ mode, reseatAll })
    let msg = `Seated ${r.seated} ${r.seated === 1 ? 'guest' : 'guests'}`
    if (r.unseated) msg += ` · ${r.unseated} still need a seat${r.reservedFree ? ` (${r.reservedFree} free seats are at tagged tables)` : ''}`
    toast(msg)
    setAutoOpen(false)
    setReseatAll(false) // never carry a destructive choice into the next run
  }

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-4 gap-2 border-b border-bg-2 p-4">
        <Stat label="Tables" value={tables.length} />
        <Stat label="Seats" value={seats} />
        <Stat label="Seated" value={`${assigned}/${plan.guests.length}`} />
        <Stat label="Check-in" value={checked} />
      </div>

      <div className="border-b border-bg-2 p-4">
        <div className="eyebrow mb-2">Tables · click to locate</div>
        <div className="grid grid-cols-5 gap-1.5">
          {tables.map((t) => {
            const u = used.get(t.id) ?? 0
            const pct = Math.min(1, u / (t.seats || 1))
            const tc = tagById.get(t.tag ?? '')?.color ?? '#1ea7e8'
            return (
              <button key={t.id} title={`${t.label} · ${u}/${t.seats}`}
                onClick={() => s.set({ selection: [t.id], highlightTable: t.id, levelId: t.levelId ?? s.levelId })}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData('application/x-guest')
                  if (id && !s.assignGuest(id, t.id)) toast(`${t.label} is full`)
                }}
                className={`relative overflow-hidden rounded-md border py-1.5 text-center ${s.selection.includes(t.id) ? 'border-accent ring-2 ring-accent/30' : 'border-bg-2'}`}>
                <div className="absolute inset-x-0 bottom-0 opacity-20" style={{ height: `${pct * 100}%`, background: tc }} />
                <div className="relative text-sm font-semibold" style={{ color: tc }}>{t.number}</div>
                <div className="relative font-mono text-[10px] text-muted">{u}/{t.seats}</div>
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {plan.tags.map((t) => (
            <span key={t.id} className="flex items-center gap-1 text-[11px] text-muted"><span className="h-2 w-2 rounded-full" style={{ background: t.color }} />{t.name}</span>
          ))}
        </div>
      </div>

      <div className="space-y-2 border-b border-bg-2 p-4">
        <div className="flex items-center justify-between">
          <div className="eyebrow">Guest list</div>
          {!viewOnly && (
            <div className="flex gap-1">
              <button className="btn h-7 pointer-coarse:h-10 px-2 text-xs" onClick={() => fileRef.current?.click()} title="Import CSV: name, company, group, email, dietary, table"><Upload size={13} />CSV</button>
              <button className="btn h-7 pointer-coarse:h-10 px-2 text-xs" onClick={() => download('guests-template.csv', CSV_TEMPLATE, 'text/csv')} title="Download CSV template"><Download size={13} />Template</button>
              <button className={`btn h-7 pointer-coarse:h-10 px-2 text-xs ${autoOpen ? 'btn-ghost-active' : ''}`} onClick={() => setAutoOpen(!autoOpen)} title="Auto-seat guests"><Wand2 size={13} />Auto</button>
            </div>
          )}
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = '' }} />
        </div>
        {autoOpen && !viewOnly && (
          <div className="space-y-2 rounded-lg bg-bg p-3 text-xs">
            <div className="font-semibold text-ink-2">Auto-seat</div>
            <label className="flex items-center gap-2">
              <input type="radio" name="fill-mode" className="accent-[#1ea7e8]" checked={mode === 'order'} onChange={() => setMode('order')} />
              Fill tables in order <span className="text-muted">(table 1 first)</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="fill-mode" className="accent-[#1ea7e8]" checked={mode === 'even'} onChange={() => setMode('even')} />
              Spread evenly across tables
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="accent-[#1ea7e8]" checked={reseatAll} onChange={(e) => setReseatAll(e.target.checked)} />
              Re-seat everyone <span className="text-muted">(replaces current seating)</span>
            </label>
            <p className="text-[11px] leading-snug text-muted">
              Keeps groups and companies together, seats tagged guests (VIP, Sponsor…) at tables with the same tag, and splits big groups across neighbouring tables.
            </p>
            <div className="flex justify-end gap-1">
              <button className="btn h-7 pointer-coarse:h-10 text-xs" onClick={() => setAutoOpen(false)}>Cancel</button>
              <button className="btn btn-primary h-7 pointer-coarse:h-10 text-xs" onClick={runAuto}><Wand2 size={13} />Seat guests</button>
            </div>
          </div>
        )}
        {!viewOnly && (
          <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; s.addGuests([{ name: name.trim(), company: company.trim() || undefined, tableId: null }]); setName(''); setCompany('') }}>
            <input className="input" placeholder="Guest name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="input w-28" placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
            <button className="btn btn-primary h-[30px] shrink-0 pointer-coarse:h-10 px-2" title="Add guest"><UserPlus size={15} /></button>
          </form>
        )}
        <div className="flex gap-1">
          <input className="input" placeholder="Search guests…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input w-32" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="all">All</option><option value="unassigned">Unseated</option><option value="assigned">Seated</option>
          </select>
        </div>
      </div>

      <ul className="panel-scroll flex-1 space-y-1 overflow-y-auto p-3">
        {guests.map((g) => (
          <li key={g.id} draggable={!viewOnly}
            onDragStart={(e) => e.dataTransfer.setData('application/x-guest', g.id)}
            className="group flex items-center gap-1.5 rounded-md border border-transparent px-1.5 py-1 hover:border-bg-2 hover:bg-bg">
            {!viewOnly && <GripVertical size={14} className="shrink-0 cursor-grab text-muted/50" />}
            <button title={g.checkedIn ? 'Undo check-in' : 'Check in'} aria-pressed={!!g.checkedIn} onClick={() => checkIn(g.id, !g.checkedIn)} disabled={!canCheckIn}>
              {g.checkedIn ? <CheckCircle2 size={15} className="text-green-600" /> : <Circle size={15} className="text-muted/50" />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{g.name}</div>
              {(g.company || g.group) && <div className="truncate text-[11px] text-muted">{[g.company, g.group].filter(Boolean).join(' · ')}</div>}
            </div>
            <select className="input h-7 pointer-coarse:h-10 w-[76px] px-1 text-xs" title="Guest tag (auto-seat matches it to table tags)" disabled={viewOnly}
              value={g.tag ?? 'general'} style={{ color: tagById.get(g.tag ?? 'general')?.color }}
              onChange={(e) => s.updateGuest(g.id, { tag: e.target.value === 'general' ? undefined : e.target.value })}>
              {plan.tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select className="input h-7 pointer-coarse:h-10 w-20 px-1 text-xs" disabled={viewOnly} value={g.tableId ?? ''}
              onChange={(e) => { if (!s.assignGuest(g.id, e.target.value || null)) toast('That table is full') }}>
              <option value="">-</option>
              {tables.map((t) => <option key={t.id} value={t.id}>Table {t.number}</option>)}
            </select>
            {!viewOnly && <button onClick={() => s.removeGuest(g.id)} className="text-muted opacity-0 hover:text-red-600 group-hover:opacity-100 pointer-coarse:opacity-100"><Trash2 size={14} /></button>}
          </li>
        ))}
        {!guests.length && (
          <li className="p-4 text-center text-xs text-muted">
            {plan.guests.length ? 'No guests match.' : 'Add guests above or import a .csv. Then drag a guest onto a table on the plan.'}
          </li>
        )}
      </ul>
      {plan.guests.length > 0 && (
        <div className="border-t border-bg-2 p-2 text-right">
          <button className="btn h-7 pointer-coarse:h-10 text-xs" onClick={() => download('guests-seating.csv', guestsToCsv(plan), 'text/csv')}><Download size={13} />Export seating .csv</button>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className="font-mono text-lg font-semibold text-ink">{value}</div>
    </div>
  )
}

const toast = (msg: string) => window.dispatchEvent(new CustomEvent('fp:toast', { detail: msg }))
