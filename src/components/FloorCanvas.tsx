import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigation } from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'
import { ElementShape } from './ElementShape'
import { LAYERS, CATALOG, isTableKind, isDrawnKind } from '../lib/catalog'
import { clearanceIssues, dist, distToRect, snap } from '../lib/geometry'
import { distToShape, fmtArea, fmtLen, pathLength, polygonArea, renormalize, toLocal, toPlan } from '../lib/shapes'
import { canvasRef, type FocusRequest } from '../lib/canvas'
import { toast } from '../lib/toast'
import { isLockedEl, venueOf, visibleOnLevel } from '../lib/levels'
import { ContextMenu, type MenuState } from './ContextMenu'
import { CommentsLayer } from './Comments'
import { SATELLITE_ATTRIBUTION, planToLatLng, tileZoom, tilesFor } from '../lib/geo'
import type { GeoAnchor, PlanElement, Pt } from '../types'

type Drag =
  | { t: 'move'; start: Pt; orig: Map<string, Pt>; primary: string; moved: boolean }
  | { t: 'pan'; sx: number; sy: number; pan: Pt }
  | { t: 'rotate'; id: string; c: Pt; moved: boolean }
  | { t: 'measure'; a: Pt }
  | { t: 'marquee'; a: Pt; additive: boolean }
  | { t: 'geo'; start: Pt; geo0: GeoAnchor; moved: boolean }
  | { t: 'node'; id: string; index: number; moved: boolean }

const LAYER_ORDER = Object.fromEntries(LAYERS.map((l, i) => [l.id, i]))

/** `review` (phones): drag pans, pinch zooms, tap selects; nothing on the plan can be edited. */
export function FloorCanvas({ review = false }: { review?: boolean }) {
  const s = usePlanStore()
  const { plan, zoom, pan, selection, viewOnly } = s
  const readOnly = viewOnly || review
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<Drag | null>(null)
  // Touch: every finger on the canvas, the pinch in progress, and a press that may still turn out to be a tap
  const pointers = useRef(new Map<number, Pt>())
  const pinch = useRef<{ d0: number; z0: number; world: Pt } | null>(null)
  const tap = useRef<{ x: number; y: number; id: string | null } | null>(null)
  const [cursor, setCursor] = useState<Pt | null>(null)
  const [marquee, setMarquee] = useState<{ a: Pt; b: Pt } | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [menu, setMenu] = useState<MenuState | null>(null)
  const venue = venueOf(plan, s.levelId)
  // A fit asked for while the canvas was hidden (phone tabs) runs once it has a size again
  const pendingFit = useRef(false)
  const fitRef = useRef<() => void>(() => {})

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      setSize({ w: width, h: height })
      if (pendingFit.current && width && height) fitRef.current()
    })
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
    pendingFit.current = !width || !height
    if (pendingFit.current) return
    const z = Math.min(width / venue.widthM, height / venue.heightM) * 0.94
    s.set({ zoom: z, pan: { x: (width - venue.widthM * z) / 2, y: (height - venue.heightM * z) / 2 } })
  }
  fitRef.current = fit

  useEffect(() => {
    canvasRef.current = svgRef.current
    fit()
    const onFit = () => fit()
    window.addEventListener('fp:fit', onFit)
    return () => window.removeEventListener('fp:fit', onFit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, venue.widthM, venue.heightM, s.levelId])

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

  // Centers a point (search results); it lands in the upper part of the view so a bottom sheet doesn't cover it
  useEffect(() => {
    const onFocus = (ev: Event) => {
      const el = svgRef.current
      if (!el) return
      const { x, y, zoom: z } = (ev as CustomEvent<FocusRequest>).detail
      const { width, height } = el.getBoundingClientRect()
      const nz = Math.min(200, Math.max(usePlanStore.getState().zoom, z ?? 0))
      usePlanStore.setState({ zoom: nz, pan: { x: width / 2 - x * nz, y: height * 0.35 - y * nz } })
    }
    window.addEventListener('fp:focus', onFocus)
    return () => window.removeEventListener('fp:focus', onFocus)
  }, [])

  const visible = useMemo(
    () => visibleOnLevel(plan, s.levelId)
      .sort((a, b) => (LAYER_ORDER[a.layer] ?? 0) - (LAYER_ORDER[b.layer] ?? 0) || (a.z ?? 0) - (b.z ?? 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan.elements, plan.layers, plan.groups, plan.levels, s.levelId],
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
    return !e || isLockedEl(plan, e)
  }

  /** Element under the pointer, or the nearest one within a fingertip (~24 px) of it. */
  const hitAt = (target: Element, w: Pt) => {
    const direct = target.closest('[data-id]')?.getAttribute('data-id')
    if (direct) return direct
    let best: string | null = null
    let bestD = 24 / zoom
    for (const e of visible) {
      const d = e.points?.length ? distToShape(w, e, CATALOG[e.kind]?.geometry === 'polygon') : distToRect(w, e)
      if (d < bestD) { bestD = d; best = e.id }
    }
    return best
  }

  const snapPt = (w: Pt) => (s.snapOn ? { x: snap(w.x), y: snap(w.y) } : w)
  const finishDrawing = () => {
    const err = s.finishDrawing()
    if (err) toast(err)
  }

  const pinchCenter = () => {
    const [a, b] = [...pointers.current.values()]
    const r = svgRef.current!.getBoundingClientRect()
    return { mid: { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top }, d: Math.hypot(a.x - b.x, a.y - b.y) }
  }

  const onPointerDown = (ev: React.PointerEvent) => {
    const target = ev.target as Element
    const w = toWorld(ev.clientX, ev.clientY)
    try { svgRef.current!.setPointerCapture(ev.pointerId) } catch { /* pointer already released */ }
    pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })

    // A second finger turns whatever the first one started into a pinch-zoom
    if (pointers.current.size === 2) {
      const { mid, d } = pinchCenter()
      pinch.current = { d0: d || 1, z0: zoom, world: { x: (mid.x - pan.x) / zoom, y: (mid.y - pan.y) / zoom } }
      drag.current = null
      tap.current = null
      setMarquee(null)
      return
    }
    if (pointers.current.size > 2) return

    if (review) {
      tap.current = { x: ev.clientX, y: ev.clientY, id: hitAt(target, w) }
      drag.current = { t: 'pan', sx: ev.clientX, sy: ev.clientY, pan }
      return
    }
    if (ev.button === 1 || ev.altKey) {
      drag.current = { t: 'pan', sx: ev.clientX, sy: ev.clientY, pan }
      return
    }
    // Drawing a line or area: left click adds a point, right click takes the last one back
    if (s.placing && isDrawnKind(s.placing) && !readOnly) {
      if (ev.button === 2) s.undoDrawPoint()
      else if (ev.button === 0) s.drawPoint(s.placing, snapPt(w))
      return
    }
    // Points of the selected line or area
    const handle = target.closest('[data-handle]')
    const kindOfHandle = handle?.getAttribute('data-handle')
    if ((kindOfHandle === 'node' || kindOfHandle === 'mid') && selection.length === 1 && !readOnly) {
      const id = selection[0]
      const index = Number(handle!.getAttribute('data-index'))
      const e = plan.elements.find((x) => x.id === id)
      if (!e?.points) return
      if (kindOfHandle === 'node' && ev.button === 2) {
        const min = CATALOG[e.kind]?.geometry === 'polygon' ? 3 : 2
        if (e.points.length <= min) { toast(`Needs at least ${min} points`); return }
        s.updateElement(id, renormalize({ ...e, points: e.points.filter((_, i) => i !== index) }))
        return
      }
      if (ev.button !== 0) return
      if (kindOfHandle === 'mid') {
        // Dragging a midpoint adds a point there
        s.editPoints(id, (pts) => [...pts.slice(0, index + 1), toLocal(e, snapPt(w)), ...pts.slice(index + 1)])
        drag.current = { t: 'node', id, index: index + 1, moved: true }
      } else {
        drag.current = { t: 'node', id, index, moved: false }
      }
      return
    }
    if (ev.button === 2) {
      // Right-click: select what's under the pointer, then show the menu
      if (readOnly) return
      const hit = hitAt(target, w)
      if (hit && !selection.includes(hit)) s.select([hit])
      if (!hit) s.set({ selection: [] })
      const r = svgRef.current!.getBoundingClientRect()
      setMenu({ x: ev.clientX - r.left, y: ev.clientY - r.top, at: w })
      return
    }
    if (s.tool === 'comment' && !readOnly) {
      s.set({ commentDraft: w, activeComment: null, showComments: true })
      return
    }
    if (s.placing && !readOnly) {
      s.addElement(s.placing, s.snapOn ? { x: snap(w.x), y: snap(w.y) } : w)
      if (!ev.shiftKey) s.set({ placing: null })
      return
    }
    if (s.tool === 'geo' && geo && !readOnly) {
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
    if (hit && (readOnly || !isLocked(hit))) {
      const additive = ev.shiftKey || ev.metaKey || ev.ctrlKey
      if (!selection.includes(hit) || additive) s.select([hit], additive)
      if (readOnly) return
      const ids = additive ? selection.concat(hit) : selection.includes(hit) ? selection : [hit]
      const orig = new Map(plan.elements.filter((e) => ids.includes(e.id) && !isLocked(e.id)).map((e) => [e.id, { x: e.x, y: e.y }]))
      drag.current = { t: 'move', start: w, orig, primary: hit, moved: false }
      return
    }
    if (ev.shiftKey && !readOnly) {
      drag.current = { t: 'marquee', a: w, additive: true }
      setMarquee({ a: w, b: w })
      return
    }
    s.set({ selection: [], highlightTable: null })
    drag.current = { t: 'pan', sx: ev.clientX, sy: ev.clientY, pan }
  }

  const onPointerMove = (ev: React.PointerEvent) => {
    if (pointers.current.has(ev.pointerId)) pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
    const pz = pinch.current
    if (pz && pointers.current.size >= 2) {
      // Zoom by the change in finger spread, keeping the point between the fingers in place
      const { mid, d } = pinchCenter()
      const nz = Math.min(200, Math.max(3, (pz.z0 * d) / pz.d0))
      s.set({ zoom: nz, pan: { x: mid.x - pz.world.x * nz, y: mid.y - pz.world.y * nz } })
      return
    }
    const t = tap.current
    if (t && Math.hypot(ev.clientX - t.x, ev.clientY - t.y) > 6) tap.current = null
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
    } else if (d.t === 'node') {
      if (!d.moved) { s.checkpoint(); d.moved = true }
      const e = plan.elements.find((x) => x.id === d.id)
      if (!e) return
      const p = toLocal(e, snapPt(w))
      s.editPoints(d.id, (pts) => pts.map((q, i) => (i === d.index ? { x: +p.x.toFixed(3), y: +p.y.toFixed(3) } : q)), false)
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

  const onPointerUp = (ev: React.PointerEvent) => {
    pointers.current.delete(ev.pointerId)
    if (pinch.current) {
      if (pointers.current.size < 2) {
        pinch.current = null
        // The finger still down carries on panning from where it is now
        const rest = [...pointers.current.values()][0]
        drag.current = rest ? { t: 'pan', sx: rest.x, sy: rest.y, pan: usePlanStore.getState().pan } : null
      }
      return
    }
    const t = tap.current
    tap.current = null
    if (t && review) {
      const e = t.id ? plan.elements.find((x) => x.id === t.id) : undefined
      s.set({ selection: e ? [e.id] : [], highlightTable: e && isTableKind(e.kind) ? e.id : null })
    }
    const d = drag.current
    if (d?.t === 'node' && d.moved) {
      // Re-center the shape on its new bounding box once the point is dropped
      const e = usePlanStore.getState().plan.elements.find((x) => x.id === d.id)
      if (e) s.updateElement(d.id, renormalize(e), false)
    }
    if (d?.t === 'marquee' && marquee) {
      const x0 = Math.min(marquee.a.x, marquee.b.x), x1 = Math.max(marquee.a.x, marquee.b.x)
      const y0 = Math.min(marquee.a.y, marquee.b.y), y1 = Math.max(marquee.a.y, marquee.b.y)
      const ids = visible.filter((e) => e.x >= x0 && e.x <= x1 && e.y >= y0 && e.y <= y1 && !isLocked(e.id)).map((e) => e.id)
      s.select(ids, d.additive)
      setMarquee(null)
    }
    drag.current = null
  }

  const onPointerCancel = (ev: React.PointerEvent) => {
    pointers.current.delete(ev.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    tap.current = null
    drag.current = null
    setMarquee(null)
  }

  const onDrop = (ev: React.DragEvent) => {
    ev.preventDefault()
    if (readOnly) return
    const w = toWorld(ev.clientX, ev.clientY)
    const kind = ev.dataTransfer.getData('application/x-kind')
    if (kind && isDrawnKind(kind)) {
      s.set({ placing: kind })
      return
    }
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
  const single = selected.length === 1 && !readOnly && !isLocked(selected[0].id) ? selected[0] : null
  const bm = venue.basemap
  const m = s.measure

  return (
    <div className="relative h-full w-full overflow-hidden bg-bg-2">
      <svg
        ref={svgRef}
        className="h-full w-full touch-none select-none"
        style={{ cursor: s.placing ? (isDrawnKind(s.placing) ? 'crosshair' : 'copy') : s.tool === 'measure' || s.tool === 'comment' ? 'crosshair' : s.tool === 'geo' ? 'move' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={() => setCursor(null)}
        onDoubleClick={() => { if (s.drawing) finishDrawing() }}
        onContextMenu={(e) => e.preventDefault()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <g id="world" transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          <rect id="venue-bg" width={venue.widthM} height={venue.heightM} fill="#ffffff" />
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
          {s.showGrid && <Grid w={venue.widthM} h={venue.heightM} />}
          <rect width={venue.widthM} height={venue.heightM} fill="none" stroke="#0a1729" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />

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

          {selected.length === 1 && selected[0].points && (
            <ShapeHandles e={selected[0]} zoom={zoom} editable={!!single} />
          )}
          {s.drawing && <DrawPreview pts={s.drawing.points} cursor={cursor ? snapPt(cursor) : null} kind={s.drawing.kind} zoom={zoom} />}

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

      <CommentsLayer readOnly={readOnly} width={size.w} />
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} onComment={(at) => s.set({ commentDraft: at, activeComment: null, showComments: true })} />}
      {s.tool === 'comment' && !review && (
        <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-ink px-4 py-1.5 text-xs text-on-ink shadow">
          Click the plan to leave a comment · Esc to stop
        </div>
      )}
      <ScaleBar zoom={zoom} />
      {!review && (
        <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-white/90 px-2 py-1 font-mono text-[11px] text-muted shadow-sm">
          {cursor ? `x ${cursor.x.toFixed(2)} m · y ${cursor.y.toFixed(2)} m` : 'Scroll to zoom · drag to pan · Shift+drag to box-select'}
        </div>
      )}
      {s.placing && !review && (
        <div className="absolute left-1/2 top-3 max-w-[90%] -translate-x-1/2 rounded-full bg-ink px-4 py-1.5 text-center text-xs text-on-ink shadow">
          {isDrawnKind(s.placing) ? (
            <>Drawing <b>{CATALOG[s.placing]?.name}</b> · click to add points · double-click or Enter to finish · right-click removes the last point · Esc cancels</>
          ) : (
            <>Click to place <b>{CATALOG[s.placing]?.name}</b> · Shift+click to place several · Esc to cancel</>
          )}
        </div>
      )}
      {s.tool === 'geo' && !review && (
        <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-ink px-4 py-1.5 text-xs text-on-ink shadow">
          Drag to move the satellite under your venue · rotate it in the Venue tab · Esc when done
        </div>
      )}
      {satellite && (
        <>
          <div className={`pointer-events-none absolute right-3 grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow-sm ${review ? 'top-16' : 'top-3'}`} title="North">
            <div className="flex flex-col items-center" style={{ transform: `rotate(${satellite.rotation}deg)` }}>
              <Navigation size={14} className="fill-red-600 text-red-600" />
              <span className="font-mono text-[9px] font-semibold leading-none text-ink">N</span>
            </div>
          </div>
          <div className={`pointer-events-none absolute right-3 rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-muted ${review ? 'bottom-3' : 'bottom-10'}`}>{SATELLITE_ATTRIBUTION}</div>
        </>
      )}
      {issues.length > 0 && !review && (
        <div className="absolute left-3 top-3 rounded-md border border-red-200 bg-white/95 px-3 py-1.5 text-xs text-red-700 shadow-sm">
          {issues.length} aisle {issues.length === 1 ? 'conflict' : 'conflicts'} under {plan.minAisleM} m
        </div>
      )}
    </div>
  )
}

/** Measurement tag in screen pixels, drawn at a plan point. */
function Tag({ at, zoom, children }: { at: Pt; zoom: number; children: React.ReactNode }) {
  return (
    <text x={at.x} y={at.y} textAnchor="middle" dominantBaseline="middle" fontSize={12 / zoom} fontFamily="Geist, Arial" fontWeight={600}
      fill="#ffffff" stroke="#075e99" strokeWidth={5 / zoom} paintOrder="stroke" strokeLinejoin="round">{children}</text>
  )
}

/** The line or area being drawn, with live lengths and area. */
function DrawPreview({ pts, cursor, kind, zoom }: { pts: Pt[]; cursor: Pt | null; kind: string; zoom: number }) {
  const all = cursor ? [...pts, cursor] : pts
  const area = CATALOG[kind]?.geometry === 'polygon'
  const last = pts[pts.length - 1]
  const r = 4 / zoom
  return (
    <g className="no-export" pointerEvents="none">
      {area && all.length > 2 && <polygon points={all.map((p) => `${p.x},${p.y}`).join(' ')} fill="#1ea7e8" fillOpacity={0.12} />}
      <polyline points={all.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#1ea7e8" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={r} fill="#ffffff" stroke="#1ea7e8" strokeWidth={2} vectorEffect="non-scaling-stroke" />)}
      {cursor && last && (
        <Tag at={{ x: (last.x + cursor.x) / 2, y: (last.y + cursor.y) / 2 - 12 / zoom }} zoom={zoom}>{fmtLen(dist(last, cursor))}</Tag>
      )}
      {cursor && all.length > 2 && (
        <Tag at={{ x: cursor.x, y: cursor.y + 22 / zoom }} zoom={zoom}>
          {area ? `${fmtArea(polygonArea(all))} · perimeter ${fmtLen(pathLength(all, true))}` : `Total ${fmtLen(pathLength(all))}`}
        </Tag>
      )}
    </g>
  )
}

/** Points of the selected line or area (drag to move, drag a midpoint to add, right-click to remove) and its measurements. */
function ShapeHandles({ e, zoom, editable }: { e: PlanElement; zoom: number; editable: boolean }) {
  const pts = e.points!
  const area = CATALOG[e.kind]?.geometry === 'polygon'
  const world = pts.map((p) => toPlan(e, p))
  const r = 5 / zoom
  const mids = pts.map((p, i) => {
    const q = pts[i + 1] ?? (area ? pts[0] : undefined)
    return q && { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
  })
  const top = world.reduce((a, b) => (b.y < a.y ? b : a), world[0])
  return (
    <g className="no-export">
      {editable && (
        <g transform={`translate(${e.x} ${e.y}) rotate(${e.rotation})`}>
          {mids.map((m, i) => m && (
            <circle key={`m${i}`} data-handle="mid" data-index={i} cx={m.x} cy={m.y} r={r * 0.7} fill="#1ea7e8" fillOpacity={0.6}
              stroke="#ffffff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" style={{ cursor: 'copy' }}>
              <title>Drag to add a point</title>
            </circle>
          ))}
          {pts.map((p, i) => (
            <circle key={i} data-handle="node" data-index={i} cx={p.x} cy={p.y} r={r} fill="#ffffff" stroke="#1ea7e8"
              strokeWidth={2} vectorEffect="non-scaling-stroke" style={{ cursor: 'grab' }}>
              <title>Drag to move · right-click to remove</title>
            </circle>
          ))}
        </g>
      )}
      <g pointerEvents="none">
        <Tag at={{ x: top.x, y: top.y - 16 / zoom }} zoom={zoom}>
          {area ? `${fmtArea(polygonArea(pts))} · perimeter ${fmtLen(pathLength(pts, true))}` : `Total ${fmtLen(pathLength(pts))}`}
        </Tag>
      </g>
    </g>
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
