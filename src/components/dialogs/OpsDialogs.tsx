import { useMemo, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import { usePlanStore } from '../../store/usePlanStore'
import { clashes, scheduleItems, vendorsOf } from '../../lib/ops'
import { canvasRef, requestFocus } from '../../lib/canvas'
import { LAYERS } from '../../lib/catalog'
import { download } from '../../lib/csv'
import { inventoryCsv } from '../../lib/inventoryCsv'
import { toast } from '../../lib/toast'
import type { LayerId } from '../../types'
import { Modal } from './Modal'

const fmt = (t: number) => new Date(t).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Gantt of load-in/out times per vendor, with clashes (different vendors, same zone, same time) in red. */
export function ScheduleDialog({ onClose }: { onClose: () => void }) {
  const s = usePlanStore()
  const items = useMemo(() => scheduleItems(s.plan).sort((a, b) => a.start - b.start), [s.plan])
  const cl = useMemo(() => clashes(items), [items])
  const clashIds = new Set(cl.flatMap((c) => [c.a.e.id, c.b.e.id]))
  if (!items.length) return null
  const t0 = Math.min(...items.map((i) => i.start)), t1 = Math.max(...items.map((i) => i.end))
  const span = Math.max(3600_000, t1 - t0)
  const pct = (t: number) => ((t - t0) / span) * 100
  const vendors = [...new Set(items.map((i) => i.vendor))]
  // Hour ticks, at most ~12 across
  const step = [1, 2, 3, 6, 12, 24].map((h) => h * 3600_000).find((h) => span / h <= 12) ?? 86400_000
  const ticks: number[] = []
  for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) ticks.push(t)
  const show = (id: string) => {
    const e = s.plan.elements.find((x) => x.id === id)!
    s.set({ levelId: e.levelId ?? null, selection: [id], rightTab: 'inspect', dialog: null })
    requestAnimationFrame(() => requestFocus({ x: e.x, y: e.y, zoom: 20 }))
  }

  return (
    <Modal title="Load-in schedule" eyebrow={`${items.length} objects · ${vendors.length} vendors`} onClose={onClose} wide>
      <div className="relative mb-2 ml-40 h-5 text-[10px] text-muted">
        {ticks.map((t) => <span key={t} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pct(t)}%` }}>{new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>)}
      </div>
      <div className="space-y-3">
        {vendors.map((v) => (
          <div key={v}>
            <div className="mb-1 text-xs font-semibold text-ink-2">{v}</div>
            {items.filter((i) => i.vendor === v).map((i) => (
              <div key={i.e.id} className="flex items-center gap-2">
                <button className="w-38 shrink-0 truncate text-left text-xs text-ink-2 hover:text-accent-deep" title={i.e.label} onClick={() => show(i.e.id)}>
                  {i.e.label}{i.zone ? <span className="text-muted"> · {i.zone}</span> : ''}
                </button>
                <div className="relative h-5 flex-1 rounded bg-bg">
                  {ticks.map((t) => <div key={t} className="absolute inset-y-0 w-px bg-bg-2" style={{ left: `${pct(t)}%` }} />)}
                  <button title={`${fmt(i.start)} → ${fmt(i.end)}`} onClick={() => show(i.e.id)}
                    className={`absolute inset-y-0.5 rounded ${clashIds.has(i.e.id) ? 'bg-red-500 ring-2 ring-red-300' : 'bg-accent'}`}
                    style={{ left: `${pct(i.start)}%`, width: `${Math.max(0.8, pct(i.end) - pct(i.start))}%` }} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">{fmt(t0)} → {fmt(t1)}</p>
      {cl.length > 0 && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <div className="mb-1 flex items-center gap-1 font-semibold"><TriangleAlert size={15} />{cl.length} clash{cl.length > 1 ? 'es' : ''}: different vendors in the same zone at the same time</div>
          <ul className="space-y-0.5 text-xs">
            {cl.map((c, k) => (
              <li key={k}>
                <b>{c.a.zone}</b>: <button className="hover:underline" onClick={() => show(c.a.e.id)}>{c.a.vendor} · {c.a.e.label}</button>{' and '}
                <button className="hover:underline" onClick={() => show(c.b.e.id)}>{c.b.vendor} · {c.b.e.label}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}

/** Exports only one vendor's objects and/or chosen layers: PDF, PNG or the inventory. */
export function FilteredExportDialog({ onClose }: { onClose: () => void }) {
  const s = usePlanStore()
  const vendors = vendorsOf(s.plan)
  const [vendor, setVendor] = useState('')
  const [layers, setLayers] = useState<Set<LayerId>>(new Set(LAYERS.map((l) => l.id)))
  const [busy, setBusy] = useState(false)
  const only = (e: { layer: LayerId; setup?: { vendor?: string } }) => layers.has(e.layer) && (!vendor || e.setup?.vendor?.trim() === vendor)
  const ids = new Set(s.plan.elements.filter(only).map((e) => (e as { id: string }).id))
  const subtitle = [vendor && `Vendor: ${vendor}`, layers.size < LAYERS.length && `Layers: ${LAYERS.filter((l) => layers.has(l.id)).map((l) => l.name).join(', ')}`].filter(Boolean).join(' · ')
  const name = `${s.plan.name}${vendor ? ` - ${vendor}` : ''}`.replace(/\W+/g, '-')

  const run = async (kind: 'pdf' | 'png' | 'csv') => {
    setBusy(true)
    try {
      if (kind === 'csv') download(`${name}-inventory.csv`, inventoryCsv(s.plan, 'objects', (e) => ids.has(e.id)), 'text/csv')
      else {
        const ex = await import('../../lib/exportPlan')
        const opts = { grid: false, clearance: false, only: ids, levelId: s.levelId, subtitle }
        if (kind === 'pdf') await ex.exportPdf(canvasRef.current!, s.plan, opts)
        else {
          const { dataUrl } = await ex.renderPlanPng(canvasRef.current!, s.plan, 6000, opts)
          const a = document.createElement('a'); a.href = dataUrl; a.download = `${name}.png`; a.click()
        }
      }
      onClose()
    } catch (e) {
      console.error(e)
      toast('Export failed, see console')
    }
    setBusy(false)
  }

  return (
    <Modal title="Vendor & layer export" eyebrow="Export" onClose={onClose}>
      <label className="block"><span className="text-[11px] text-muted">Vendor</span>
        <select className="input" value={vendor} onChange={(e) => setVendor(e.target.value)}>
          <option value="">All vendors</option>
          {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      {!vendors.length && <p className="mt-1 text-[11px] text-muted">Set vendors on objects (Inspector, Vendor & logistics) to export per vendor.</p>}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
          <span>Layers</span>
          <span className="space-x-2">
            <button className="hover:text-ink" onClick={() => setLayers(new Set(LAYERS.map((l) => l.id)))}>All</button>
            <button className="hover:text-ink" onClick={() => setLayers(new Set())}>None</button>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {LAYERS.map((l) => (
            <label key={l.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[#1ea7e8]" checked={layers.has(l.id)}
                onChange={(e) => setLayers((cur) => { const n = new Set(cur); if (e.target.checked) n.add(l.id); else n.delete(l.id); return n })} />
              {l.name}
            </label>
          ))}
        </div>
      </div>
      <p className="mt-3 rounded-lg bg-bg p-3 text-sm"><b>{ids.size}</b> object{ids.size === 1 ? '' : 's'} on this plan match. The plan export shows the level you're viewing.</p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button className="btn border border-bg-2" disabled={busy || !ids.size} onClick={() => run('csv')}>Inventory (.csv)</button>
        <button className="btn border border-bg-2" disabled={busy || !ids.size} onClick={() => run('png')}>PNG</button>
        <button className="btn btn-primary" disabled={busy || !ids.size} onClick={() => run('pdf')}>{busy ? 'Exporting…' : 'PDF'}</button>
      </div>
    </Modal>
  )
}
