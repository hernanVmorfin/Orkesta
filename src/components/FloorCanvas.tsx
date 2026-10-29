import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigation } from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'
import { ElementShape } from './ElementShape'
import { LAYERS, CATALOG, isTableKind } from '../lib/catalog'
import { clearanceIssues, dist, snap } from '../lib/geometry'
import { canvasRef } from '../lib/canvas'
import { SATELLITE_ATTRIBUTION, planToLatLng, tileZoom, tilesFor } from '../lib/geo'
import type { GeoAnchor, Pt } from '../types'

type Drag =
  | { t: 'move'; start: Pt; orig: Map<string, Pt>; primary: string; moved: boolean }
  | { t: 'pan'; sx: number; sy: number; pan: Pt }
  | { t: 'rotate'; id: string; c: Pt; moved: boolean }
  | { t: 'measure'; a: Pt }
  | { t: 'marquee'; a: Pt; additive: boolean }
  | { t: 'geo'; start: Pt; geo0: GeoAnchor; moved: boolean }

const LAYER_ORDER = Object.fromEntries(LAYERS.map((l, i) => [l.id, i]))

export function FloorCanvas() {
  const s = usePlanStore()
  const { plan, zoom, pan, selection, viewOnly } = s
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  const [cursor, setCursor] = useState<Pt | null>(null)
  const [marquee, setMarquee] = useState<{ a: Pt; b: Pt } | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Satellite tiles for the visible area, at the zoom that matches screen resolution
  const geo = plan.geo
  const satellite = geo && s.showSatellite ? geo : null
  const tiles = useMemo(() => {
    if (!satellite || !size.w) return []
    const corners = [[0, 0], [size.w, 0], [0, size.h], [size.w, size.h]]
      .map(([cx, cy]) => ({ x: (cx - pan.x) / zoom, y: (cy - pan.y) / zoom }))
    return tilesFor(satellite, corners, tileZoom(satellite.lat, zoom * Math.min(2, window.devicePixelRatio || 1)))
  }, [satellite, size, pan, zoom])

  const toWorld = (cx: number, cy: number): Pt => {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: (cx - r.left - pan.x) / zoom, y: (cy - r.top - pan.y) / zoom }
  }

  const fit = () => {
    const el = svgRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const z = Math.min(width / plan.widthM, height / plan.heightM) * 0.94
    s.set({ zoom: z, pan: { x: (width - plan.widthM * z) / 2, y: (height - plan.heightM * z) / 2 } })
  }

  useEffect(() => {
    canvasRef.current = svgRef.current
    fit()
    const onFit = () => fit()
    window.addEventListener('fp:fit', onFit)
    return () => window.removeEventListener('fp:fit', onFit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, plan.widthM, plan.heightM])

  // Wheel zoom around cursor (non-passive so we can preventDefault)
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault()
      const { zoom: z, pan: p } = usePlanStore.getState()
      const r = el.getBoundingClientRect()
      const mx = ev.clientX - r.left, my = ev.clientY - r.top
      const nz = Math.min(200, Math.max(3, z * Math.exp(-ev.deltaY * 0.0015)))
      usePlanStore.setState({ zoom: nz, pan: { x: mx - ((mx - p.x) / z) * nz, y: my - ((my - p.y) / z) * nz } })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const visible = useMemo(
    () => plan.elements
      .filter((e) => plan.layers[e.layer]?.visible !== false)
      .sort((a, b) => (LAYER_ORDER[a.layer] ?? 0) - (LAYER_ORDER[b.layer] ?? 0)),
    [plan.elements, plan.layers],
  )
  const tagById = useMemo(() => new Map(plan.tags.map((t) => [t.id, t])), [plan.tags])
  const usedByTable = useMemo(() => {
    const m = new Map<string, number>()
    plan.guests.forEach((g) => g.tableId && m.set(g.tableId, (m.get(g.tableId) ?? 0) + 1))
    return m
  }, [plan.guests])
  const issues = useMemo(
    () => (s.showClearance ? clearanceIssues(visible, plan.minAisleM) : []),
    [visible, plan.minAisleM, s.showClearance],
  )

  const isLocked = (id: string) => {
    const e = plan.elements.find((x) => x.id === id)
    return !e || e.locked || plan.layers[e.layer]?.locked
  }

  const onPointerDown = (ev: React.PointerEvent) => {
    const target = ev.target as Element
    const w = toWorld(ev.clientX, ev.clientY)
    svgRef.current!.setPointerCapture(ev.pointerId)

    if (ev.button === 1 || ev.altKey) {
      drag.current = { t: 'pan', sx: ev.clientX, sy: ev.clientY, pan }
      return
    }
    if (s.placing && !viewOnly) {
      s.addElement(s.placing, s.snapOn ? { x: snap(w.x), y: snap(w.y) } : w)
      if (!ev.shiftKey) s.set({ placing: null })
      return
    }
    if (s.tool === 'geo' && geo && !viewOnly) {
      drag.current = { t: 'geo', start: w, geo0: geo, moved: false }
      return
    }
    if (s.tool === 'measure') {
      drag.current = { t: 'measure', a: w }
      s.set({ measure: { a: w, b: w } })
      return
    }
    if (target.closest('[data-handle="rotate"]') && selection.length === 1) {
      const e = plan.elements.find((x) => x.id === selection[0])!
      drag.current = { t: 'rotate', id: e.id, c: { x: e.x, y: e.y }, moved: false }
      return
    }
    const hit = target.closest('[data-id]')?.getAttribute('data-id')
    if (hit && (viewOnly || !isLocked(hit))) {
      const additive = ev.shiftKey || ev.metaKey || ev.ctrlKey
      if (!selection.includes(hit) || additive) s.select([hit], additive)
      if (viewOnly) return
      const ids = additive ? selection.concat(hit) : selection.includes(hit) ? selection : [hit]
      const orig = new Map(plan.elements.filter((e) => ids.includes(e.id) && !isLocked(e.id)).map((e) => [e.id, { x: e.x, y: e.y }]))
      drag.current = { t: 'move', start: w, orig, primary: hit, moved: false }
      return
    }
    if (ev.shiftKey && !viewOnly) {
      drag.current = { t: 'marquee', a: w, additive: true }
      setMarquee({ a: w, b: w })
      return
    }
    s.set({ selection: [], highlightTable: null })
    drag.current = { t: 'pan', sx: ev.clientX, sy: ev.clientY, pan }
  }

  const onPointerMove = (ev: React.PointerEvent) => {
    const w = toWorld(ev.clientX, ev.clientY)
    setCursor(w)
    const d = drag.current
    if (!d) return
    if (d.t === 'pan') {
      s.set({ pan: { x: d.pan.x + ev.clientX - d.sx, y: d.pan.y + ev.clientY - d.sy } })
    } else if (d.t === 'move') {
      let dx = w.x - d.start.x, dy = w.y - d.start.y
      if (!d.moved && Math.hypot(dx, dy) * zoom < 3) return
      if (!d.moved) { s.checkpoint(); d.moved = true }
      const p0 = d.orig.get(d.primary) ?? [...d.orig.values()][0]
      if (s.snapOn && p0) { dx = snap(p0.x + dx) - p0.x; dy = snap(p0.y + dy) - p0.y }
      s.updateMany((e) => ({ ...e, x: +(d.orig.get(e.id)!.x + dx).toFixed(3), y: +(d.orig.get(e.id)!.y + dy).toFixed(3) }), [...d.orig.keys()], false)
    } else if (d.t === 'rotate') {
      if (!d.moved) { s.checkpoint(); d.moved = true }
      let a = (Math.atan2(w.y - d.c.y, w.x - d.c.x) * 180) / Math.PI + 90
      a = ev.shiftKey ? a : Math.round(a / 15) * 15
      s.updateElement(d.id, { rotation: ((a % 360) + 360) % 360 }, false)
    } else if (d.t === 'geo') {
      if (!d.moved) { s.checkpoint(); d.moved = true }
      // The world point that was under plan point -delta now sits at the plan origin
      const at = planToLatLng(d.geo0, { x: d.start.x - w.x, y: d.start.y - w.y })
      s.mutate((p) => ({ ...p, geo: { ...d.geo0, lat: at.lat, lng: at.lng } }), false)
    } else if (d.t === 'measure') {
      s.set({ measure: { a: d.a, b: w } })
    } else if (d.t === 'marquee') {
      setMarquee({ a: d.a, b: w })
    }
  }

  const onPointerUp = () => {
    const d = drag.current
    if (d?.t === 'marquee' && marquee) {
      const x0 = Math.min(marquee.a.x, marquee.b.x), x1 = Math.max(marquee.a.x, marquee.b.x)
      const y0 = Math.min(marquee.a.y, marquee.b.y), y1 = Math.max(marquee.a.y, marquee.b.y)
      const ids = visible.filter((e) => e.x >= x0 && e.x <= x1 && e.y >= y0 && e.y <= y1 && !isLocked(e.id)).map((e) => e.id)
      s.select(ids, d.additive)
      setMarquee(null)
    }
    drag.current = null
  }

  const onDrop = (ev: React.DragEvent) => {
    ev.preventDefault()
    if (viewOnly) return
    const w = toWorld(ev.clientX, ev.clientY)
    const kind = ev.dataTransfer.getData('application/x-kind')
    if (kind) {
      s.addElement(kind, s.snapOn ? { x: snap(w.x), y: snap(w.y) } : w)
      return
    }
    const guestId = ev.dataTransfer.getData('application/x-guest')
    if (guestId) {
      const table = plan.elements.find((e) => isTableKind(e.kind) && dist(e, w) <= Math.max(e.w, e.h) / 2 + 0.7)
      if (table && !s.assignGuest(guestId, table.id)) alertFull(table.label)
    }
  }

  const selected = plan.elements.filter((e) => selection.includes(e.id))
  const single = selected.length === 1 && !viewOnly && !isLocked(selected[0].id) ? selected[0] : null
  const bm = plan.basemap
  const m = s.measure

  return (
    <div className="relative h-full w-full overflow-hidden bg-bg-2">
      <svg
        ref={svgRef}
        className="h-full w-full touch-none select-none"
        style={{ cursor: s.placing ? 'copy' : s.tool === 'measure' ? 'crosshair' : s.tool === 'geo' ? 'move' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setCursor(null)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <g id="world" transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          <rect id="venue-bg" width={plan.widthM} height={plan.heightM} fill="#ffffff" />
          {satellite && (
            <g className="satellite" transform={`rotate(${satellite.rotation})`} opacity={satellite.opacity} pointerEvents="none">
              {/* one tile pixel of overlap hides seams between tiles */}
              {tiles.map((t) => (
                <image key={t.key} href={t.url} x={t.x} y={t.y} width={t.size * 1.004} height={t.size * 1.004} preserveAspectRatio="none" />
              ))}
            </g>
          )}
          {bm && s.showBasemap && (
            <image id="basemap" href={bm.src} x={bm.x} y={bm.y} width={bm.widthM} height={bm.widthM / bm.aspect}
              opacity={bm.opacity} preserveAspectRatio="none" />
          )}
          {s.showGrid && <Grid w={plan.widthM} h={plan.heightM} />}
          <rect width={plan.widthM} height={plan.heightM} fill="none" stroke="#0a1729" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />

          {visible.map((e) => (
            <ElementShape key={e.id} e={e} tag={e.tag ? tagById.get(e.tag) : undefined}
              used={isTableKind(e.kind) ? usedByTable.get(e.id) ?? 0 : undefined}
              showLabels={s.showLabels} highlight={s.highlightTable === e.id} />
          ))}

          {issues.map((i, k) => {
            const mx = (i.pa.x + i.pb.x) / 2, my = (i.pa.y + i.pb.y) / 2
            return (
              <g key={k} className="clearance" pointerEvents="none">
                <line x1={i.pa.x} y1={i.pa.y} x2={i.pb.x} y2={i.pb.y} stroke="#dc2626" strokeWidth={2}
                  strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
                <text x={mx} y={my - 0.2} textAnchor="middle" fontSize={0.35} fill="#dc2626" fontFamily="Geist, Arial"
                  stroke="#fff" strokeWidth={0.08} paintOrder="stroke">{Math.max(0, i.gap).toFixed(2)} m</text>
              </g>
            )
          })}

          {selected.map((e) => {
            const r = CATALOG[e.kind]?.shape === 'roundTable' ? e.w / 2 + 0.6 : undefined
            return (
              <g key={e.id} className="no-export" transform={`translate(${e.x} ${e.y}) rotate(${e.rotation})`} pointerEvents="none">
                {r ? <circle r={r} fill="none" stroke="#1ea7e8" strokeWidth={1.5} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
                  : <rect x={-e.w / 2 - 0.15} y={-e.h / 2 - 0.15} width={e.w + 0.3} height={e.h + 0.3} fill="none"
                      stroke="#1ea7e8" strokeWidth={1.5} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />}
              </g>
            )
          })}
          {single && (() => {
            const off = (CATALOG[single.kind]?.shape === 'roundTable' ? single.w / 2 + 0.6 : single.h / 2) + 0.9
            return (
              <g className="no-export" transform={`translate(${single.x} ${single.y}) rotate(${single.rotation})`}>
                <line y1={-off + 0.3} y2={-(single.h / 2)} stroke="#1ea7e8" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                <circle data-handle="rotate" cy={-off} r={Math.max(0.28, 7 / zoom)} fill="#ffffff" stroke="#1ea7e8"
                  strokeWidth={2} vectorEffect="non-scaling-stroke" style={{ cursor: 'grab' }} />
              </g>
            )
          })()}

          {m && (
            <g className="no-export" pointerEvents="none">
              <line x1={m.a.x} y1={m.a.y} x2={m.b.x} y2={m.b.y} stroke="#075e99" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              <circle cx={m.a.x} cy={m.a.y} r={4 / zoom} fill="#075e99" />
              <circle cx={m.b.x} cy={m.b.y} r={4 / zoom} fill="#075e99" />
              <text x={(m.a.x + m.b.x) / 2} y={(m.a.y + m.b.y) / 2 - 10 / zoom} textAnchor="middle" fontSize={13 / zoom}
                fontFamily="Geist, Arial" fontWeight={600} fill="#075e99" stroke="#fff" strokeWidth={4 / zoom} paintOrder="stroke">
                {dist(m.a, m.b).toFixed(2)} m
              </text>
            </g>
          )}
          {marquee && (
            <rect className="no-export" x={Math.min(marquee.a.x, marquee.b.x)} y={Math.min(marquee.a.y, marquee.b.y)}
              width={Math.abs(marquee.b.x - marquee.a.x)} height={Math.abs(marquee.b.y - marquee.a.y)}
              fill="#1ea7e8" fillOpacity={0.08} stroke="#1ea7e8" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          )}
        </g>
      </svg>

      <ScaleBar zoom={zoom} />
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-white/90 px-2 py-1 font-mono text-[11px] text-muted shadow-sm">
        {cursor ? `x ${cursor.x.toFixed(2)} m · y ${cursor.y.toFixed(2)} m` : 'Scroll to zoom · drag to pan · Shift+drag to box-select'}
      </div>
      {s.placing && (
        <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-ink px-4 py-1.5 text-xs text-on-ink shadow">
          Click to place <b>{CATALOG[s.placing]?.name}</b> · Shift+click to place several · Esc to cancel
        </div>
      )}
      {s.tool === 'geo' && (
        <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-ink px-4 py-1.5 text-xs text-on-ink shadow">
          Drag to move the satellite under your venue · rotate it in the Venue tab · Esc when done
        </div>
      )}
      {satellite && (
        <>
          <div className="pointer-events-none absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow-sm" title="North">
            <div className="flex flex-col items-center" style={{ transform: `rotate(${satellite.rotation}deg)` }}>
              <Navigation size={14} className="fill-red-600 text-red-600" />
              <span className="font-mono text-[9px] font-semibold leading-none text-ink">N</span>
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-10 right-3 rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-muted">{SATELLITE_ATTRIBUTION}</div>
        </>
      )}
      {issues.length > 0 && (
        <div className="absolute left-3 top-3 rounded-md border border-red-200 bg-white/95 px-3 py-1.5 text-xs text-red-700 shadow-sm">
          {issues.length} aisle {issues.length === 1 ? 'conflict' : 'conflicts'} under {plan.minAisleM} m
        </div>
      )}
    </div>
  )
}

function alertFull(label: string) {
  window.dispatchEvent(new CustomEvent('fp:toast', { detail: `${label} is full` }))
}

function ScaleBar({ zoom }: { zoom: number }) {
  const steps = [0.5, 1, 2, 5, 10, 20]
  const m = steps.find((v) => v * zoom >= 60) ?? 20
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-white/90 px-2 py-1 shadow-sm">
      <div className="h-1.5 border-x-2 border-b-2 border-ink" style={{ width: m * zoom }} />
      <div className="mt-0.5 font-mono text-[11px] text-ink">{m} m</div>
    </div>
  )
}


function Grid({ w, h }: { w: number; h: number }) {
  const lines: React.ReactNode[] = []
  for (let x = 1; x < w; x++) lines.push(<line key={`x${x}`} x1={x} y1={0} x2={x} y2={h} stroke={x % 5 ? '#dfe5ee' : '#b8c4d3'} strokeWidth={0.75} vectorEffect="non-scaling-stroke" />)
  for (let y = 1; y < h; y++) lines.push(<line key={`y${y}`} x1={0} y1={y} x2={w} y2={y} stroke={y % 5 ? '#dfe5ee' : '#b8c4d3'} strokeWidth={0.75} vectorEffect="non-scaling-stroke" />)
  return <g className="grid" pointerEvents="none" opacity={0.7}>{lines}</g>
}
