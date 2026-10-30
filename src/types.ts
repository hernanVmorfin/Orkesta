export type LayerId =
  | 'structure' | 'staging' | 'seating' | 'service' | 'safety'
  | 'security' | 'workforce' | 'wayfinding' | 'decor' | 'notes'

export type Shape =
  | 'roundTable' | 'rectTable' | 'cocktail' | 'rect' | 'icon' | 'zone' | 'plant' | 'line' | 'text' | 'circle'

export interface Pt { x: number; y: number }

/** 'box' is a sized object; lines and areas are drawn point by point. */
export type Geometry = 'box' | 'polyline' | 'polygon'

/** Built-in calculators shown in the Inspector (see lib/calcs.ts). */
export type CalcId = 'crowd' | 'segments' | 'posts' | 'route' | 'camping' | 'parking' | 'exit' | 'throughput' | 'supply'

export type LinePattern = 'none' | 'arrows' | 'chevrons' | 'ticks' | 'dots'

export interface ElementStyle {
  fill?: string
  fillOpacity?: number
  stroke?: string
  /** meters */
  strokeWidth?: number
  strokeStyle?: 'solid' | 'dashed' | 'dotted'
  pattern?: LinePattern
}

/** Vendor and logistics details, any object. */
export interface ObjectSetup {
  vendor?: string
  zone?: string
  /** local date-time, "YYYY-MM-DDTHH:mm" */
  inAt?: string
  outAt?: string
  /** power the object draws, kW */
  powerKw?: number
}

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
  geometry?: Geometry
  style?: ElementStyle
  calc?: CalcId
  /** calculator defaults, e.g. { segmentM: 2.2 } */
  calcDefaults?: Record<string, number>
  /** kept for old plans, not offered in the library */
  hidden?: boolean
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
  /** lines and areas: vertices relative to (x, y), before rotation; w/h are their bounding box */
  points?: Pt[]
  style?: ElementStyle
  /** stacking order within its layer */
  z?: number
  hidden?: boolean
  setup?: ObjectSetup
  /** calculator inputs */
  calc?: Record<string, number>
  /** missing = the first level */
  levelId?: string
  groupId?: string
}

export interface Level {
  id: string
  name: string
  /** own footprint and drawing; missing = the venue's */
  widthM?: number
  heightM?: number
  basemap?: Basemap
}

/** A named folder of objects inside a layer. */
export interface Group { id: string; name: string; layer: LayerId; visible: boolean; locked: boolean }

export interface CommentReply { id: string; author: string; body: string; createdAt: number }
export interface PlanComment extends CommentReply {
  x: number
  y: number
  levelId?: string
  resolved?: boolean
  replies: CommentReply[]
}

export interface SafetySettings {
  /** persons per meter of exit width per minute on level routes */
  flowRate: number
  /** overrides the computed occupancy */
  crowdSize?: number
  /** assume the widest exit is unavailable */
  worstCase: boolean
  /** objects closer than this to an exit are flagged, meters */
  exitClearM: number
}

/** Arrival queue model: expected arrivals per 15 minutes from `start`. */
export interface ArrivalModel { start: string; slots: number[] }

/** Cell references (A1, B2…) drawn over the venue. */
export interface GridRef { cellM: number; show: boolean }

export interface CustomItem { kind: string; name: string; w: number; h: number; color: string; round?: boolean; layer: LayerId; icon?: string }

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
  /** real-world width of the image in meters (height derived from aspect) */
  widthM: number
  aspect: number
  x: number
  y: number
  opacity: number
  /** printed page width when imported from a PDF, so a drawing scale (1:100) can size it */
  pageWidthMm?: number
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
  /** Shared with a team: the server holds the latest copy, its people and roles. Copies and imports start unshared. */
  shared?: boolean
  /** missing = one level */
  levels?: Level[]
  groups?: Group[]
  comments?: PlanComment[]
  safety?: SafetySettings
  arrival?: ArrivalModel
  gridRef?: GridRef
  customItems?: CustomItem[]
}
