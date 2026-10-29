import { useRef, useState } from 'react'
import { Upload, Plus, FileUp, Ruler } from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'
import { dist } from '../lib/geometry'
import type { Plan } from '../types'
import { SatelliteSection } from './SatelliteSection'

export function VenuePanel() {
  const s = usePlanStore()
  const { plan, viewOnly } = s
  const imgRef = useRef<HTMLInputElement>(null)
  const jsonRef = useRef<HTMLInputElement>(null)
  const [known, setKnown] = useState('6')
  const up = (patch: Partial<Plan>) => s.mutate((p) => ({ ...p, ...patch }))
  const bm = plan.basemap

  const onImage = (f: File) => {
    const r = new FileReader()
    r.onload = () => {
      const img = new Image()
      img.onload = () => {
        up({ basemap: { src: r.result as string, widthM: plan.widthM, aspect: img.width / img.height, x: 0, y: 0, opacity: 0.5 } })
        s.set({ showBasemap: true })
      }
      img.src = r.result as string
    }
    r.readAsDataURL(f)
  }

  /** Calibrate: the current measure line should equal `known` meters → rescale basemap around its origin. */
  const calibrate = () => {
    const m = s.measure
    const k = parseFloat(known)
    if (!m || !bm || !k) return
    const d = dist(m.a, m.b)
    if (d < 0.01) return
    const f = k / d
    up({ basemap: { ...bm, widthM: +(bm.widthM * f).toFixed(3) } })
    s.set({ measure: null, tool: 'select' })
  }

  if (viewOnly)
    return <div className="p-4 text-sm"><div className="eyebrow">Venue</div><p>{plan.venue}</p><p className="text-muted">{plan.widthM} × {plan.heightM} m</p></div>

  return (
    <div className="space-y-5 p-4 text-sm">
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
        <div className="eyebrow">Basemap / blueprint</div>
        <button className="btn w-full justify-center border border-dashed border-accent/50" onClick={() => imgRef.current?.click()}><Upload size={15} />Upload venue drawing or aerial image</button>
        <input ref={imgRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImage(f); e.target.value = '' }} />
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
    </div>
  )
}
