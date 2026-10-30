import { describe, expect, it } from 'vitest'
import { marksAlong, normalize, pathLength, polygonArea, selfIntersects, toLocal, toPlan, worldPoints } from './shapes'
import { colName, cellRef } from './gridref'
import { clearanceIssues } from './geometry'
import { el, planWith, rect, shape } from '../test/fixtures'

describe('lines and areas', () => {
  it('measures open and closed paths', () => {
    const square = rect(0, 0, 10, 10)
    expect(pathLength(square)).toBe(30)
    expect(pathLength(square, true)).toBe(40)
  })

  it('measures area whichever way the points run', () => {
    expect(polygonArea(rect(0, 0, 10, 10))).toBe(100)
    expect(polygonArea([...rect(0, 0, 10, 10)].reverse())).toBe(100)
    expect(polygonArea([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }])).toBe(6)
  })

  it('rejects areas whose edges cross', () => {
    expect(selfIntersects(rect(0, 0, 10, 10))).toBe(false)
    expect(selfIntersects([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 }])).toBe(true)
  })

  it('stores points around the bounding-box center', () => {
    const n = normalize([{ x: 10, y: 10 }, { x: 20, y: 10 }, { x: 20, y: 20 }])
    expect(n).toMatchObject({ x: 15, y: 15, w: 10, h: 10 })
    expect(n.points).toEqual([{ x: -5, y: -5 }, { x: 5, y: -5 }, { x: 5, y: 5 }])
  })

  it('keeps world points through a rotation round trip', () => {
    const e = { ...shape('draw-line', [{ x: 2, y: 3 }, { x: 9, y: 7 }]), rotation: 37 }
    for (const p of worldPoints(e)) {
      const back = toPlan(e, toLocal(e, p))
      expect(back.x).toBeCloseTo(p.x, 9)
      expect(back.y).toBeCloseTo(p.y, 9)
    }
  })

  it('spaces markers evenly along a line', () => {
    expect(marksAlong([{ x: 0, y: 0 }, { x: 10, y: 0 }], 2, 1).map((m) => m.p.x)).toEqual([1, 3, 5, 7, 9])
  })
})

describe('cell references', () => {
  it('names columns like a spreadsheet', () => {
    expect([0, 25, 26, 51, 701, 702].map(colName)).toEqual(['A', 'Z', 'AA', 'AZ', 'ZZ', 'AAA'])
  })

  it('finds the cell of a point', () => {
    const plan = planWith([], { gridRef: { cellM: 10, show: true } })
    expect(cellRef(plan, { x: 11, y: 9.5 })).toBe('B1')
    expect(cellRef(plan, { x: 0, y: 20 })).toBe('A3')
    expect(cellRef({ ...plan, gridRef: { cellM: 10, show: false } }, { x: 11, y: 9.5 })).toBeNull()
  })
})

describe('aisle check', () => {
  // A 10-seat round is 1.8 m across plus a 0.75 m chair zone each side: 3.3 m chair-back to chair-back
  it('flags tables closer than the minimum aisle', () => {
    expect(clearanceIssues([el('round-10', 0, 0), el('round-10', 4, 0)], 1.2)).toHaveLength(1)
  })

  it('passes tables with a full aisle between chairs', () => {
    expect(clearanceIssues([el('round-10', 0, 0), el('round-10', 4.8, 0)], 1.2)).toHaveLength(0)
  })

  it('treats drawn barriers as obstacles but not walking routes', () => {
    const table = el('round-10', 0, 0)
    const across = (kind: string) => shape(kind, [{ x: 2, y: -5 }, { x: 2, y: 5 }])
    expect(clearanceIssues([table, across('crowd-barrier')], 1.2)).toHaveLength(1)
    expect(clearanceIssues([table, across('walk-route')], 1.2)).toHaveLength(0)
  })
})
