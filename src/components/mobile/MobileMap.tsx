import { useMemo, useState } from 'react'
import { Search, X, Plus, Minus, Maximize, Satellite } from 'lucide-react'
import { usePlanStore } from '../../store/usePlanStore'
import { FloorCanvas } from '../FloorCanvas'
import { isTableKind } from '../../lib/catalog'
import { canvasRef, requestFit, requestFocus } from '../../lib/canvas'
import type { PlanElement } from '../../types'
import { ObjectSheet } from './Sheets'

interface Result { key: string; label: string; sub: string; table?: PlanElement; guestId: string | null }

/**
 * Phone map: the plan read-only, a guest/table search, zoom controls and a details sheet for the tapped object.
 * `foundGuest` is highlighted in the table sheet (from this search or "Show on map" in the Guests tab).
 */
export function MobileMap({ foundGuest, setFoundGuest }: { foundGuest: string | null; setFoundGuest: (id: string | null) => void }) {
  const s = usePlanStore()
  const { plan } = s
  const [q, setQ] = useState('')
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

      {selected && <ObjectSheet e={selected} foundGuest={foundGuest} onClose={() => { setFoundGuest(null); s.set({ selection: [], highlightTable: null }) }} />}
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

const toast = (msg: string) => window.dispatchEvent(new CustomEvent('fp:toast', { detail: msg }))
