import { jsPDF } from 'jspdf'
import type { Plan } from '../types'
import { CATALOG, isTableKind } from './catalog'
import { SATELLITE_ATTRIBUTION, tileZoom, tilesFor } from './geo'
import { activeLevel, levelsOf, onLevel, venueOf } from './levels'
import { arrivalModel, egress, entrances, inventory, powerBudget, vendorsOf } from './ops'

export interface ExportOptions {
  grid: boolean
  clearance: boolean
  /** only these elements (vendor/layer exports) */
  only?: Set<string>
  /** level to export (the one on screen) */
  levelId?: string | null
  /** shown in the title block, e.g. "Vendor: Acme" */
  subtitle?: string
}

async function toDataUrl(src: string): Promise<string> {
  if (src.startsWith('data:')) return src
  const blob = await (await fetch(src)).blob()
  return new Promise((res) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.readAsDataURL(blob)
  })
}

/**
 * The on-screen satellite only covers the visible area at screen resolution, and an SVG rendered
 * as an image can't load remote tiles. Rebuild it for the whole venue at export resolution with
 * tiles inlined as data URLs. Returns false when no tile could be loaded.
 */
async function inlineSatellite(group: Element, plan: Plan, pxPerM: number, w: number, h: number) {
  const g = plan.geo!
  const venue = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: 0, y: h }, { x: w, y: h }]
  const tiles = tilesFor(g, venue, tileZoom(g.lat, pxPerM), 400)
  group.replaceChildren()
  for (let i = 0; i < tiles.length; i += 16) {
    await Promise.all(tiles.slice(i, i + 16).map(async (t) => {
      try {
        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image')
        img.setAttribute('href', await toDataUrl(t.url))
        img.setAttribute('x', String(t.x)); img.setAttribute('y', String(t.y))
        img.setAttribute('width', String(t.size * 1.004)); img.setAttribute('height', String(t.size * 1.004))
        img.setAttribute('preserveAspectRatio', 'none')
        group.appendChild(img)
      } catch { /* a missing tile stays blank */ }
    }))
  }
  return group.childElementCount > 0
}

/** Clones the live SVG, fits the whole venue, strips UI-only nodes and rasterises it. */
export async function renderPlanPng(svg: SVGSVGElement, plan: Plan, pxWidth: number, opts: ExportOptions) {
  const { widthM, heightM } = venueOf(plan, opts.levelId ?? null)
  const pxPerM = pxWidth / widthM
  const pxHeight = Math.round(heightM * pxPerM)
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(pxWidth))
  clone.setAttribute('height', String(pxHeight))
  clone.removeAttribute('class')
  clone.querySelectorAll('.no-export').forEach((n) => n.remove())
  if (!opts.grid) clone.querySelectorAll('.grid').forEach((n) => n.remove())
  if (!opts.clearance) clone.querySelectorAll('.clearance').forEach((n) => n.remove())
  if (opts.only) clone.querySelectorAll('[data-id]').forEach((n) => { if (!opts.only!.has(n.getAttribute('data-id')!)) n.remove() })
  clone.querySelector('#world')?.setAttribute('transform', `scale(${pxPerM})`)
  const img = clone.querySelector('#basemap')
  if (img) {
    try { img.setAttribute('href', await toDataUrl(img.getAttribute('href')!)) } catch { img.remove() }
  }
  const sat = clone.querySelector('.satellite')
  const satDrawn = sat && plan.geo ? await inlineSatellite(sat, plan, pxPerM, widthM, heightM) : false
  const xml = new XMLSerializer().serializeToString(clone)
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))
  const image = new Image()
  await new Promise<void>((res, rej) => { image.onload = () => res(); image.onerror = rej; image.src = url })
  const canvas = document.createElement('canvas')
  canvas.width = pxWidth
  canvas.height = pxHeight
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, pxWidth, pxHeight)
  ctx.drawImage(image, 0, 0)
  URL.revokeObjectURL(url)
  if (satDrawn) {
    // Imagery providers require visible attribution on every rendered map
    const fs = Math.max(12, Math.round(pxWidth / 160))
    ctx.font = `${fs}px Geist, Arial, sans-serif`
    const tw = ctx.measureText(SATELLITE_ATTRIBUTION).width
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillRect(pxWidth - tw - fs * 1.2, pxHeight - fs * 1.8, tw + fs * 1.2, fs * 1.8)
    ctx.fillStyle = '#0a1729'
    ctx.fillText(SATELLITE_ATTRIBUTION, pxWidth - tw - fs * 0.6, pxHeight - fs * 0.6)
  }
  return { dataUrl: canvas.toDataURL('image/png'), pxWidth, pxHeight }
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) || 0) as [number, number, number]

/** A3 landscape, 300 dpi plan with an iNBest title block and legend, plus an inventory and safety page. */
export async function exportPdf(svg: SVGSVGElement, plan: Plan, opts: ExportOptions = { grid: false, clearance: false }) {
  const levelId = opts.levelId ?? null
  const { widthM, heightM } = venueOf(plan, levelId)
  const level = activeLevel(plan, levelId)
  const multiLevel = levelsOf(plan).length > 1
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
  const W = 420, H = 297, M = 10, side = 92
  const areaW = W - side - M * 3, areaH = H - M * 2
  const scale = Math.min(areaW / widthM, areaH / heightM) // mm per meter
  const pw = widthM * scale, ph = heightM * scale
  const { dataUrl } = await renderPlanPng(svg, plan, Math.round((pw / 25.4) * 300), opts)
  pdf.addImage(dataUrl, 'PNG', M, M + (areaH - ph) / 2, pw, ph, undefined, 'FAST')

  // Title block
  const x = W - side - M
  pdf.setFillColor(10, 23, 41)
  pdf.rect(x, M, side, H - M * 2, 'F')
  try {
    const logo = await toDataUrl('/brand/logo-inbest.png')
    const li = new Image(); li.src = logo; await li.decode()
    const lw = 40, lh = (li.height / li.width) * lw
    // white logo on navy: draw through a canvas with inverted pixels
    const c = document.createElement('canvas'); c.width = li.width; c.height = li.height
    const cx = c.getContext('2d')!; cx.filter = 'brightness(0) invert(1)'; cx.drawImage(li, 0, 0)
    pdf.addImage(c.toDataURL('image/png'), 'PNG', x + 8, M + 8, lw, lh)
  } catch { /* logo optional */ }

  const onPage = plan.elements.filter((e) => onLevel(e, level.id) && !e.hidden && (!opts.only || opts.only.has(e.id)))
  const tables = onPage.filter((e) => isTableKind(e.kind))
  const seats = tables.reduce((n, t) => n + (t.seats ?? 0), 0)
  const assigned = plan.guests.filter((g) => g.tableId && tables.some((t) => t.id === g.tableId)).length
  let y = M + 34
  const line = (label: string, value: string) => {
    pdf.setFontSize(7); pdf.setTextColor(100, 199, 245); pdf.text(label.toUpperCase(), x + 8, y)
    pdf.setFontSize(11); pdf.setTextColor(234, 241, 250); pdf.text(value || '-', x + 8, y + 5.5, { maxWidth: side - 16 })
    y += 13
  }
  pdf.setFontSize(18); pdf.setTextColor(234, 241, 250)
  pdf.text(plan.name, x + 8, y, { maxWidth: side - 16 }); y += 14
  if (opts.subtitle) { pdf.setFontSize(9); pdf.setTextColor(100, 199, 245); pdf.text(opts.subtitle, x + 8, y, { maxWidth: side - 16 }); y += 9 }
  line('Venue', [plan.venue, multiLevel ? level.name : ''].filter(Boolean).join(' · '))
  line('Date', plan.date || 'TBD')
  if (tables.length) line('Tables / seats', `${tables.length} tables · ${seats} seats · ${assigned} guests seated`)
  line('Plan scale', `1:${Math.round(1000 / scale)} on A3 · 1 m = ${scale.toFixed(1)} mm`)
  line('Revision', new Date(plan.updatedAt).toLocaleString())

  // Legend: table tags, then every object type on the page
  const legendRow = (color: string, text: string) => {
    pdf.setFillColor(...rgb(color)); pdf.circle(x + 10, y - 1, 1.5, 'F')
    pdf.setFontSize(8.5); pdf.setTextColor(234, 241, 250); pdf.text(text, x + 14, y, { maxWidth: side - 22 })
    y += 4.8
  }
  const usedTags = plan.tags.filter((t) => tables.some((e) => e.tag === t.id))
  if (usedTags.length) {
    pdf.setFontSize(7); pdf.setTextColor(100, 199, 245); pdf.text('TABLE TAGS', x + 8, y); y += 4.5
    usedTags.forEach((t) => legendRow(t.color, `${t.name} (${tables.filter((e) => e.tag === t.id).length})`))
    y += 2
  }
  const kinds = new Map<string, number>()
  onPage.filter((e) => !isTableKind(e.kind)).forEach((e) => kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + 1))
  if (kinds.size) {
    pdf.setFontSize(7); pdf.setTextColor(100, 199, 245); pdf.text('LEGEND', x + 8, y); y += 4.5
    const room = Math.floor((H - M - 14 - y) / 4.8)
    const list = [...kinds.entries()].sort((a, b) => b[1] - a[1])
    list.slice(0, Math.max(0, list.length > room ? room - 1 : room)).forEach(([k, n]) => {
      const c = CATALOG[k]
      legendRow(c?.style?.stroke ?? c?.color ?? '#5b6576', `${c?.name ?? k}${n > 1 ? ` × ${n}` : ''}`)
    })
    if (list.length > room) { pdf.setFontSize(8); pdf.setTextColor(150, 165, 185); pdf.text(`+ ${list.length - room + 1} more types (see page 2)`, x + 14, y) }
  }
  pdf.setFontSize(7); pdf.setTextColor(150, 165, 185)
  pdf.text('Generated with iNBest Floorplan · inbest.cloud', x + 8, H - M - 6)

  summaryPage(pdf, plan, levelId, opts)
  pdf.save(`${plan.name.replace(/\W+/g, '-')}${opts.subtitle ? '-filtered' : ''}-floorplan.pdf`)
}

/** Page 2: inventory counts, evacuation and arrival figures, power and vendors. */
function summaryPage(pdf: jsPDF, plan: Plan, levelId: string | null, opts: ExportOptions) {
  const only = opts.only
  const inv = inventory(plan, only ? (e) => only.has(e.id) : undefined)
  if (!inv.length) return
  pdf.addPage('a3', 'landscape')
  const M = 14
  pdf.setFontSize(18); pdf.setTextColor(10, 23, 41); pdf.text(`${plan.name}: inventory and operations`, M, M + 4)
  if (opts.subtitle) { pdf.setFontSize(10); pdf.setTextColor(7, 94, 153); pdf.text(opts.subtitle, M, M + 11) }

  // Inventory table (left)
  let y = M + 22
  const head = (t: string, x: number) => { pdf.setFontSize(8); pdf.setTextColor(91, 101, 118); pdf.text(t.toUpperCase(), x, y) }
  head('Layer', M); head('Type', M + 46); head('Objects', M + 130); head('Quantity', M + 152); head('Length / area', M + 184)
  y += 6
  pdf.setFontSize(9.5); pdf.setTextColor(10, 23, 41)
  for (const l of inv) {
    if (y > 280) { pdf.setFontSize(8); pdf.setTextColor(91, 101, 118); pdf.text('… more in the inventory CSV export', M, y); break }
    pdf.text(l.layer, M, y); pdf.text(l.name, M + 46, y, { maxWidth: 80 })
    pdf.text(String(l.count), M + 130, y)
    pdf.text(l.unit === 'pcs' ? '' : `${l.quantity} ${l.unit}`, M + 152, y)
    pdf.text(l.lengthM ? `${l.lengthM.toFixed(1)} m` : l.areaM2 ? `${Math.round(l.areaM2).toLocaleString()} m²` : '', M + 184, y)
    y += 5.6
  }

  // Operations (right)
  const X = 240
  let ry = M + 22
  const block = (title: string, rows: [string, string][]) => {
    pdf.setFontSize(8); pdf.setTextColor(91, 101, 118); pdf.text(title.toUpperCase(), X, ry); ry += 6
    pdf.setFontSize(10); pdf.setTextColor(10, 23, 41)
    rows.forEach(([k, v]) => { pdf.text(k, X, ry); pdf.text(v, X + 80, ry, { maxWidth: 85 }); ry += 5.8 })
    ry += 5
  }
  const eg = egress(plan, levelId)
  const lv = activeLevel(plan, levelId)
  block(`Evacuation${levelsOf(plan).length > 1 ? ` · ${lv.name}` : ''}`, eg.exits.length ? [
    ['People', `${eg.occupancy.toLocaleString()}${eg.overridden ? ' (set by hand)' : ` (${eg.seats} seated + ${eg.standing} standing)`}`],
    ['Exits', `${eg.exits.length}${eg.lost ? `, without the widest (${eg.lost.label})` : ''}`],
    ['Exit flow', `${Math.round(eg.capacity)} people/min`],
    ['Time to clear', Number.isFinite(eg.minutes) ? `${eg.minutes.toFixed(1)} min` : 'no usable exits'],
  ] : [['Exits', 'none placed']])
  const ents = entrances(plan)
  if (ents.length) {
    const { rows, capacity } = arrivalModel(plan)
    const peak = rows.reduce((a, b) => (b.queue > a.queue ? b : a), rows[0])
    block('Arrivals', [
      ['Entrances', `${ents.length} · ${capacity} people / 15 min`],
      ['Longest queue', peak?.queue ? `${peak.queue} people · ~${peak.lengthM} m · ${peak.waitMin.toFixed(0)} min wait at ${peak.time}` : 'none'],
    ])
  }
  const pb = powerBudget(plan)
  if (pb.zones.length) block('Power', [['Supply / draw', `${pb.supply} kW / ${pb.draw.toFixed(1)} kW${pb.draw > pb.supply ? ' (short)' : ''}`],
    ...pb.zones.slice(0, 6).map((z) => [z.zone, `${z.supply} / ${z.draw.toFixed(1)} kW`] as [string, string])])
  const vendors = vendorsOf(plan)
  const objectsOf = (v: string) => plan.elements.filter((e) => e.setup?.vendor?.trim() === v).length
  if (vendors.length) block('Vendors', vendors.slice(0, 12).map((v) => [v, `${objectsOf(v)} object${objectsOf(v) === 1 ? '' : 's'}`] as [string, string]))
  pdf.setFontSize(7.5); pdf.setTextColor(91, 101, 118)
  pdf.text('Estimates for planning only. Check evacuation figures against your local fire code and the venue’s approved capacity.', X, 282, { maxWidth: 165 })
}
