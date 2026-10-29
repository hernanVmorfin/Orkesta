/** Live plan SVG (set by FloorCanvas) for exports and toolbar zoom. */
export const canvasRef: { current: SVGSVGElement | null } = { current: null }
export const requestFit = () => window.dispatchEvent(new Event('fp:fit'))

export interface FocusRequest { x: number; y: number; zoom?: number }
/** Centers the canvas on a plan point (meters), zooming in to at least `zoom` px/m. */
export const requestFocus = (detail: FocusRequest) => window.dispatchEvent(new CustomEvent('fp:focus', { detail }))
