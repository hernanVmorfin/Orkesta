import type { PDFDocumentProxy } from 'pdfjs-dist'

/**
 * Venue drawings arrive as PDFs. A page is rendered to an image once, on import, and used like any
 * uploaded basemap. pdf.js (about 1 MB with its worker) loads only when a PDF is opened.
 */

/** Longest side of the rendered page: sharp enough to read room labels, small enough to store. */
const MAX_PX = 4096
/** Above this a PNG data URL is re-encoded as JPEG (scanned drawings and photos compress badly as PNG). */
const MAX_PNG_CHARS = 6_000_000

export async function openPdf(file: File): Promise<PDFDocumentProxy> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
}

export interface RenderedPage {
  src: string
  /** width ÷ height of the page as shown (page rotation applied) */
  aspect: number
  /** printed width of the page, to turn a drawing scale such as 1:100 into meters */
  pageWidthMm: number
}

export async function renderPdfPage(doc: PDFDocumentProxy, pageNumber: number): Promise<RenderedPage> {
  const page = await doc.getPage(pageNumber)
  // At scale 1 a viewport is measured in PDF points (1/72 inch)
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: Math.min(8, MAX_PX / Math.max(base.width, base.height)) })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  await page.render({ canvas, viewport, background: '#ffffff' }).promise
  let src = canvas.toDataURL('image/png')
  if (src.length > MAX_PNG_CHARS) src = canvas.toDataURL('image/jpeg', 0.9)
  page.cleanup()
  return { src, aspect: viewport.width / viewport.height, pageWidthMm: (base.width / 72) * 25.4 }
}

/** Real width in meters of a page printed at 1:`ratio`. */
export const widthAtScale = (pageWidthMm: number, ratio: number) => +((pageWidthMm * ratio) / 1000).toFixed(3)

/** The drawing scale (the 100 in 1:100) a basemap is currently set to, if it came from a PDF. */
export const scaleOf = (widthM: number, pageWidthMm: number) => Math.round((widthM * 1000) / pageWidthMm)
