import { TEMPLATES } from '../../data/templates'
import { planThumb, type Thumb } from '../../lib/thumb'

let cache: Map<string, Thumb> | null = null

/** Thumbnails of the starter layouts, built once on first use. */
export function templateThumb(id: string) {
  cache ??= new Map(TEMPLATES.map((t) => [t.id, planThumb(t.build())]))
  return cache.get(id)
}
