/** Live plan SVG (set by FloorCanvas) for exports and toolbar zoom. */
export const canvasRef: { current: SVGSVGElement | null } = { current: null }
export const requestFit = () => window.dispatchEvent(new Event('fp:fit'))
