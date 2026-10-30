import { describe, expect, it } from 'vitest'
import { TEMPLATES } from './templates'
import { clearanceIssues } from '../lib/geometry'
import { arrivalModel, egress, entrances, exitBlockers } from '../lib/ops'
import { isTableKind } from '../lib/catalog'

// Templates are the first thing people see, so they must pass the app's own checks
describe.each(TEMPLATES.map((t) => [t.name, t] as const))('%s template', (_, t) => {
  const plan = t.build()

  it('has no aisle conflicts', () => {
    expect(clearanceIssues(plan.elements, plan.minAisleM).map((i) => `${i.a.label} / ${i.b.label}`)).toEqual([])
  })

  it('keeps every exit approach clear', () => {
    expect(exitBlockers(plan, null).map((b) => b.exit.label)).toEqual([])
  })

  it('has people, exits and entrances for the Ops tab', () => {
    const eg = egress(plan, null)
    expect(eg.occupancy).toBeGreaterThan(0)
    expect(eg.capacity).toBeGreaterThan(0)
    expect(entrances(plan).length).toBeGreaterThan(0)
  })

  it('arrives without a wait over 15 minutes', () => {
    expect(Math.max(...arrivalModel(plan).rows.map((r) => r.waitMin))).toBeLessThanOrEqual(15)
  })

  it('numbers tables 1…n and keeps ids unique', () => {
    expect(new Set(plan.elements.map((e) => e.id)).size).toBe(plan.elements.length)
    const numbers = plan.elements.filter((e) => isTableKind(e.kind)).map((e) => e.number)
    expect(numbers).toEqual(numbers.map((_, i) => i + 1))
  })

  it('fits inside the venue', () => {
    for (const e of plan.elements) {
      expect(e.x, e.label).toBeGreaterThanOrEqual(0)
      expect(e.x, e.label).toBeLessThanOrEqual(plan.widthM)
      expect(e.y, e.label).toBeGreaterThanOrEqual(0)
      expect(e.y, e.label).toBeLessThanOrEqual(plan.heightM)
    }
  })
})
