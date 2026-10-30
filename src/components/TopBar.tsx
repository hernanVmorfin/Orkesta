import { useState } from 'react'
import {
  Undo2, Redo2, ZoomIn, ZoomOut, Maximize, MousePointer2, Ruler, Grid3x3, Magnet, Image as ImageIcon,
  TriangleAlert, Tag, Share2, FileDown, Eye, Pencil, CloudOff, Satellite, SlidersHorizontal, Shapes, PanelRight, Check, Cloud,
  MessageSquare, MessagesSquare,
} from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'
import { useIsWide } from '../lib/useMediaQuery'
import { canvasRef, requestFit } from '../lib/canvas'
import { download, guestsToCsv } from '../lib/csv'
import { inventoryCsv } from '../lib/inventoryCsv'
import { ShareDialog } from './ShareDialog'
import { EventsMenu } from './EventsMenu'
import { LevelMenu } from './LevelMenu'
import { AccountMenu } from './team/AccountMenu'

// jsPDF and html2canvas are large; load them only when an export runs
const exporter = () => import('../lib/exportPlan')

const SAVE_LABEL = { saved: 'Autosaved', saving: 'Saving…', error: 'Not saved' }
const SYNC_LABEL = { idle: 'Autosaved', syncing: 'Saving for the team…', synced: 'Saved for the team', error: 'Not sent to the team' }

function Toggle({ on, onClick, title, children }: { on: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return <button title={title} onClick={onClick} className={`btn px-2 ${on ? 'btn-ghost-active' : ''}`}>{children}</button>
}

export function TopBar() {
  const s = usePlanStore()
  const wide = useIsWide()
  const [menu, setMenu] = useState(false)
  const [viewMenu, setViewMenu] = useState(false)
  const [share, setShare] = useState(false)
  const [busy, setBusy] = useState(false)

  // Inline on wide screens, folded into a "View" menu below 1280 px
  const viewToggles = [
    { title: 'Grid (1 m / 5 m)', icon: Grid3x3, on: s.showGrid, toggle: () => s.set({ showGrid: !s.showGrid }) },
    ...(!s.viewOnly ? [{ title: 'Snap to 0.25 m', icon: Magnet, on: s.snapOn, toggle: () => s.set({ snapOn: !s.snapOn }) }] : []),
    ...(s.plan.geo ? [{ title: 'Satellite view', icon: Satellite, on: s.showSatellite, toggle: () => s.set({ showSatellite: !s.showSatellite }) }] : []),
    { title: 'Venue basemap', icon: ImageIcon, on: s.showBasemap, toggle: () => s.set({ showBasemap: !s.showBasemap }) },
    { title: 'Aisle clearance check', icon: TriangleAlert, on: s.showClearance, toggle: () => s.set({ showClearance: !s.showClearance }) },
    { title: 'Labels', icon: Tag, on: s.showLabels, toggle: () => s.set({ showLabels: !s.showLabels }) },
    ...(s.plan.comments?.length ? [{ title: 'Comments', icon: MessagesSquare, on: s.showComments, toggle: () => s.set({ showComments: !s.showComments }) }] : []),
  ]

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
      <div className="mx-2 hidden h-6 w-px bg-bg-2 lg:block" />
      <div className="min-w-0">
        <input value={s.plan.name} disabled={s.viewOnly}
          onChange={(e) => s.mutate((p) => ({ ...p, name: e.target.value }), false)}
          className="block w-32 truncate bg-transparent text-sm font-semibold text-ink outline-none lg:w-48 xl:w-60" />
        <div className="truncate text-[11px] text-muted">{s.plan.venue}{s.plan.date ? ` · ${s.plan.date}` : ''}</div>
      </div>
      {!s.linkViewOnly && <EventsMenu />}
      <LevelMenu />

      {!s.viewOnly && (
        <div className="ml-1 flex items-center gap-1 xl:ml-4">
          {!wide && <Toggle title="Objects" on={s.showLibrary} onClick={() => s.set({ showLibrary: !s.showLibrary })}><Shapes size={16} /></Toggle>}
          <Toggle title="Select / move (V)" on={s.tool === 'select'} onClick={() => s.set({ tool: 'select', measure: null })}><MousePointer2 size={16} /></Toggle>
          <Toggle title="Measure distance (M)" on={s.tool === 'measure'} onClick={() => s.set({ tool: 'measure', placing: null })}><Ruler size={16} /></Toggle>
          <Toggle title="Comment (C)" on={s.tool === 'comment'} onClick={() => s.set({ tool: s.tool === 'comment' ? 'select' : 'comment', placing: null, measure: null, showComments: true })}><MessageSquare size={16} /></Toggle>
          <div className="mx-1 h-6 w-px bg-bg-2" />
          <button className="btn px-2" title="Undo (Ctrl+Z)" disabled={!s.past.length} onClick={s.undo}><Undo2 size={16} /></button>
          <button className="btn px-2" title="Redo (Ctrl+Shift+Z)" disabled={!s.future.length} onClick={s.redo}><Redo2 size={16} /></button>
        </div>
      )}

      <div className="ml-1 flex items-center gap-1 xl:ml-2">
        <div className="mx-1 h-6 w-px bg-bg-2" />
        <button className="btn hidden px-2 lg:inline-flex" onClick={() => zoomBy(1 / 1.25)} title="Zoom out"><ZoomOut size={16} /></button>
        <span className="hidden w-16 whitespace-nowrap text-center font-mono text-[11px] text-muted xl:block">{Math.round(s.zoom)} px/m</span>
        <button className="btn hidden px-2 lg:inline-flex" onClick={() => zoomBy(1.25)} title="Zoom in"><ZoomIn size={16} /></button>
        <button className="btn px-2" onClick={requestFit} title="Fit venue (F)"><Maximize size={16} /></button>
        <div className="mx-1 h-6 w-px bg-bg-2" />
        {wide ? viewToggles.map(({ title, icon: Icon, on, toggle }) => (
          <Toggle key={title} title={title} on={on} onClick={toggle}><Icon size={16} /></Toggle>
        )) : (
          <div className="relative">
            <Toggle title="View options" on={viewMenu} onClick={() => setViewMenu(!viewMenu)}><SlidersHorizontal size={16} /></Toggle>
            {viewMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setViewMenu(false)} />
                <div className="absolute right-0 top-10 z-30 w-60 rounded-lg border border-bg-2 bg-white p-1 text-sm shadow-lg">
                  {viewToggles.map(({ title, icon: Icon, on, toggle }) => (
                    <button key={title} onClick={toggle} aria-pressed={on} className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-bg">
                      <Icon size={16} className="text-muted" /><span className="flex-1">{title}</span>{on && <Check size={16} className="text-accent-deep" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {s.viewOnly ? (
          <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-bg-2 px-3 py-1 text-xs text-ink-2"
            title={s.role === 'staff' ? 'You can check guests in. Only the event’s admins can change the plan.' : undefined}>
            <Eye size={14} /> {s.linkViewOnly ? 'View-only link' : s.role === 'staff' ? 'Staff view' : !s.account ? 'Sign in to edit' : 'View only'}
          </span>
        ) : s.plan.shared && s.syncState === 'error' ? (
          <span className="flex items-center gap-1 text-[11px] font-medium text-red-600"
            title="Your changes are saved on this device and will be sent to the team when the connection is back.">
            <CloudOff size={12} /> {SYNC_LABEL.error}
          </span>
        ) : s.plan.shared && s.saveState !== 'error' ? (
          <span className="hidden items-center gap-1 text-[11px] text-muted xl:flex"><Cloud size={12} /> {SYNC_LABEL[s.syncState]}</span>
        ) : s.saveState === 'error' ? (
          <span className="flex items-center gap-1 text-[11px] font-medium text-red-600"
            title="This browser blocked saving. Export a project file (.json) to keep your work.">
            <CloudOff size={12} /> {SAVE_LABEL.error}
          </span>
        ) : (
          <span className="hidden items-center gap-1 text-[11px] text-muted xl:flex"><Pencil size={12} /> {SAVE_LABEL[s.saveState]}</span>
        )}
        {/* Shared events are passed on by their admins */}
        {(!s.plan.shared || s.role === 'admin' || s.linkViewOnly) && (
          <button className="btn" onClick={() => setShare(true)} title="Share a link"><Share2 size={16} /><span className="hidden lg:inline">Share</span></button>
        )}
        <div className="relative">
          <button className="btn btn-primary" disabled={busy} onClick={() => setMenu(!menu)} title="Export">
            <FileDown size={16} /><span className="hidden lg:inline">{busy ? 'Exporting…' : 'Export'}</span>
          </button>
          {menu && (
            <div className="absolute right-0 top-10 z-30 w-60 rounded-lg border border-bg-2 bg-white p-1 text-sm shadow-lg">
              <MenuItem onClick={() => run(async () => (await exporter()).exportPdf(canvasRef.current!, s.plan, { grid: false, clearance: false, levelId: s.levelId }))}>PDF plan · A3 300 dpi</MenuItem>
              <MenuItem onClick={() => run(async () => (await exporter()).exportPdf(canvasRef.current!, s.plan, { grid: true, clearance: true, levelId: s.levelId }))}>PDF with grid + aisle checks</MenuItem>
              <MenuItem onClick={() => run(async () => {
                const { dataUrl } = await (await exporter()).renderPlanPng(canvasRef.current!, s.plan, 6000, { grid: false, clearance: false, levelId: s.levelId })
                const a = document.createElement('a'); a.href = dataUrl; a.download = 'floorplan.png'; a.click()
              })}>PNG image · 6000 px</MenuItem>
              <MenuItem onClick={() => { setMenu(false); s.set({ dialog: 'export' }) }}>Vendor / layer export…</MenuItem>
              <div className="my-1 h-px bg-bg-2" />
              <MenuItem onClick={() => run(() => download('guests-seating.csv', guestsToCsv(s.plan), 'text/csv'))}>Seating list (.csv)</MenuItem>
              <MenuItem onClick={() => run(() => download('inventory.csv', inventoryCsv(s.plan, 'objects'), 'text/csv'))}>Inventory (.csv)</MenuItem>
              <MenuItem onClick={() => run(() => download('floorplan.json', JSON.stringify(s.plan, null, 2), 'application/json'))}>Project file (.json)</MenuItem>
            </div>
          )}
        </div>
        {!wide && <Toggle title="Panel" on={s.showPanel} onClick={() => s.set({ showPanel: !s.showPanel })}><PanelRight size={16} /></Toggle>}
        {!s.linkViewOnly && <AccountMenu />}
      </div>
      {share && <ShareDialog onClose={() => setShare(false)} />}
    </header>
  )
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="block w-full rounded-md px-3 py-2 text-left hover:bg-bg">{children}</button>
}
