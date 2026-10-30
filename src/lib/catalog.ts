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
      { kind: 'classroom-table', name: 'Classroom table', layer: 'seating', shape: 'rect', w: 1.8, h: 0.5, color: '#cbd5e1' },
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
      { kind: 'registration', name: 'Registration desk', layer: 'service', shape: 'rect', w: 2.4, h: 0.7, color: '#1ea7e8', calc: 'throughput', calcDefaults: { per15: 45 } },
    ],
  },
  {
    id: 'power', name: 'Power',
    items: [
      { kind: 'generator', name: 'Generator', layer: 'service', shape: 'rect', w: 2.6, h: 1.1, color: '#d97706', calc: 'supply', calcDefaults: { supplyKw: 60 } },
      { kind: 'mains', name: 'Mains power point', layer: 'service', shape: 'icon', w: 0.8, h: 0.8, color: '#d97706', icon: 'PlugZap', calc: 'supply', calcDefaults: { supplyKw: 32 } },
      { kind: 'distro', name: 'Distribution board', layer: 'service', shape: 'rect', w: 0.8, h: 0.6, color: '#f59e0b' },
      { kind: 'light-tower', name: 'Lighting tower', layer: 'service', shape: 'icon', w: 1.2, h: 1.2, color: '#ca8a04', icon: 'Lightbulb' },
    ],
  },
  {
    id: 'lines', name: 'Lines & areas',
    items: [
      { kind: 'crowd-barrier', name: 'Crowd control barrier', layer: 'security', shape: 'line', geometry: 'polyline', w: 0, h: 0, color: '#1d4ed8',
        style: { stroke: '#1d4ed8', strokeWidth: 0.12, pattern: 'ticks' }, calc: 'segments', calcDefaults: { segmentM: 2.2 } },
      { kind: 'fos-barrier', name: 'Front-of-stage barrier', layer: 'security', shape: 'line', geometry: 'polyline', w: 0, h: 0, color: '#7c3aed',
        style: { stroke: '#7c3aed', strokeWidth: 0.18, pattern: 'ticks' }, calc: 'segments', calcDefaults: { segmentM: 1 } },
      { kind: 'mesh-fence', name: 'Mesh fence', layer: 'security', shape: 'line', geometry: 'polyline', w: 0, h: 0, color: '#5b6576',
        style: { stroke: '#5b6576', strokeWidth: 0.1, pattern: 'ticks' }, calc: 'segments', calcDefaults: { segmentM: 3.5 } },
      { kind: 'high-fence', name: 'High perimeter fence', layer: 'security', shape: 'line', geometry: 'polyline', w: 0, h: 0, color: '#0a1729',
        style: { stroke: '#0a1729', strokeWidth: 0.14, pattern: 'ticks' }, calc: 'segments', calcDefaults: { segmentM: 3 } },
      { kind: 'pipe-drape', name: 'Pipe & drape', layer: 'decor', shape: 'line', geometry: 'polyline', w: 0, h: 0, color: '#1c2638',
        style: { stroke: '#1c2638', strokeWidth: 0.1, pattern: 'ticks' }, calc: 'segments', calcDefaults: { segmentM: 3.05 } },
      { kind: 'queue-line', name: 'Queue line (stanchions)', layer: 'wayfinding', shape: 'line', geometry: 'polyline', w: 0, h: 0, color: '#b45309',
        style: { stroke: '#b45309', strokeWidth: 0.05, pattern: 'dots' }, calc: 'posts', calcDefaults: { spacingM: 2 } },
      { kind: 'cone-line', name: 'Cone line', layer: 'safety', shape: 'line', geometry: 'polyline', w: 0, h: 0, color: '#ea580c',
        style: { stroke: '#ea580c', strokeWidth: 0.04, strokeStyle: 'dashed', pattern: 'dots' }, calc: 'posts', calcDefaults: { spacingM: 1.25 } },
      { kind: 'wall-line', name: 'Wall', layer: 'structure', shape: 'line', geometry: 'polyline', w: 0, h: 0, color: '#0a1729',
        style: { stroke: '#0a1729', strokeWidth: 0.2, pattern: 'none' } },
      { kind: 'walk-route', name: 'Walking route', layer: 'wayfinding', shape: 'line', geometry: 'polyline', w: 0, h: 0, color: '#1ea7e8',
        style: { stroke: '#1ea7e8', strokeWidth: 0.35, pattern: 'arrows' }, calc: 'route', calcDefaults: { speedKmh: 5 } },
      { kind: 'vehicle-route', name: 'Vehicle route', layer: 'wayfinding', shape: 'line', geometry: 'polyline', w: 0, h: 0, color: '#f59e0b',
        style: { stroke: '#f59e0b', strokeWidth: 0.6, pattern: 'chevrons' }, calc: 'route', calcDefaults: { speedKmh: 30 } },
      { kind: 'draw-line', name: 'Line', layer: 'notes', shape: 'line', geometry: 'polyline', w: 0, h: 0, color: '#5b6576',
        style: { stroke: '#5b6576', strokeWidth: 0.08, pattern: 'none' } },
      { kind: 'crowd-area', name: 'Standing / crowd area', layer: 'seating', shape: 'zone', geometry: 'polygon', w: 0, h: 0, color: '#ca8a04',
        style: { fill: '#facc15', fillOpacity: 0.28, stroke: '#ca8a04', strokeWidth: 0.08 }, calc: 'crowd', calcDefaults: { sqmPerPerson: 0.5 } },
      { kind: 'draw-area', name: 'Zone (drawn)', layer: 'structure', shape: 'zone', geometry: 'polygon', w: 0, h: 0, color: '#5b6576',
        style: { fill: '#5b6576', fillOpacity: 0.08, stroke: '#5b6576', strokeWidth: 0.08, strokeStyle: 'dashed' } },
      { kind: 'restricted-area', name: 'Restricted area', layer: 'security', shape: 'zone', geometry: 'polygon', w: 0, h: 0, color: '#dc2626',
        style: { fill: '#dc2626', fillOpacity: 0.12, stroke: '#dc2626', strokeWidth: 0.08, strokeStyle: 'dashed' } },
      { kind: 'camping-area', name: 'Camping area', layer: 'structure', shape: 'zone', geometry: 'polygon', w: 0, h: 0, color: '#16a34a',
        style: { fill: '#16a34a', fillOpacity: 0.15, stroke: '#16a34a', strokeWidth: 0.08 }, calc: 'camping', calcDefaults: { sqmPerTent: 18, perTent: 2 } },
      { kind: 'parking-area', name: 'Parking area', layer: 'service', shape: 'zone', geometry: 'polygon', w: 0, h: 0, color: '#475569',
        style: { fill: '#64748b', fillOpacity: 0.15, stroke: '#475569', strokeWidth: 0.08 }, calc: 'parking', calcDefaults: { sqmPerCar: 28.8, perCar: 2 } },
    ],
  },
  {
    id: 'safety', name: 'Safety',
    items: [
      { kind: 'exit', name: 'Emergency exit', layer: 'safety', shape: 'icon', w: 1.1, h: 1.1, color: '#16a34a', icon: 'DoorOpen', calc: 'exit', calcDefaults: { widthM: 1.2, stairs: 0 } },
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
      { kind: 'checkpoint', name: 'Security checkpoint', layer: 'security', shape: 'icon', w: 1, h: 1, color: '#0a1729', icon: 'ShieldCheck', calc: 'throughput', calcDefaults: { per15: 60 } },
      { kind: 'cctv', name: 'CCTV', layer: 'security', shape: 'icon', w: 0.7, h: 0.7, color: '#0a1729', icon: 'Cctv' },
      // Fixed-length pieces from before drawn lines; old plans still use them
      { kind: 'barrier', name: 'Barrier (2 m)', layer: 'security', shape: 'line', w: 2, h: 0.12, color: '#0a1729', hidden: true },
      { kind: 'fence', name: 'Fence (3 m)', layer: 'security', shape: 'line', w: 3, h: 0.12, color: '#5b6576', hidden: true },
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
      { kind: 'wall', name: 'Wall (4 m)', layer: 'structure', shape: 'line', w: 4, h: 0.2, color: '#0a1729', hidden: true },
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

/** How a kind is placed: a sized box, or drawn point by point. */
export const geometryOf = (kind: string) => CATALOG[kind]?.geometry ?? 'box'
export const isDrawnKind = (kind: string) => geometryOf(kind) !== 'box'
