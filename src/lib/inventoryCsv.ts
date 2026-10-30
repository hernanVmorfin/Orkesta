import Papa from 'papaparse'
import type { Plan, PlanElement } from '../types'
import { CATALOG, LAYERS } from './catalog'
import { areaOf, lengthOf } from './calcs'
import { inventory, levelName, quantityOf } from './ops'
import { levelsOf } from './levels'

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Inventory export. 'objects' has one row per object (with vendor, times, power and position);
 * 'counts' has one row per object type with totals, for ordering.
 */
export function inventoryCsv(plan: Plan, kind: 'objects' | 'counts', only?: (e: PlanElement) => boolean) {
  if (kind === 'counts') {
    return Papa.unparse(inventory(plan, only).map((l) => ({
      layer: l.layer, type: l.name, objects: l.count, quantity: l.quantity, unit: l.unit,
      total_length_m: l.lengthM ? r2(l.lengthM) : '', total_area_m2: l.areaM2 ? r2(l.areaM2) : '',
    })))
  }
  const multi = levelsOf(plan).length > 1
  return Papa.unparse(plan.elements.filter((e) => !only || only(e)).map((e) => {
    const c = CATALOG[e.kind]
    const { quantity, unit } = quantityOf(e)
    const drawn = !!e.points?.length
    return {
      ...(multi ? { level: levelName(plan, e) } : {}),
      layer: LAYERS.find((l) => l.id === e.layer)?.name ?? e.layer,
      type: c?.name ?? e.kind,
      label: e.label,
      quantity, unit,
      length_m: drawn && c?.geometry !== 'polygon' ? r2(lengthOf(e)) : '',
      area_m2: drawn && c?.geometry === 'polygon' ? r2(areaOf(e)) : '',
      width_m: drawn ? '' : r2(e.w), depth_m: drawn ? '' : r2(e.h),
      seats: e.seats ?? '',
      vendor: e.setup?.vendor ?? '', zone: e.setup?.zone ?? '',
      load_in: e.setup?.inAt?.replace('T', ' ') ?? '', load_out: e.setup?.outAt?.replace('T', ' ') ?? '',
      power_kw: e.setup?.powerKw ?? '',
      x_m: r2(e.x), y_m: r2(e.y), rotation: Math.round(e.rotation),
      notes: e.notes ?? '',
    }
  }))
}
