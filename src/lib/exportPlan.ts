import { jsPDF } from 'jspdf'
import type { Plan } from '../types'
import { isTableKind } from './catalog'
import { SATELLITE_ATTRIBUTION, tileZoom, tilesFor } from './geo'

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
async function inlineSatellite(group: Element, plan: Plan, pxPerM: number) {
  const g = plan.geo!
  const venue = [{ x: 0, y: 0 }, { x: plan.widthM, y: 0 }, { x: 0, y: plan.heightM }, { x: plan.widthM, y: plan.heightM }]
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
export async function renderPlanPng(svg: SVGSVGElement, plan: Plan, pxWidth: number, opts: { grid: boolean; clearance: boolean }) {
  const pxPerM = pxWidth / plan.widthM
  const pxHeight = Math.round(plan.heightM * pxPerM)
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(pxWidth))
  clone.setAttribute('height', String(pxHeight))
  clone.removeAttribute('class')
  clone.querySelectorAll('.no-export').forEach((n) => n.remove())
  if (!opts.grid) clone.querySelectorAll('.grid').forEach((n) => n.remove())
  if (!opts.clearance) clone.querySelectorAll('.clearance').forEach((n) => n.remove())
  clone.querySelector('#world')?.setAttribute('transform', `scale(${pxPerM})`)
  const img = clone.querySelector('#basemap')
  if (img) {
    try { img.setAttribute('href', await toDataUrl(img.getAttribute('href')!)) } catch { img.remove() }
  }
  const sat = clone.querySelector('.satellite')
  const satDrawn = sat && plan.geo ? await inlineSatellite(sat, plan, pxPerM) : false
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

/** A3 landscape, 300 dpi plan with an iNBest title block. */
export async function exportPdf(svg: SVGSVGElement, plan: Plan, opts = { grid: false, clearance: false }) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
  const W = 420, H = 297, M = 10, side = 92
  const areaW = W - side - M * 3, areaH = H - M * 2
  const scale = Math.min(areaW / plan.widthM, areaH / plan.heightM) // mm per meter
  const pw = plan.widthM * scale, ph = plan.heightM * scale
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

  const tables = plan.elements.filter((e) => isTableKind(e.kind))
  const seats = tables.reduce((n, t) => n + (t.seats ?? 0), 0)
  const assigned = plan.guests.filter((g) => g.tableId).length
  let y = M + 34
  const line = (label: string, value: string) => {
    pdf.setFontSize(7); pdf.setTextColor(100, 199, 245); pdf.text(label.toUpperCase(), x + 8, y)
    pdf.setFontSize(11); pdf.setTextColor(234, 241, 250); pdf.text(value || '-', x + 8, y + 5.5, { maxWidth: side - 16 })
    y += 14
  }
  pdf.setFontSize(18); pdf.setTextColor(234, 241, 250)
  pdf.text(plan.name, x + 8, y, { maxWidth: side - 16 }); y += 16
  line('Venue', plan.venue)
  line('Date', plan.date || 'TBD')
  line('Tables / seats', `${tables.length} tables · ${seats} seats`)
  line('Guests assigned', `${assigned} of ${plan.guests.length}`)
  line('Plan scale', `1:${Math.round(1000 / scale)} on A3 · 1 m = ${scale.toFixed(1)} mm`)
  line('Revision', new Date(plan.updatedAt).toLocaleString())

  // Legend: table tags in use
  pdf.setFontSize(7); pdf.setTextColor(100, 199, 245); pdf.text('TABLE TAGS', x + 8, y); y += 5
  plan.tags.forEach((t) => {
    const n = tables.filter((e) => e.tag === t.id).length
    if (!n) return
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(t.color.slice(i, i + 2), 16))
    pdf.setFillColor(r, g, b); pdf.circle(x + 10, y - 1, 1.6, 'F')
    pdf.setFontSize(9); pdf.setTextColor(234, 241, 250); pdf.text(`${t.name} (${n})`, x + 14, y)
    y += 5.5
  })
  pdf.setFontSize(7); pdf.setTextColor(150, 165, 185)
  pdf.text('Generated with iNBest Floorplan · inbest.cloud', x + 8, H - M - 6)
  pdf.save(`${plan.name.replace(/\W+/g, '-')}-floorplan.pdf`)
}
