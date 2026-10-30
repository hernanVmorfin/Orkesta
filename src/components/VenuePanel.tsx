import { useRef, useState } from 'react'
import { Upload, Plus, FileUp, Ruler, FileText } from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { usePlanStore } from '../store/usePlanStore'
import { dist } from '../lib/geometry'
import type { Plan } from '../types'
import { SatelliteSection } from './SatelliteSection'
import { activeLevel, levelsOf, setVenue, venueOf } from '../lib/levels'
import { toast } from '../lib/toast'
import { isPdf, readImageFile } from '../lib/drawing'

export function VenuePanel() {
  const s = usePlanStore()
  const { plan, viewOnly } = s
  const imgRef = useRef<HTMLInputElement>(null)
  const jsonRef = useRef<HTMLInputElement>(null)
  const [known, setKnown] = useState('6')
  // A PDF with several pages waits here until a page is picked
  const [pdf, setPdf] = useState<{ doc: PDFDocumentProxy; name: string; page: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [ratio, setRatio] = useState('')
  const up = (patch: Partial<Plan>) => s.mutate((p) => ({ ...p, ...patch }))
  // Footprint and drawing belong to the level on screen
  const venue = venueOf(plan, s.levelId)
  const upVenue = (patch: Parameters<typeof setVenue>[2], record = true) => s.mutate((p) => setVenue(p, s.levelId, patch), record)
  const multiLevel = levelsOf(plan).length > 1
  const bm = venue.basemap

  const onImage = async (f: File) => {
    try {
      const { src, aspect } = await readImageFile(f)
      upVenue({ basemap: { src, widthM: venue.widthM, aspect, x: 0, y: 0, opacity: 0.5 } })
      s.set({ showBasemap: true })
    } catch { toast('Couldn’t read that image') }
  }

  const importPdfPage = async (doc: PDFDocumentProxy, page: number) => {
    setBusy(true)
    try {
      const { renderPdfPage } = await import('../lib/pdfImport')
      const r = await renderPdfPage(doc, page)
      upVenue({ basemap: { src: r.src, widthM: venue.widthM, aspect: r.aspect, x: 0, y: 0, opacity: 0.5, pageWidthMm: r.pageWidthMm } })
      s.set({ showBasemap: true })
      setPdf(null)
      setRatio('')
      void doc.loadingTask.destroy()
    } catch (e) { console.error(e); toast('Couldn’t read that page of the PDF') }
    setBusy(false)
  }

  const onFile = async (f: File) => {
    if (!isPdf(f)) { await onImage(f); return }
    setBusy(true)
    try {
      const { openPdf } = await import('../lib/pdfImport')
      const doc = await openPdf(f)
      setBusy(false)
      if (doc.numPages > 1) setPdf({ doc, name: f.name, page: 1 })
      else await importPdfPage(doc, 1)
    } catch (e) {
      console.error(e)
      setBusy(false)
      toast((e as Error)?.name === 'PasswordException' ? 'That PDF is password-protected. Save an unlocked copy and try again.' : 'Couldn’t open that PDF')
    }
  }

  /** Sets the real size from the drawing's stated scale (1:100 → page width × 100). */
  const applyRatio = async () => {
    const k = parseFloat(ratio)
    if (!bm?.pageWidthMm || !(k > 0)) return
    const { widthAtScale } = await import('../lib/pdfImport')
    upVenue({ basemap: { ...bm, widthM: widthAtScale(bm.pageWidthMm, k) } })
  }

  /** Calibrate: the current measure line should equal `known` meters → rescale basemap around its origin. */
  const calibrate = () => {
    const m = s.measure
    const k = parseFloat(known)
    if (!m || !bm || !k) return
    const d = dist(m.a, m.b)
    if (d < 0.01) return
    const f = k / d
    upVenue({ basemap: { ...bm, widthM: +(bm.widthM * f).toFixed(3) } })
    s.set({ measure: null, tool: 'select' })
  }

  if (viewOnly)
    return <div className="p-4 text-sm"><div className="eyebrow">Venue</div><p>{plan.venue}</p><p className="text-muted">{venue.widthM} × {venue.heightM} m</p></div>

  return (
    <div className="space-y-5 p-4 text-sm">
      <section className="space-y-2">
        <div className="eyebrow">Event</div>
        <input className="input" value={plan.name} onChange={(e) => up({ name: e.target.value })} placeholder="Event name" />
        <input className="input" value={plan.venue} onChange={(e) => up({ venue: e.target.value })} placeholder="Venue" />
        <input className="input" type="date" value={plan.date} onChange={(e) => up({ date: e.target.value })} />
      </section>

      <section className="space-y-2">
        <div className="eyebrow">{multiLevel ? `Footprint · ${activeLevel(plan, s.levelId).name}` : 'Venue footprint & rules'}</div>
        <div className="grid grid-cols-3 gap-2">
          <label><span className="text-[11px] text-muted">Width m</span><input className="input font-mono" type="number" value={venue.widthM} onChange={(e) => upVenue({ widthM: Math.max(5, +e.target.value) })} /></label>
          <label><span className="text-[11px] text-muted">Depth m</span><input className="input font-mono" type="number" value={venue.heightM} onChange={(e) => upVenue({ heightM: Math.max(5, +e.target.value) })} /></label>
          <label><span className="text-[11px] text-muted">Min aisle m</span><input className="input font-mono" type="number" step={0.1} value={plan.minAisleM} onChange={(e) => up({ minAisleM: Math.max(0, +e.target.value) })} /></label>
        </div>
        <p className="text-[11px] text-muted">Aisle check measures chair-back to chair-back (table + 0.75 m chair zone). Confirm the minimum with local civil protection rules.</p>
        {multiLevel && <p className="text-[11px] text-muted">Each level can have its own footprint and drawing; switch levels from the menu next to the event name.</p>}
      </section>

      <section className="space-y-2">
        <div className="eyebrow">Cell references</div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="accent-[#1ea7e8]" checked={!!plan.gridRef?.show}
            onChange={(e) => up({ gridRef: { cellM: plan.gridRef?.cellM ?? 10, show: e.target.checked } })} />
          Show A1, B2… cells on the plan and in exports
        </label>
        {plan.gridRef?.show && (
          <label className="flex items-center gap-2 text-xs text-muted">Cell size
            <input type="number" min={1} step={1} className="input w-20 font-mono" value={plan.gridRef.cellM}
              onChange={(e) => up({ gridRef: { show: true, cellM: Math.max(1, +e.target.value || 10) } })} /> m
          </label>
        )}
      </section>

      <SatelliteSection />

      <section className="space-y-2">
        <div className="eyebrow">Basemap / blueprint</div>
        <button className="btn w-full justify-center border border-dashed border-accent/50" disabled={busy} onClick={() => imgRef.current?.click()}>
          <Upload size={15} />{busy ? 'Reading the drawing…' : 'Upload venue drawing (PDF or image)'}
        </button>
        <input ref={imgRef} type="file" accept="image/*,application/pdf,.pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = '' }} />
        {pdf && (
          <div className="space-y-2 rounded-lg border border-accent/40 bg-accent/5 p-3">
            <div className="flex items-center gap-1 font-semibold"><FileText size={14} /><span className="truncate">{pdf.name}</span></div>
            <p className="text-[11px] text-muted">This PDF has {pdf.doc.numPages} pages. Pick the floor plan.</p>
            <div className="flex gap-1">
              <select className="input" value={pdf.page} onChange={(e) => setPdf({ ...pdf, page: +e.target.value })}>
                {Array.from({ length: pdf.doc.numPages }, (_, i) => <option key={i} value={i + 1}>Page {i + 1}</option>)}
              </select>
              <button className="btn btn-primary shrink-0" disabled={busy} onClick={() => void importPdfPage(pdf.doc, pdf.page)}>{busy ? 'Reading…' : 'Use page'}</button>
              <button className="btn shrink-0" onClick={() => { void pdf.doc.loadingTask.destroy(); setPdf(null) }}>Cancel</button>
            </div>
          </div>
        )}
        {bm && (
          <>
            <label className="block"><span className="text-[11px] text-muted">Opacity {Math.round(bm.opacity * 100)}%</span>
              <input type="range" min={0} max={1} step={0.05} className="w-full accent-[#1ea7e8]" value={bm.opacity}
                onChange={(e) => upVenue({ basemap: { ...bm, opacity: +e.target.value } }, false)} /></label>
            <div className="grid grid-cols-3 gap-2">
              <label><span className="text-[11px] text-muted">Real width m</span><input className="input font-mono" type="number" step={0.1} value={bm.widthM} onChange={(e) => upVenue({ basemap: { ...bm, widthM: +e.target.value } })} /></label>
              <label><span className="text-[11px] text-muted">Offset X</span><input className="input font-mono" type="number" step={0.1} value={bm.x} onChange={(e) => upVenue({ basemap: { ...bm, x: +e.target.value } })} /></label>
              <label><span className="text-[11px] text-muted">Offset Y</span><input className="input font-mono" type="number" step={0.1} value={bm.y} onChange={(e) => upVenue({ basemap: { ...bm, y: +e.target.value } })} /></label>
            </div>
            {bm.pageWidthMm && (
              <div className="rounded-lg bg-bg p-3">
                <div className="mb-1 flex items-center gap-1 font-semibold"><FileText size={14} />Drawing scale</div>
                <p className="mb-2 text-[11px] text-muted">
                  If the sheet states a scale, enter it to size the drawing exactly. Works for PDFs exported at their printed size, as most CAD exports are; otherwise calibrate below.
                </p>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted">1 :</span>
                  <input className="input w-24 font-mono" inputMode="numeric" value={ratio} placeholder={String(Math.round((bm.widthM * 1000) / bm.pageWidthMm))}
                    onChange={(e) => setRatio(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void applyRatio() }} />
                  <button className="btn btn-primary" disabled={!(parseFloat(ratio) > 0)} onClick={() => void applyRatio()}>Apply</button>
                </div>
                <p className="mt-1 text-[11px] text-muted">Page {Math.round(bm.pageWidthMm)} mm wide, now 1:{Math.round((bm.widthM * 1000) / bm.pageWidthMm)} ({bm.widthM} m).</p>
              </div>
            )}
            <div className="rounded-lg bg-bg p-3">
              <div className="mb-1 flex items-center gap-1 font-semibold"><Ruler size={14} />Calibrate scale</div>
              <ol className="mb-2 list-decimal pl-4 text-[11px] text-muted">
                <li>Pick the measure tool and drag along a known dimension on the drawing.</li>
                <li>Enter its real length and apply.</li>
              </ol>
              <div className="flex gap-1">
                <button className="btn" onClick={() => s.set({ tool: 'measure', placing: null })}>Measure</button>
                <input className="input w-20 font-mono" value={known} onChange={(e) => setKnown(e.target.value)} />
                <span className="self-center text-xs text-muted">m</span>
                <button className="btn btn-primary" disabled={!s.measure} onClick={calibrate}>Apply</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              <button className="btn border border-bg-2" title="Set the venue width and depth to the drawing's size and line them up"
                onClick={() => upVenue({ widthM: +bm.widthM.toFixed(2), heightM: +(bm.widthM / bm.aspect).toFixed(2), basemap: { ...bm, x: 0, y: 0 } })}>
                Fit footprint to drawing
              </button>
              <button className="btn text-red-600" onClick={() => upVenue({ basemap: undefined })}>Remove basemap</button>
            </div>
          </>
        )}
      </section>

      <section className="space-y-2">
        <div className="eyebrow">Project</div>
        <button className="btn w-full" onClick={() => jsonRef.current?.click()}><FileUp size={15} />Open project file as new event (.json)</button>
        <input ref={jsonRef} type="file" accept="application/json,.json" hidden onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = ''
          if (!f) return
          let p: Plan
          try { p = JSON.parse(await f.text()) as Plan } catch { alert('Invalid project file'); return }
          if (!Array.isArray(p?.elements) || !p.layers) { alert('Invalid project file'); return }
          await s.importPlan(p)
        }} />
        <button className="btn w-full" onClick={() => s.set({ dialog: 'newEvent', newEventStart: 'blank' })}>
          <Plus size={15} />New event
        </button>
        <p className="text-[11px] text-muted">Events are saved in this browser. Switch between them from the menu next to the event name.</p>
      </section>
    </div>
  )
}
