import { nanoid } from 'nanoid'
import type { LayerId, Plan } from '../types'

/** Empty starting plan: a 30 × 20 m venue with default table tags and no basemap. */
export function blankPlan(): Plan {
  const layers = Object.fromEntries(
    (['structure', 'staging', 'seating', 'service', 'safety', 'security', 'workforce', 'wayfinding', 'decor', 'notes'] as LayerId[])
      .map((l) => [l, { visible: true, locked: false }]),
  ) as Plan['layers']

  return {
    id: nanoid(10),
    name: 'Untitled event',
    venue: '',
    date: '',
    widthM: 30,
    heightM: 20,
    minAisleM: 1.2,
    elements: [],
    guests: [],
    tags: [
      { id: 'general', name: 'General', color: '#1ea7e8' },
      { id: 'vip', name: 'VIP', color: '#b45309' },
      { id: 'sponsor', name: 'Sponsor', color: '#7c3aed' },
      { id: 'speaker', name: 'Speaker', color: '#16a34a' },
      { id: 'press', name: 'Press', color: '#5b6576' },
      { id: 'staff', name: 'Staff / reserved', color: '#0a1729' },
    ],
    layers,
    updatedAt: Date.now(),
  }
}
