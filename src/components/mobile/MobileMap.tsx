import { useMemo, useState } from 'react'
import { Search, X, Plus, Minus, Maximize, Satellite, CheckCircle2 } from 'lucide-react'
import { usePlanStore } from '../../store/usePlanStore'
import { FloorCanvas } from '../FloorCanvas'
import { CATALOG, LAYERS, isTableKind } from '../../lib/catalog'
import { canvasRef, requestFit, requestFocus } from '../../lib/canvas'
import type { PlanElement } from '../../types'

interface Result { key: string; label: string; sub: string; table?: PlanElement; guestId: string | null }

/** Phone map: the plan read-only, a guest/table search, zoom controls and a details sheet for the tapped object. */
export function MobileMap() {
  const s = usePlanStore()
  const { plan } = s
  const [q, setQ] = useState('')
  const [foundGuest, setFoundGuest] = useState<string | null>(null)
  const selected = plan.elements.find((e) => e.id === s.selection[0])

  const results = useMemo<Result[]>(() => {
    const k = q.trim().toLowerCase()
    if (!k) return []
    const used = (id: string) => plan.guests.filter((g) => g.tableId === id).length
    const tables = plan.elements
      .filter((e) => isTableKind(e.kind) && (e.label.toLowerCase().includes(k) || String(e.number) === k))
      .slice(0, 4)
      .map((e) => ({ key: e.id, label: e.label, sub: `${used(e.id)}/${e.seats ?? 0} seated`, table: e, guestId: null }))
    const guests = plan.guests
      .filter((g) => `${g.name} ${g.company ?? ''}`.toLowerCase().includes(k))
      .slice(0, 6)
      .map((g) => {
        const t = plan.elements.find((e) => e.id === g.tableId)
        return { key: g.id, label: g.name, sub: t ? [t.label, g.company].filter(Boolean).join(' · ') : 'No table yet', table: t, guestId: g.id }
      })
    return [...tables, ...guests]
  }, [q, plan.elements, plan.guests])

  const show = (r: Result) => {
    setQ('')
    setFoundGuest(r.guestId)
    if (!r.table) { toast(`${r.label} has no table yet`); return }
    s.set({ selection: [r.table.id], highlightTable: r.table.id })
    requestFocus({ x: r.table.x, y: r.table.y, zoom: 28 })
  }

  const zoomBy = (f: number) => {
    const el = canvasRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const nz = Math.min(200, Math.max(3, s.zoom * f))
    s.set({ zoom: nz, pan: { x: width / 2 - ((width / 2 - s.pan.x) / s.zoom) * nz, y: height / 2 - ((height / 2 - s.pan.y) / s.zoom) * nz } })
  }

  const satelliteOn = !!plan.geo && s.showSatellite

  return (
    <div className="absolute inset-0">
      <FloorCanvas review />

      <div className="absolute inset-x-3 top-3 z-10">
        <label className="flex h-11 items-center gap-2 rounded-xl border border-bg-2 bg-white px-3 shadow-sm">
          <Search size={17} className="shrink-0 text-muted" />
          <input className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={plan.guests.length ? 'Find a guest or table' : 'Find a table'} enterKeyHint="search" />
          {q && <button aria-label="Clear search" onClick={() => setQ('')} className="-mr-2 grid h-10 w-10 place-items-center text-muted"><X size={17} /></button>}
        </label>
        {q.trim() && (
          <ul className="mt-1 max-h-72 overflow-y-auto rounded-xl border border-bg-2 bg-white shadow-lg">
            {results.map((r) => (
              <li key={r.key}>
                <button className="flex min-h-12 w-full flex-col justify-center px-4 py-2 text-left active:bg-bg" onClick={() => show(r)}>
                  <span className="text-[15px] text-ink">{r.label}</span>
                  <span className="text-xs text-muted">{r.sub}</span>
                </button>
              </li>
            ))}
            {!results.length && <li className="px-4 py-3 text-sm text-muted">No guests or tables match.</li>}
          </ul>
        )}
      </div>

      <div className={`absolute right-3 z-10 flex flex-col gap-2 ${satelliteOn ? 'top-[7.25rem]' : 'top-16'}`}>
        <MapButton label="Zoom in" onClick={() => zoomBy(1.4)}><Plus size={19} /></MapButton>
        <MapButton label="Zoom out" onClick={() => zoomBy(1 / 1.4)}><Minus size={19} /></MapButton>
        <MapButton label="Fit venue" onClick={requestFit}><Maximize size={17} /></MapButton>
        {plan.geo && (
          <MapButton label={s.showSatellite ? 'Hide satellite' : 'Show satellite'} active={s.showSatellite}
            onClick={() => s.set({ showSatellite: !s.showSatellite })}><Satellite size={18} /></MapButton>
        )}
      </div>

      {selected && <DetailsSheet e={selected} foundGuest={foundGuest} onClose={() => { setFoundGuest(null); s.set({ selection: [], highlightTable: null }) }} />}
    </div>
  )
}

function MapButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button aria-label={label} title={label} onClick={onClick}
      className={`grid h-11 w-11 place-items-center rounded-xl border shadow-sm ${active ? 'border-ink bg-ink text-on-ink' : 'border-bg-2 bg-white text-ink-2 active:bg-bg'}`}>
      {children}
    </button>
  )
}

/** Bottom sheet for the tapped object: who sits at a table, or what an object is. */
function DetailsSheet({ e, foundGuest, onClose }: { e: PlanElement; foundGuest: string | null; onClose: () => void }) {
  const plan = usePlanStore((s) => s.plan)
  const viewOnly = usePlanStore((s) => s.viewOnly)
  const isTable = isTableKind(e.kind)
  const tag = isTable ? plan.tags.find((t) => t.id === e.tag) : undefined
  const guests = isTable ? plan.guests.filter((g) => g.tableId === e.id) : []
  const kind = CATALOG[e.kind]?.name ?? e.kind
  const layer = LAYERS.find((l) => l.id === e.layer)?.name

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 max-h-[45%] overflow-y-auto rounded-t-2xl border-t border-bg-2 bg-white px-4 pb-4 pt-2 shadow-[0_-8px_24px_rgba(10,23,41,0.12)]">
      <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-bg-2" />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[17px] font-semibold text-ink">{e.label}</h2>
            {tag && <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium text-white" style={{ background: tag.color }}>{tag.name}</span>}
          </div>
          <div className="text-[13px] text-muted">{isTable ? `${guests.length}/${e.seats ?? 0} seated` : [kind, layer].filter(Boolean).join(' · ')}</div>
        </div>
        <button aria-label="Close details" onClick={onClose} className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted active:bg-bg"><X size={19} /></button>
      </div>

      {isTable && (guests.length > 0 ? (
        <ul className="mt-1 divide-y divide-bg-2">
          {guests.map((g) => (
            <li key={g.id} className={`flex min-h-11 items-center gap-2 py-2 ${g.id === foundGuest ? 'text-accent-deep' : 'text-ink'}`}>
              <span className={`min-w-0 flex-1 truncate text-[15px] ${g.id === foundGuest ? 'font-semibold' : ''}`}>{g.name}</span>
              {g.company && <span className="max-w-[40%] truncate text-xs text-muted">{g.company}</span>}
              {g.checkedIn && <CheckCircle2 size={16} className="shrink-0 text-green-600" aria-label="Checked in" />}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">{viewOnly && !plan.guests.length ? 'Guest names aren’t included in this link.' : 'No guests at this table yet.'}</p>
      ))}

      {!isTable && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Size</dt>
          <dd className="font-mono text-ink">{e.w.toFixed(2)} × {e.h.toFixed(2)} m</dd>
        </dl>
      )}
      {e.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-ink"><span className="text-muted">Notes · </span>{e.notes}</p>}
    </div>
  )
}

const toast = (msg: string) => window.dispatchEvent(new CustomEvent('fp:toast', { detail: msg }))
