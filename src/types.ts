export type LayerId =
  | 'structure' | 'staging' | 'seating' | 'service' | 'safety'
  | 'security' | 'workforce' | 'wayfinding' | 'decor' | 'notes'

export type Shape =
  | 'roundTable' | 'rectTable' | 'cocktail' | 'rect' | 'icon' | 'zone' | 'plant' | 'line' | 'text'

export interface Pt { x: number; y: number }

export interface CatalogItem {
  kind: string
  name: string
  layer: LayerId
  shape: Shape
  /** width / height in meters */
  w: number
  h: number
  color: string
  icon?: string
  seats?: number
}

export interface PlanElement {
  id: string
  kind: string
  label: string
  /** center position in meters */
  x: number
  y: number
  w: number
  h: number
  rotation: number
  layer: LayerId
  locked?: boolean
  seats?: number
  number?: number
  tag?: string
  color?: string
  notes?: string
}

export interface Guest {
  id: string
  name: string
  company?: string
  group?: string
  email?: string
  dietary?: string
  tableId?: string | null
  checkedIn?: boolean
  /** table tag id (VIP, Sponsor…); auto-seat puts the guest at tables with the same tag */
  tag?: string
}

export interface TableTag { id: string; name: string; color: string }

export interface Basemap {
  src: string
  /** original upload name, shown in the template controls */
  name?: string
  /** real-world width of the image in meters (height derived from aspect) */
  widthM: number
  aspect: number
  x: number
  y: number
  rotation?: number
  opacity: number
  locked?: boolean
}

/** Pins the plan to the real world so satellite imagery can be drawn under it. */
export interface GeoAnchor {
  /** real-world position of the plan origin (venue top-left corner) */
  lat: number
  lng: number
  /** degrees the satellite is turned clockwise under the plan (0 = north up) */
  rotation: number
  opacity: number
  /** place name from search */
  label?: string
}

export interface LayerState { visible: boolean; locked: boolean }

export interface Plan {
  id: string
  name: string
  venue: string
  date: string
  widthM: number
  heightM: number
  minAisleM: number
  elements: PlanElement[]
  guests: Guest[]
  tags: TableTag[]
  basemap?: Basemap
  geo?: GeoAnchor
  layers: Record<LayerId, LayerState>
  updatedAt: number
}
