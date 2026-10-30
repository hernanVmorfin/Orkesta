import { useRef, useState } from 'react'
import { Upload, Plus, FileUp, Ruler, WandSparkles } from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'
import { dist } from '../lib/geometry'
import type { Plan } from '../types'
import { SatelliteSection } from './SatelliteSection'
import { VenueSetupDialog } from './VenueSetupDialog'
import { calibrateTemplate, createTemplate } from '../lib/template'

export function VenuePanel() {
  const s = usePlanStore()
  const { plan, viewOnly } = s
  const imgRef = useRef<HTMLInputElement>(null)
  const jsonRef = useRef<HTMLInputElement>(null)
  const [known, setKnown] = useState('6')
  const up = (patch: Partial<Plan>) => s.mutate((p) => ({ ...p, ...patch }))
  const bm = plan.basemap

  const onImage = (f: File) => new Promise<void>((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(r.error)
    r.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        up({ basemap: createTemplate({ src: r.result as string, name: f.name, imageWidth: img.width, imageHeight: img.height, planWidthM: plan.widthM, planHeightM: plan.heightM }) })
        s.set({ showBasemap: true })
        resolve()
      }
      img.src = r.result as string
    }
    r.readAsDataURL(f)
  })

  /** Calibrate: the current measure line should equal `known` meters → rescale basemap around its origin. */
  const calibrate = () => {
    const m = s.measure
    const k = parseFloat(known)
    if (!m || !bm || !k) return
    const d = dist(m.a, m.b)
    if (d < 0.01) return
    up({ basemap: calibrateTemplate(bm, d, k) })
    s.set({ measure: null, tool: 'select' })
  }

  if (viewOnly)
    return <div className="p-4 text-sm"><div className="eyebrow">Venue</div><p>{plan.venue}</p><p className="text-muted">{plan.widthM} × {plan.heightM} m</p></div>

  return (
    <div className="space-y-5 p-4 text-sm">
      <section className="rounded-xl border border-accent/30 bg-accent/5 p-3">
        <div className="flex items-start gap-2">
          <WandSparkles size={17} className="mt-0.5 shrink-0 text-accent-deep" />
          <div><div className="font-semibold text-ink">Guided venue setup</div><p className="mt-1 text-[11px] leading-4 text-muted">Start with the exact address, show the satellite surroundings, then upload and align a venue template.</p></div>
        </div>
        <button className="btn btn-primary mt-3 w-full justify-center" onClick={() => s.set({ showVenueSetup: true })}>Open guided setup</button>
      </section>
      <section className="space-y-2">
        <div className="eyebrow">Event</div>
        <input className="input" value={plan.name} onChange={(e) => up({ name: e.target.value })} placeholder="Event name" />
        <input className="input" value={plan.venue} onChange={(e) => up({ venue: e.target.value })} placeholder="Venue" />
        <input className="input" type="date" value={plan.date} onChange={(e) => up({ date: e.target.value })} />
      </section>

      <section className="space-y-2">
        <div className="eyebrow">Venue footprint & rules</div>
        <div className="grid grid-cols-3 gap-2">
          <label><span className="text-[11px] text-muted">Width m</span><input className="input font-mono" type="number" value={plan.widthM} onChange={(e) => up({ widthM: Math.max(5, +e.target.value) })} /></label>
          <label><span className="text-[11px] text-muted">Depth m</span><input className="input font-mono" type="number" value={plan.heightM} onChange={(e) => up({ heightM: Math.max(5, +e.target.value) })} /></label>
          <label><span className="text-[11px] text-muted">Min aisle m</span><input className="input font-mono" type="number" step={0.1} value={plan.minAisleM} onChange={(e) => up({ minAisleM: Math.max(0, +e.target.value) })} /></label>
        </div>
        <p className="text-[11px] text-muted">Aisle check measures chair-back to chair-back (table + 0.75 m chair zone). Confirm the minimum with local civil protection rules.</p>
      </section>

      <SatelliteSection />

      <section className="space-y-2">
        <div className="eyebrow">Template layer</div>
        <button className="btn w-full justify-center border border-dashed border-accent/50" onClick={() => imgRef.current?.click()}><Upload size={15} />Upload venue drawing or plan</button>
        <input ref={imgRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImage(f); e.target.value = '' }} />
        {bm && (
          <>
            <label className="block"><span className="text-[11px] text-muted">Opacity {Math.round(bm.opacity * 100)}%</span>
              <input type="range" min={0} max={1} step={0.05} className="w-full accent-[#1ea7e8]" value={bm.opacity}
                onChange={(e) => s.mutate((p) => ({ ...p, basemap: { ...bm, opacity: +e.target.value } }), false)} /></label>
            <div className="grid grid-cols-3 gap-2">
              <label><span className="text-[11px] text-muted">Real width m</span><input className="input font-mono" type="number" step={0.1} value={bm.widthM} onChange={(e) => up({ basemap: { ...bm, widthM: +e.target.value } })} /></label>
              <label><span className="text-[11px] text-muted">Offset X</span><input className="input font-mono" type="number" step={0.1} value={bm.x} onChange={(e) => up({ basemap: { ...bm, x: +e.target.value } })} /></label>
              <label><span className="text-[11px] text-muted">Offset Y</span><input className="input font-mono" type="number" step={0.1} value={bm.y} onChange={(e) => up({ basemap: { ...bm, y: +e.target.value } })} /></label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label><span className="text-[11px] text-muted">Rotation °</span><input className="input font-mono" type="number" step={0.5} value={bm.rotation ?? 0} onChange={(e) => up({ basemap: { ...bm, rotation: +e.target.value || 0 } })} /></label>
              <button className={`btn self-end justify-center ${s.tool === 'template' ? 'btn-ghost-active' : ''}`} disabled={bm.locked}
                onClick={() => s.set({ tool: s.tool === 'template' ? 'select' : 'template', placing: null, measure: null })}>{s.tool === 'template' ? 'Done moving' : 'Drag to align'}</button>
            </div>
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
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!bm.locked} onChange={(e) => { up({ basemap: { ...bm, locked: e.target.checked } }); if (e.target.checked) s.set({ tool: 'select' }) }} />Lock template</label>
            <button className="btn text-red-600" onClick={() => up({ basemap: undefined })}>Remove basemap</button>
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
        <button className="btn w-full" onClick={() => void s.newEvent()}>
          <Plus size={15} />New event
        </button>
        <p className="text-[11px] text-muted">Events are saved in this browser. Switch between them from the menu next to the event name.</p>
      </section>
      {s.showVenueSetup && <VenueSetupDialog onClose={() => s.set({ showVenueSetup: false })} onUpload={onImage} />}
    </div>
  )
}
