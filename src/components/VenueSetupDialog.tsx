import { useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Image as ImageIcon, Lock, MapPin, Move, Ruler, Search, Upload, X } from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'
import { anchorFor, searchPlaces, type Place } from '../lib/geo'
import { requestFit } from '../lib/canvas'
import { calibrateTemplate } from '../lib/template'
import { dist } from '../lib/geometry'

const STEPS = ['Address', 'Align template', 'Review']

export function VenueSetupDialog({ onClose, onUpload }: { onClose: () => void; onUpload: (file: File) => Promise<void> }) {
  const s = usePlanStore()
  const { plan } = s
  const [step, setStep] = useState(plan.geo ? 1 : 0)
  const [query, setQuery] = useState(plan.venue)
  const [results, setResults] = useState<Place[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [known, setKnown] = useState('6')
  const inputRef = useRef<HTMLInputElement>(null)
  const bm = plan.basemap

  const search = async () => {
    if (!query.trim()) return
    setBusy(true); setError(null); setResults([])
    try {
      const found = await searchPlaces(query)
      setResults(found)
      if (!found.length) setError('No matching address found. Add the street number, city, state, and postal code.')
    } catch {
      setError('Address search is unavailable. Try again or paste latitude, longitude.')
    }
    setBusy(false)
  }

  const choosePlace = (place: Place) => {
    const center = { x: plan.widthM / 2, y: plan.heightM / 2 }
    const rotation = plan.geo?.rotation ?? 0
    s.mutate((p) => ({
      ...p,
      venue: place.label,
      geo: { ...anchorFor(place, center, rotation), rotation, opacity: p.geo?.opacity ?? 1, label: place.label },
    }))
    s.set({ showSatellite: true, rightTab: 'venue' })
    setResults([]); setStep(1)
    requestFit()
  }

  const setTemplate = (patch: NonNullable<typeof bm>, record = true) => s.mutate((p) => ({ ...p, basemap: patch }), record)

  const upload = async (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Choose a PNG, JPG, or WebP image.'); return }
    setBusy(true); setError(null)
    try { await onUpload(file) } catch { setError('The template image could not be opened.') }
    setBusy(false)
  }

  const calibrate = () => {
    const measured = s.measure ? dist(s.measure.a, s.measure.b) : 0
    const length = Number(known)
    if (!bm || measured <= 0 || length <= 0) return
    setTemplate(calibrateTemplate(bm, measured, length))
    s.set({ measure: null, tool: 'select' })
  }

  const finish = () => {
    s.set({ tool: 'select', measure: null, showBasemap: true, showSatellite: true })
    onClose()
    requestFit()
  }

  return (
    <div className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-[460px] flex-col border-l border-bg-2 bg-white shadow-2xl">
      <header className="flex items-center gap-3 border-b border-bg-2 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="eyebrow">Guided setup</div>
          <h2 className="text-lg font-semibold text-ink">Create venue plan</h2>
        </div>
        <button className="btn px-2" onClick={onClose} title="Close setup"><X size={17} /></button>
      </header>

      <div className="grid grid-cols-3 border-b border-bg-2 bg-bg px-3 py-2">
        {STEPS.map((label, index) => (
          <div key={label} className={`flex items-center justify-center gap-1 text-[11px] font-medium ${index === step ? 'text-accent-deep' : index < step ? 'text-ink' : 'text-muted'}`}>
            <span className={`grid h-5 w-5 place-items-center rounded-full ${index <= step ? 'bg-accent text-white' : 'bg-bg-2'}`}>{index < step ? <Check size={12} /> : index + 1}</span>{label}
          </div>
        ))}
      </div>

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto p-5">
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-ink">Locate the exact venue</h3>
              <p className="mt-1 text-xs leading-5 text-muted">Use the full street address so the satellite layer includes surrounding streets, entrances, and service access.</p>
            </div>
            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void search() }}>
              <label className="block text-xs font-medium text-ink-2">Exact address</label>
              <textarea className="input min-h-20 resize-none py-2" autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Street number, neighborhood, postal code, city, state, country" />
              <button className="btn btn-primary w-full justify-center" disabled={busy || !query.trim()}><Search size={15} />{busy ? 'Searching…' : 'Find on satellite'}</button>
            </form>
            {error && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
            {results.length > 0 && (
              <div className="overflow-hidden rounded-lg border border-bg-2">
                {results.map((place, index) => (
                  <button key={`${place.lat}-${place.lng}-${index}`} className="flex w-full items-start gap-2 border-b border-bg-2 px-3 py-3 text-left text-xs last:border-0 hover:bg-bg" onClick={() => choosePlace(place)}>
                    <MapPin size={15} className="mt-0.5 shrink-0 text-accent-deep" /><span>{place.label}</span>
                  </button>
                ))}
              </div>
            )}
            {plan.geo && <button className="btn w-full justify-center" onClick={() => setStep(1)}>Keep current location<ArrowRight size={15} /></button>}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h3 className="font-semibold text-ink">Upload and align the template</h3>
              <p className="mt-1 text-xs leading-5 text-muted">The satellite surroundings stay below the template. Event objects remain editable above it.</p>
            </div>

            <button className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-accent/40 bg-accent/5 px-4 py-5 text-sm font-medium text-accent-deep hover:bg-accent/10" onClick={() => inputRef.current?.click()}>
              <Upload size={18} />{bm ? 'Replace template image' : 'Upload template image'}
            </button>
            <input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void upload(file) }} />
            <p className="-mt-3 text-center text-[11px] text-muted">PNG, JPG, WebP, or GIF</p>
            {error && <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}

            {bm && (
              <>
                <div className="flex items-center gap-3 rounded-lg border border-bg-2 p-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded bg-bg"><img src={bm.src} className="h-full w-full object-cover" /></div>
                  <div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold text-ink">{bm.name ?? 'Uploaded template'}</div><div className="text-[11px] text-muted">Saved with this event</div></div>
                  <ImageIcon size={16} className="text-muted" />
                </div>

                <button className={`btn w-full justify-center ${s.tool === 'template' ? 'btn-ghost-active' : ''}`} disabled={bm.locked}
                  onClick={() => s.set({ tool: s.tool === 'template' ? 'select' : 'template', placing: null, measure: null, showBasemap: true })}>
                  <Move size={15} />{s.tool === 'template' ? 'Done moving template' : 'Align: drag template on canvas'}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <label><span className="text-[11px] text-muted">Width (m)</span><input className="input font-mono" type="number" min={0.1} step={0.1} value={bm.widthM} onChange={(e) => setTemplate({ ...bm, widthM: Math.max(0.1, +e.target.value) })} /></label>
                  <label><span className="text-[11px] text-muted">Rotation (°)</span><input className="input font-mono" type="number" step={0.5} value={bm.rotation ?? 0} onChange={(e) => setTemplate({ ...bm, rotation: +e.target.value || 0 })} /></label>
                </div>

                <label className="block"><span className="text-[11px] text-muted">Template opacity {Math.round(bm.opacity * 100)}%</span>
                  <input type="range" min={0.1} max={1} step={0.05} className="w-full accent-[#1ea7e8]" value={bm.opacity}
                    onPointerDown={s.checkpoint} onChange={(e) => setTemplate({ ...bm, opacity: +e.target.value }, false)} /></label>

                <div className="rounded-lg bg-bg p-3">
                  <div className="mb-1 flex items-center gap-1 font-semibold"><Ruler size={14} />Calibrate scale</div>
                  <p className="mb-2 text-[11px] leading-4 text-muted">Measure a printed dimension on the template, then enter its real length.</p>
                  <div className="flex gap-1">
                    <button className="btn" onClick={() => s.set({ tool: 'measure', placing: null })}>Measure</button>
                    <input className="input w-20 font-mono" value={known} onChange={(e) => setKnown(e.target.value)} />
                    <span className="self-center text-xs text-muted">m</span>
                    <button className="btn btn-primary" disabled={!s.measure || +known <= 0} onClick={calibrate}>Apply</button>
                  </div>
                </div>

                <label className="flex items-center gap-2 rounded-lg border border-bg-2 p-3 text-xs font-medium">
                  <input type="checkbox" checked={!!bm.locked} onChange={(e) => { setTemplate({ ...bm, locked: e.target.checked }); if (e.target.checked) s.set({ tool: 'select' }) }} />
                  <Lock size={14} />Lock template after alignment
                </label>
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-ink">Review venue setup</h3>
              <p className="mt-1 text-xs leading-5 text-muted">The location and template are stored with this event. You can reopen these controls from the Venue tab.</p>
            </div>
            <div className="space-y-3 rounded-xl border border-bg-2 p-4 text-xs">
              <div className="flex gap-2"><MapPin size={15} className="shrink-0 text-accent-deep" /><div><div className="font-semibold text-ink">Satellite location</div><div className="mt-0.5 text-muted">{plan.geo?.label ?? plan.venue}</div></div></div>
              <div className="h-px bg-bg-2" />
              <div className="flex gap-2"><ImageIcon size={15} className="shrink-0 text-accent-deep" /><div><div className="font-semibold text-ink">Template layer</div><div className="mt-0.5 text-muted">{bm?.name ?? 'Uploaded image'} · {bm?.widthM.toFixed(1)} m wide · {Math.round((bm?.opacity ?? 0) * 100)}% opacity</div></div></div>
              <div className="h-px bg-bg-2" />
              <div className="flex gap-2"><Lock size={15} className="shrink-0 text-accent-deep" /><div><div className="font-semibold text-ink">Editing</div><div className="mt-0.5 text-muted">Template is {bm?.locked ? 'locked' : 'unlocked'}; tables, stages, access points, and labels stay editable above it.</div></div></div>
            </div>
            <button className="btn btn-primary w-full justify-center" onClick={finish}><Check size={15} />Finish and start planning</button>
          </div>
        )}
      </div>

      <footer className="flex items-center gap-2 border-t border-bg-2 px-5 py-4">
        {step > 0 && <button className="btn" onClick={() => { s.set({ tool: 'select', measure: null }); setStep(step - 1) }}><ArrowLeft size={15} />Back</button>}
        <div className="flex-1" />
        {step === 1 && <button className="btn btn-primary" disabled={!bm} onClick={() => { s.set({ tool: 'select', measure: null }); setStep(2) }}>Review<ArrowRight size={15} /></button>}
      </footer>
    </div>
  )
}
