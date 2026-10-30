import { useRef, useState } from 'react'
import { FilePlus2, FileText, MapPin, Search, X } from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { usePlanStore } from '../../store/usePlanStore'
import { blankPlan } from '../../data/blankPlan'
import { TEMPLATES } from '../../data/templates'
import { anchorFor, searchPlaces, type Place } from '../../lib/geo'
import { isPdf, readImageFile } from '../../lib/drawing'
import { toast } from '../../lib/toast'
import type { Basemap, Plan } from '../../types'
import { PlanThumb } from '../hub/PlanThumb'
import { templateThumb } from '../hub/templateThumbs'
import { Modal, NumField } from './Modal'

type Drawing =
  | { kind: 'image'; name: string; src: string; aspect: number }
  | { kind: 'pdf'; name: string; doc: PDFDocumentProxy; page: number }

/**
 * New event: a name, an optional date and venue, then where to start (blank, a starter layout or the
 * venue's drawing). Like OnePlan's first-run dialog, only the name is required.
 */
export function NewEventDialog({ onClose, start: initialStart = 'blank' }: { onClose: () => void; start?: string }) {
  const s = usePlanStore()
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [venue, setVenue] = useState('')
  const [place, setPlace] = useState<Place | null>(null)
  const [results, setResults] = useState<Place[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [start, setStart] = useState(initialStart)
  const [w, setW] = useState(30)
  const [h, setH] = useState(20)
  const [drawing, setDrawing] = useState<Drawing | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const template = TEMPLATES.find((t) => t.id === start)

  const findPlace = async () => {
    if (!venue.trim()) return
    setSearching(true); setResults(null)
    try { setResults(await searchPlaces(venue)) } catch { setResults([]) }
    setSearching(false)
  }

  const pickFile = async (f: File) => {
    setError(null)
    try {
      if (isPdf(f)) {
        const { openPdf } = await import('../../lib/pdfImport')
        const doc = await openPdf(f)
        setDrawing({ kind: 'pdf', name: f.name, doc, page: 1 })
      } else {
        setDrawing({ kind: 'image', name: f.name, ...(await readImageFile(f)) })
      }
      setStart('drawing')
    } catch (e) {
      toast((e as Error)?.name === 'PasswordException' ? 'That PDF is password-protected. Save an unlocked copy and try again.' : 'Couldn’t open that file')
    }
  }

  const basemapFor = async (d: Drawing, widthM: number): Promise<Basemap> => {
    if (d.kind === 'image') return { src: d.src, widthM, aspect: d.aspect, x: 0, y: 0, opacity: 0.5 }
    const { renderPdfPage } = await import('../../lib/pdfImport')
    const r = await renderPdfPage(d.doc, d.page)
    void d.doc.loadingTask.destroy()
    return { src: r.src, widthM, aspect: r.aspect, x: 0, y: 0, opacity: 0.5, pageWidthMm: r.pageWidthMm }
  }

  const create = async () => {
    if (!name.trim()) { setError('Enter an event name'); return }
    if (start === 'drawing' && !drawing) { setError('Choose the venue drawing, or start from something else'); return }
    setBusy(true)
    try {
      let p: Plan = template ? template.build() : { ...blankPlan(), widthM: w, heightM: h }
      p = { ...p, name: name.trim(), date, venue: venue.trim() || (place?.label.split(',')[0] ?? '') }
      if (place) p.geo = { ...anchorFor(place, { x: p.widthM / 2, y: p.heightM / 2 }, 0), rotation: 0, opacity: 1, label: place.label }
      if (start === 'drawing' && drawing) {
        const basemap = await basemapFor(drawing, p.widthM)
        // The drawing sets the depth; scale it exactly from the Venue tab
        p = { ...p, basemap, heightM: +(p.widthM / basemap.aspect).toFixed(2) }
      }
      onClose()
      await s.startPlan(p, start === 'drawing' ? { rightTab: 'venue', showBasemap: true, showPanel: true } : {})
    } catch (e) {
      console.error(e)
      setError('Couldn’t create the event. Try again.')
      setBusy(false)
    }
  }

  const option = (active: boolean) =>
    `flex w-full items-start gap-3 rounded-lg border p-2.5 text-left ${active ? 'border-accent bg-accent/5' : 'border-bg-2 hover:border-accent/50'}`

  return (
    <Modal title="New event" eyebrow="Start" onClose={onClose} wide>
      <form className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]" onSubmit={(e) => { e.preventDefault(); void create() }}>
        <div className="space-y-3">
          <label className="block"><span className="text-[11px] text-muted">Event name</span>
            <input autoFocus className="input" value={name} maxLength={120} placeholder="Annual gala dinner" onChange={(e) => { setName(e.target.value); setError(null) }} />
          </label>
          <label className="block"><span className="text-[11px] text-muted">Date</span>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div>
            <span className="text-[11px] text-muted">Venue</span>
            <div className="flex gap-1">
              <input className="input" value={venue} placeholder="Riverside Hall, Monterrey" onChange={(e) => { setVenue(e.target.value); setResults(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter' && venue.trim() && !place) { e.preventDefault(); void findPlace() } }} />
              <button type="button" className="btn shrink-0 border border-bg-2" title="Find on the map" disabled={searching} onClick={() => void findPlace()}><Search size={15} /></button>
            </div>
            {searching && <p className="mt-1 text-[11px] text-muted">Searching…</p>}
            {results && (results.length ? (
              <ul className="mt-1 max-h-40 overflow-y-auto rounded-md border border-bg-2">
                {results.map((r, i) => (
                  <li key={i}><button type="button" className="w-full px-2 py-1.5 text-left text-xs hover:bg-bg" onClick={() => { setPlace(r); setResults(null); if (!venue.includes(',')) setVenue(r.label.split(',')[0]) }}>{r.label}</button></li>
                ))}
              </ul>
            ) : <p className="mt-1 text-[11px] text-muted">No places found. You can still use the name as typed.</p>)}
            {place && (
              <p className="mt-1 flex items-start gap-1 text-[11px] text-ink-2">
                <MapPin size={12} className="mt-0.5 shrink-0 text-accent-deep" /><span className="flex-1">Satellite view centered on {place.label}</span>
                <button type="button" aria-label="Clear location" className="text-muted hover:text-ink" onClick={() => setPlace(null)}><X size={12} /></button>
              </p>
            )}
          </div>
          {!template && (
            <div className="grid grid-cols-2 gap-2">
              <NumField label="Venue width" unit="m" min={5} max={2000} value={w} onChange={setW} />
              <NumField label={start === 'drawing' ? 'Depth (from the drawing)' : 'Venue depth'} unit="m" min={5} max={2000} value={h} onChange={setH} />
            </div>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="space-y-2">
          <div className="text-[11px] text-muted">Start from</div>
          <button type="button" className={option(start === 'blank')} onClick={() => setStart('blank')}>
            <FilePlus2 size={20} className="mt-0.5 shrink-0 text-accent-deep" />
            <span><span className="block text-sm font-semibold">Blank plan</span><span className="text-xs text-muted">An empty venue of the size you set</span></span>
          </button>
          <button type="button" className={option(start === 'drawing')} onClick={() => (drawing ? setStart('drawing') : fileRef.current?.click())}>
            <FileText size={20} className="mt-0.5 shrink-0 text-accent-deep" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Venue drawing</span>
              <span className="block truncate text-xs text-muted">{drawing ? drawing.name : 'A PDF or image of the floor plan'}</span>
            </span>
            {drawing && <span className="shrink-0 text-xs text-accent-deep underline" onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}>Change</span>}
          </button>
          {drawing?.kind === 'pdf' && drawing.doc.numPages > 1 && start === 'drawing' && (
            <label className="flex items-center gap-2 pl-8 text-xs text-muted">Page
              <select className="input h-7 w-auto" value={drawing.page} onChange={(e) => setDrawing({ ...drawing, page: +e.target.value })}>
                {Array.from({ length: drawing.doc.numPages }, (_, i) => <option key={i} value={i + 1}>{i + 1} of {drawing.doc.numPages}</option>)}
              </select>
            </label>
          )}
          <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickFile(f); e.target.value = '' }} />
          <div className="grid grid-cols-3 gap-2">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" className={`${option(start === t.id)} flex-col gap-1 !p-1.5`} onClick={() => setStart(t.id)} title={t.description}>
                <PlanThumb thumb={templateThumb(t.id)} className="aspect-[4/3] w-full rounded" />
                <span className="text-xs font-semibold">{t.name}</span>
              </button>
            ))}
          </div>
          {template && <p className="text-[11px] text-muted">{template.description}</p>}
        </div>

        <div className="flex justify-end gap-2 md:col-span-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create event'}</button>
        </div>
      </form>
    </Modal>
  )
}
