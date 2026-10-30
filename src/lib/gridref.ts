import type { Plan, Pt } from '../types'

/** Column letters: A…Z, AA, AB… */
export function colName(i: number) {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

/** "C4" for a plan point when cell references are on, else null. */
export function cellRef(plan: Plan, p: Pt) {
  const g = plan.gridRef
  if (!g?.show || g.cellM <= 0 || p.x < 0 || p.y < 0) return null
  return `${colName(Math.floor(p.x / g.cellM))}${Math.floor(p.y / g.cellM) + 1}`
}
