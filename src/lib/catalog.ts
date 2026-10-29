import type { CatalogItem, LayerId } from '../types'

export const LAYERS: { id: LayerId; name: string }[] = [
  { id: 'structure', name: 'Venue structure' },
  { id: 'staging', name: 'Staging & AV' },
  { id: 'seating', name: 'Seating' },
  { id: 'service', name: 'Catering & service' },
  { id: 'safety', name: 'Safety' },
  { id: 'security', name: 'Security' },
  { id: 'workforce', name: 'Workforce' },
  { id: 'wayfinding', name: 'Wayfinding & branding' },
  { id: 'decor', name: 'Decor' },
  { id: 'notes', name: 'Notes' },
]

export const LIBRARY_GROUPS: { id: string; name: string; items: CatalogItem[] }[] = [
  {
    id: 'seating', name: 'Seating',
    items: [
      { kind: 'round-10', name: 'Round table 10p', layer: 'seating', shape: 'roundTable', w: 1.8, h: 1.8, seats: 10, color: '#ffffff' },
      { kind: 'round-8', name: 'Round table 8p', layer: 'seating', shape: 'roundTable', w: 1.5, h: 1.5, seats: 8, color: '#ffffff' },
      { kind: 'banquet-8', name: 'Banquet 2.4 m', layer: 'seating', shape: 'rectTable', w: 2.4, h: 0.76, seats: 8, color: '#ffffff' },
      { kind: 'imperial-12', name: 'Imperial 3.6 m', layer: 'seating', shape: 'rectTable', w: 3.6, h: 1.2, seats: 12, color: '#ffffff' },
      { kind: 'cocktail', name: 'Cocktail table', layer: 'seating', shape: 'cocktail', w: 0.8, h: 0.8, color: '#ffffff' },
      { kind: 'chair', name: 'Chair', layer: 'seating', shape: 'rect', w: 0.45, h: 0.45, color: '#5b6576' },
    ],
  },
  {
    id: 'staging', name: 'Staging & AV',
    items: [
      { kind: 'stage', name: 'Stage', layer: 'staging', shape: 'rect', w: 12, h: 4.8, color: '#0a1729' },
      { kind: 'podium', name: 'Podium', layer: 'staging', shape: 'icon', w: 0.8, h: 0.8, color: '#075e99', icon: 'Mic' },
      { kind: 'screen', name: 'LED screen', layer: 'staging', shape: 'rect', w: 6, h: 0.3, color: '#1c2638' },
      { kind: 'speaker', name: 'Speaker', layer: 'staging', shape: 'rect', w: 1.2, h: 0.4, color: '#1c2638' },
      { kind: 'photowall', name: 'Photo wall', layer: 'staging', shape: 'rect', w: 3, h: 0.2, color: '#7c3aed' },
      { kind: 'foh', name: 'FOH / control', layer: 'staging', shape: 'rect', w: 2.4, h: 1.2, color: '#1c2638' },
      { kind: 'camera', name: 'Camera position', layer: 'staging', shape: 'icon', w: 0.8, h: 0.8, color: '#075e99', icon: 'Camera' },
    ],
  },
  {
    id: 'service', name: 'Catering & service',
    items: [
      { kind: 'bar', name: 'Cocktail bar', layer: 'service', shape: 'rect', w: 0.85, h: 2.7, color: '#b45309' },
      { kind: 'waiter', name: 'Waiter station', layer: 'service', shape: 'rect', w: 0.85, h: 2.7, color: '#64748b' },
      { kind: 'buffet', name: 'Buffet line', layer: 'service', shape: 'rect', w: 4.8, h: 0.9, color: '#b45309' },
      { kind: 'registration', name: 'Registration desk', layer: 'service', shape: 'rect', w: 2.4, h: 0.7, color: '#1ea7e8' },
    ],
  },
  {
    id: 'safety', name: 'Safety',
    items: [
      { kind: 'exit', name: 'Emergency exit', layer: 'safety', shape: 'icon', w: 1.1, h: 1.1, color: '#16a34a', icon: 'DoorOpen' },
      { kind: 'extinguisher', name: 'Fire extinguisher', layer: 'safety', shape: 'icon', w: 0.8, h: 0.8, color: '#dc2626', icon: 'Flame' },
      { kind: 'firstaid', name: 'First aid', layer: 'safety', shape: 'icon', w: 1, h: 1, color: '#16a34a', icon: 'Cross' },
      { kind: 'aed', name: 'AED', layer: 'safety', shape: 'icon', w: 0.8, h: 0.8, color: '#16a34a', icon: 'HeartPulse' },
      { kind: 'assembly', name: 'Assembly point', layer: 'safety', shape: 'icon', w: 1.2, h: 1.2, color: '#16a34a', icon: 'Flag' },
      { kind: 'accessible', name: 'Accessible route', layer: 'safety', shape: 'icon', w: 0.9, h: 0.9, color: '#075e99', icon: 'Accessibility' },
    ],
  },
  {
    id: 'security', name: 'Security',
    items: [
      { kind: 'checkpoint', name: 'Security checkpoint', layer: 'security', shape: 'icon', w: 1, h: 1, color: '#0a1729', icon: 'ShieldCheck' },
      { kind: 'cctv', name: 'CCTV', layer: 'security', shape: 'icon', w: 0.7, h: 0.7, color: '#0a1729', icon: 'Cctv' },
      { kind: 'barrier', name: 'Barrier (2 m)', layer: 'security', shape: 'line', w: 2, h: 0.12, color: '#0a1729' },
      { kind: 'fence', name: 'Fence (3 m)', layer: 'security', shape: 'line', w: 3, h: 0.12, color: '#5b6576' },
    ],
  },
  {
    id: 'workforce', name: 'Workforce',
    items: [
      { kind: 'staff-security', name: 'Security guard', layer: 'workforce', shape: 'icon', w: 0.75, h: 0.75, color: '#0a1729', icon: 'ShieldCheck' },
      { kind: 'staff-steward', name: 'Steward / usher', layer: 'workforce', shape: 'icon', w: 0.75, h: 0.75, color: '#1ea7e8', icon: 'Hand' },
      { kind: 'staff-volunteer', name: 'Volunteer', layer: 'workforce', shape: 'icon', w: 0.75, h: 0.75, color: '#0ea5a4', icon: 'Users' },
      { kind: 'staff-manager', name: 'Event manager', layer: 'workforce', shape: 'icon', w: 0.75, h: 0.75, color: '#075e99', icon: 'Briefcase' },
      { kind: 'staff-av', name: 'AV technician', layer: 'workforce', shape: 'icon', w: 0.75, h: 0.75, color: '#7c3aed', icon: 'Radio' },
      { kind: 'staff-host', name: 'Host / hostess', layer: 'workforce', shape: 'icon', w: 0.75, h: 0.75, color: '#db2777', icon: 'UserCheck' },
    ],
  },
  {
    id: 'wayfinding', name: 'Wayfinding & branding',
    items: [
      { kind: 'sign', name: 'Directional sign', layer: 'wayfinding', shape: 'icon', w: 0.8, h: 0.8, color: '#1ea7e8', icon: 'Signpost' },
      { kind: 'arrow', name: 'Flow arrow', layer: 'wayfinding', shape: 'icon', w: 0.9, h: 0.9, color: '#1ea7e8', icon: 'ArrowUp' },
      { kind: 'banner', name: 'Sponsor banner', layer: 'wayfinding', shape: 'rect', w: 2, h: 0.15, color: '#1ea7e8' },
      { kind: 'totem', name: 'Branding totem', layer: 'wayfinding', shape: 'icon', w: 0.8, h: 0.8, color: '#075e99', icon: 'Megaphone' },
    ],
  },
  {
    id: 'decor', name: 'Decor & structure',
    items: [
      { kind: 'plant', name: 'Plant', layer: 'decor', shape: 'plant', w: 1.8, h: 1.8, color: '#16a34a' },
      { kind: 'tent', name: 'Tent / carpa', layer: 'structure', shape: 'zone', w: 20, h: 20, color: '#075e99' },
      { kind: 'zone', name: 'Zone', layer: 'structure', shape: 'zone', w: 6, h: 4, color: '#5b6576' },
      { kind: 'wall', name: 'Wall (4 m)', layer: 'structure', shape: 'line', w: 4, h: 0.2, color: '#0a1729' },
      { kind: 'note', name: 'Text note', layer: 'notes', shape: 'text', w: 4, h: 0.8, color: '#0a1729' },
    ],
  },
]

export const CATALOG: Record<string, CatalogItem> = Object.fromEntries(
  LIBRARY_GROUPS.flatMap((g) => g.items).map((i) => [i.kind, i]),
)

export const isTableKind = (kind: string) => {
  const s = CATALOG[kind]?.shape
  return s === 'roundTable' || s === 'rectTable'
}
