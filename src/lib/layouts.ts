import type { PlanElement } from '../types'

export type BlockStyle = 'theatre' | 'classroom'
export interface SeatBlockOptions {
  style: BlockStyle
  rows: number
  perRow: number
  /** meters per seat along a row */
  seatW: number
  /** meters between rows */
  rowGap: number
  /** an aisle after every N seats (0 = none) */
  aisleEvery: number
  aisleW: number
  /** classroom: seats per table */
  perTable: number
}

export const blockSize = (o: SeatBlockOptions) => {
  const aisles = o.aisleEvery > 0 ? Math.ceil(o.perRow / o.aisleEvery) - 1 : 0
  return { width: o.perRow * o.seatW + aisles * o.aisleW, depth: o.rows * o.rowGap }
}

/**
 * Rows of chairs (theatre) or tables with chairs behind them (classroom), top-left at (x0, y0).
 * Tables never span an aisle.
 */
export function seatBlock(o: SeatBlockOptions, x0: number, y0: number, levelId?: string): Omit<PlanElement, 'id'>[] {
  const els: Omit<PlanElement, 'id'>[] = []
  const xOf = (k: number) => k * o.seatW + (o.aisleEvery > 0 ? Math.floor(k / o.aisleEvery) * o.aisleW : 0)
  for (let r = 0; r < o.rows; r++) {
    const y = y0 + r * o.rowGap
    if (o.style === 'classroom') {
      let k = 0
      while (k < o.perRow) {
        const end = Math.min(o.perRow, k + o.perTable, o.aisleEvery > 0 ? (Math.floor(k / o.aisleEvery) + 1) * o.aisleEvery : Infinity)
        const n = end - k
        els.push({ kind: 'classroom-table', label: '', x: +(x0 + xOf(k) + (n * o.seatW) / 2).toFixed(3), y: +y.toFixed(3), w: n * o.seatW, h: 0.5, rotation: 0, layer: 'seating', levelId })
        k = end
      }
    }
    for (let k = 0; k < o.perRow; k++) {
      els.push({
        kind: 'chair', label: 'Chair', x: +(x0 + xOf(k) + o.seatW / 2).toFixed(3), y: +(o.style === 'classroom' ? y + 0.5 : y).toFixed(3),
        w: 0.45, h: 0.45, rotation: 0, layer: 'seating', levelId,
      })
    }
  }
  return els
}
