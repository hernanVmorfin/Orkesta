import { useState } from 'react'
import { Search, MapPin, Move, X } from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'
import { anchorFor, planToLatLng, searchPlaces, type Place } from '../lib/geo'
import { requestFit } from '../lib/canvas'
import type { GeoAnchor } from '../types'

/** Venue tab: put the plan on satellite imagery, then line it up with the building. */
export function SatelliteSection() {
  const s = usePlanStore()
  const { plan } = s
  const geo = plan.geo
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Place[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [changing, setChanging] = useState(false)

  const center = { x: plan.widthM / 2, y: plan.heightM / 2 }
  const setGeo = (g: GeoAnchor | undefined, record = true) => s.mutate((p) => ({ ...p, geo: g }), record)

  const search = async () => {
    if (!q.trim()) return
    setBusy(true); setError(null); setResults(null)
    try {
      const found = await searchPlaces(q)
      setResults(found)
      if (!found.length) setError('No places found. Try a fuller address, or paste coordinates as lat, lng.')
    } catch {
      setError('Place search is unavailable right now. Paste coordinates as lat, lng instead.')
    }
    setBusy(false)
  }

  /** Centers the venue on the chosen place, keeping any rotation already set. */
  const place = (pl: Place) => {
    const rotation = geo?.rotation ?? 0
    setGeo({ ...anchorFor(pl, center, rotation), rotation, opacity: geo?.opacity ?? 1, label: pl.label })
    setResults(null); setChanging(false); setQ('')
    s.set({ showSatellite: true })
    requestFit()
  }

  /** Rotates the satellite around the venue center so the view doesn't jump. */
  const rotate = (deg: number, record: boolean) => {
    if (!geo) return
    const at = planToLatLng(geo, center)
    setGeo({ ...geo, ...anchorFor(at, center, deg), rotation: deg }, record)
  }

  const searchForm = (
    <>
      <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); void search() }}>
        <input className="input" placeholder="Venue address or lat, lng" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-primary h-[30px] shrink-0 px-2" disabled={busy} title="Find place"><Search size={15} /></button>
      </form>
      {busy && <p className="text-[11px] text-muted">Searching…</p>}
      {error && <p className="text-[11px] text-red-600">{error}</p>}
      {results && results.length > 0 && (
        <ul className="rounded-md border border-bg-2">
          {results.map((r, i) => (
            <li key={i}>
              <button className="flex w-full items-start gap-1.5 px-2 py-1.5 text-left text-xs hover:bg-bg" onClick={() => place(r)}>
                <MapPin size={13} className="mt-0.5 shrink-0 text-accent-deep" /><span className="line-clamp-2">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted">Search by OpenStreetMap. The venue is centered on the place you pick.</p>
    </>
  )

  if (!geo) {
    return (
      <section className="space-y-2">
        <div className="eyebrow">Satellite view</div>
        {searchForm}
      </section>
    )
  }

  return (
    <section className="space-y-2">
      <div className="eyebrow">Satellite view</div>
      <div className="flex items-start gap-1.5 rounded-lg bg-bg p-2 text-xs">
        <MapPin size={14} className="mt-0.5 shrink-0 text-accent-deep" />
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-ink-2">{geo.label ?? 'Pinned location'}</div>
          <div className="font-mono text-[10px] text-muted">{geo.lat.toFixed(6)}, {geo.lng.toFixed(6)}</div>
        </div>
        <button className="text-muted hover:text-ink" title="Change location" onClick={() => setChanging(!changing)}>{changing ? <X size={14} /> : 'Change'}</button>
      </div>
      {changing && searchForm}

      <button className={`btn w-full justify-center ${s.tool === 'geo' ? 'btn-ghost-active' : 'border border-bg-2'}`}
        onClick={() => s.set({ tool: s.tool === 'geo' ? 'select' : 'geo', placing: null, measure: null })}>
        <Move size={15} />{s.tool === 'geo' ? 'Done aligning' : 'Align: drag satellite'}
      </button>

      <label className="block">
        <span className="text-[11px] text-muted">Rotation {geo.rotation.toFixed(1)}°</span>
        <div className="flex items-center gap-2">
          <input type="range" min={-180} max={180} step={0.5} className="w-full accent-[#1ea7e8]" value={geo.rotation}
            onPointerDown={() => s.checkpoint()} onChange={(e) => rotate(+e.target.value, false)} />
          <input type="number" step={0.5} className="input w-20 font-mono" value={geo.rotation}
            onChange={(e) => rotate(Math.max(-180, Math.min(180, +e.target.value || 0)), true)} />
        </div>
      </label>
      <label className="block"><span className="text-[11px] text-muted">Opacity {Math.round(geo.opacity * 100)}%</span>
        <input type="range" min={0.1} max={1} step={0.05} className="w-full accent-[#1ea7e8]" value={geo.opacity}
          onChange={(e) => setGeo({ ...geo, opacity: +e.target.value }, false)} />
      </label>
      <p className="text-[11px] text-muted">Drag the satellite until the building lines up with your venue outline, rotate to match, then set the footprint size above.</p>
      <button className="btn text-red-600" onClick={() => { setGeo(undefined); s.set({ tool: 'select' }) }}>Remove satellite</button>
    </section>
  )
}
