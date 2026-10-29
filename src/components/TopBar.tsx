import { useState } from 'react'
import {
  Undo2, Redo2, ZoomIn, ZoomOut, Maximize, MousePointer2, Ruler, Grid3x3, Magnet, Image as ImageIcon,
  TriangleAlert, Tag, Share2, FileDown, Eye, Pencil,
} from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'
import { canvasRef, requestFit } from './FloorCanvas'
import { exportPdf, renderPlanPng } from '../lib/exportPlan'
import { download, guestsToCsv } from '../lib/csv'
import { ShareDialog } from './ShareDialog'

function Toggle({ on, onClick, title, children }: { on: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return <button title={title} onClick={onClick} className={`btn px-2 ${on ? 'btn-ghost-active' : ''}`}>{children}</button>
}

export function TopBar() {
  const s = usePlanStore()
  const [menu, setMenu] = useState(false)
  const [share, setShare] = useState(false)
  const [busy, setBusy] = useState(false)

  const zoomBy = (f: number) => {
    const el = canvasRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const nz = Math.min(200, Math.max(3, s.zoom * f))
    s.set({ zoom: nz, pan: { x: width / 2 - ((width / 2 - s.pan.x) / s.zoom) * nz, y: height / 2 - ((height / 2 - s.pan.y) / s.zoom) * nz } })
  }

  const run = async (fn: () => Promise<void> | void) => {
    setMenu(false); setBusy(true)
    try { await fn() } catch (e) { console.error(e); window.dispatchEvent(new CustomEvent('fp:toast', { detail: 'Export failed, see console' })) }
    setBusy(false)
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-bg-2 bg-white px-3">
      <img src="/brand/logo-inbest.png" alt="iNBest" className="h-6" />
      <div className="mx-2 h-6 w-px bg-bg-2" />
      <div className="min-w-0">
        <input value={s.plan.name} disabled={s.viewOnly}
          onChange={(e) => s.mutate((p) => ({ ...p, name: e.target.value }), false)}
          className="block w-60 truncate bg-transparent text-sm font-semibold text-ink outline-none" />
        <div className="truncate text-[11px] text-muted">{s.plan.venue}{s.plan.date ? ` · ${s.plan.date}` : ''}</div>
      </div>

      {!s.viewOnly && (
        <div className="ml-4 flex items-center gap-1">
          <Toggle title="Select / move (V)" on={s.tool === 'select'} onClick={() => s.set({ tool: 'select', measure: null })}><MousePointer2 size={16} /></Toggle>
          <Toggle title="Measure distance (M)" on={s.tool === 'measure'} onClick={() => s.set({ tool: 'measure', placing: null })}><Ruler size={16} /></Toggle>
          <div className="mx-1 h-6 w-px bg-bg-2" />
          <button className="btn px-2" title="Undo (Ctrl+Z)" disabled={!s.past.length} onClick={s.undo}><Undo2 size={16} /></button>
          <button className="btn px-2" title="Redo (Ctrl+Shift+Z)" disabled={!s.future.length} onClick={s.redo}><Redo2 size={16} /></button>
        </div>
      )}

      <div className="ml-2 flex items-center gap-1">
        <div className="mx-1 h-6 w-px bg-bg-2" />
        <button className="btn px-2" onClick={() => zoomBy(1 / 1.25)} title="Zoom out"><ZoomOut size={16} /></button>
        <span className="w-16 whitespace-nowrap text-center font-mono text-[11px] text-muted">{Math.round(s.zoom)} px/m</span>
        <button className="btn px-2" onClick={() => zoomBy(1.25)} title="Zoom in"><ZoomIn size={16} /></button>
        <button className="btn px-2" onClick={requestFit} title="Fit venue (F)"><Maximize size={16} /></button>
        <div className="mx-1 h-6 w-px bg-bg-2" />
        <Toggle title="Grid (1 m / 5 m)" on={s.showGrid} onClick={() => s.set({ showGrid: !s.showGrid })}><Grid3x3 size={16} /></Toggle>
        {!s.viewOnly && <Toggle title="Snap to 0.25 m" on={s.snapOn} onClick={() => s.set({ snapOn: !s.snapOn })}><Magnet size={16} /></Toggle>}
        <Toggle title="Venue basemap" on={s.showBasemap} onClick={() => s.set({ showBasemap: !s.showBasemap })}><ImageIcon size={16} /></Toggle>
        <Toggle title="Aisle clearance check" on={s.showClearance} onClick={() => s.set({ showClearance: !s.showClearance })}><TriangleAlert size={16} /></Toggle>
        <Toggle title="Labels" on={s.showLabels} onClick={() => s.set({ showLabels: !s.showLabels })}><Tag size={16} /></Toggle>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {s.viewOnly ? (
          <span className="flex items-center gap-1 rounded-full bg-bg-2 px-3 py-1 text-xs text-ink-2"><Eye size={14} /> View-only link</span>
        ) : (
          <span className="hidden items-center gap-1 text-[11px] text-muted xl:flex"><Pencil size={12} /> Autosaved</span>
        )}
        <button className="btn" onClick={() => setShare(true)}><Share2 size={16} /> Share</button>
        <div className="relative">
          <button className="btn btn-primary" disabled={busy} onClick={() => setMenu(!menu)}>
            <FileDown size={16} /> {busy ? 'Exporting…' : 'Export'}
          </button>
          {menu && (
            <div className="absolute right-0 top-10 z-30 w-60 rounded-lg border border-bg-2 bg-white p-1 text-sm shadow-lg">
              <MenuItem onClick={() => run(() => exportPdf(canvasRef.current!, s.plan))}>PDF plan · A3 300 dpi</MenuItem>
              <MenuItem onClick={() => run(() => exportPdf(canvasRef.current!, s.plan, { grid: true, clearance: true }))}>PDF with grid + aisle checks</MenuItem>
              <MenuItem onClick={() => run(async () => {
                const { dataUrl } = await renderPlanPng(canvasRef.current!, s.plan, 6000, { grid: false, clearance: false })
                const a = document.createElement('a'); a.href = dataUrl; a.download = 'floorplan.png'; a.click()
              })}>PNG image · 6000 px</MenuItem>
              <MenuItem onClick={() => run(() => download('guests-seating.csv', guestsToCsv(s.plan), 'text/csv'))}>Seating list (.csv)</MenuItem>
              <MenuItem onClick={() => run(() => download('floorplan.json', JSON.stringify(s.plan, null, 2), 'application/json'))}>Project file (.json)</MenuItem>
            </div>
          )}
        </div>
      </div>
      {share && <ShareDialog onClose={() => setShare(false)} />}
    </header>
  )
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="block w-full rounded-md px-3 py-2 text-left hover:bg-bg">{children}</button>
}
