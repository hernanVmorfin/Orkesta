import type { GeoAnchor, Pt } from '../types'

/**
 * Satellite imagery under the plan. Plan coordinates stay in meters from the venue's top-left corner;
 * a GeoAnchor pins that corner to a lat/lng. Distances use a flat-earth approximation, which is
 * accurate to centimeters at venue scale (a few km).
 */

/** Override with VITE_SATELLITE_TILES (a {z}/{x}/{y} template) to use a keyed provider in production. */
export const SATELLITE_URL: string = import.meta.env.VITE_SATELLITE_TILES
  ?? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
export const SATELLITE_ATTRIBUTION: string = import.meta.env.VITE_SATELLITE_ATTRIBUTION
  ?? 'Imagery © Esri, Maxar, Earthstar Geographics'
/** Deepest tile level the provider serves; Esri stops at 19, keyed providers such as MapTiler or Mapbox go to 20–22. */
export const MAX_TILE_ZOOM = Math.min(23, Math.max(17, Number(import.meta.env.VITE_SATELLITE_MAX_ZOOM) || 19))

/**
 * Place search. Defaults to OpenStreetMap Nominatim; set VITE_GEOCODER_URL to a licensed geocoder with `{q}`
 * where the search text goes. Nominatim-style JSON arrays (Nominatim, LocationIQ) and GeoJSON feature
 * collections (MapTiler, Mapbox, Geoapify) are both understood.
 */
const GEOCODER_URL: string = import.meta.env.VITE_GEOCODER_URL
  ?? 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q={q}'
export const GEOCODER_NAME: string = import.meta.env.VITE_GEOCODER_NAME ?? 'OpenStreetMap'

const TILE = 256
const M_PER_DEG = 111320
/** Ground meters per tile pixel at the equator, zoom 0 (Web Mercator, 256 px tiles). */
const EQUATOR_MPP = 156543.03392

const rad = (d: number) => (d * Math.PI) / 180

export interface LatLng { lat: number; lng: number }

/** Turns a vector clockwise by `deg` on screen (x right, y down). */
export function turn(p: Pt, deg: number): Pt {
  const a = rad(deg), c = Math.cos(a), s = Math.sin(a)
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }
}

/** Moves a position by meters east (x) and south (y). */
export function offset(at: LatLng, d: Pt): LatLng {
  return { lat: at.lat - d.y / M_PER_DEG, lng: at.lng + d.x / (M_PER_DEG * Math.cos(rad(at.lat))) }
}

/** Real-world position of a plan point. */
export const planToLatLng = (g: GeoAnchor, p: Pt) => offset(g, turn(p, -g.rotation))

/** Anchor that puts plan point `p` on `at` with the given satellite rotation. */
export function anchorFor(at: LatLng, p: Pt, rotation: number): LatLng {
  const d = turn(p, -rotation)
  return offset(at, { x: -d.x, y: -d.y })
}

const mercX = (lng: number, z: number) => ((lng + 180) / 360) * TILE * 2 ** z
const mercY = (lat: number, z: number) => {
  const s = Math.sin(rad(lat))
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TILE * 2 ** z
}
const metersPerPx = (lat: number, z: number) => (EQUATOR_MPP * Math.cos(rad(lat))) / 2 ** z

/** Tile zoom whose pixels roughly match `pxPerM` screen pixels per meter. */
export function tileZoom(lat: number, pxPerM: number) {
  const z = Math.round(Math.log2(EQUATOR_MPP * Math.cos(rad(lat)) * pxPerM))
  return Math.min(MAX_TILE_ZOOM, Math.max(1, z))
}

/** A tile placed in meters east/south of the anchor (draw inside a group rotated by `rotation`). */
export interface Tile { key: string; url: string; x: number; y: number; size: number }

/** Tiles covering the plan-space polygon `corners`, dropping zoom levels until at most `max` are needed. */
export function tilesFor(g: GeoAnchor, corners: Pt[], z: number, max = 160): Tile[] {
  const mpp = metersPerPx(g.lat, z)
  const x0 = mercX(g.lng, z), y0 = mercY(g.lat, z)
  const px = corners.map((c) => {
    const d = turn(c, -g.rotation)
    return { x: x0 + d.x / mpp, y: y0 + d.y / mpp }
  })
  const n = 2 ** z
  const tx0 = Math.max(0, Math.floor(Math.min(...px.map((p) => p.x)) / TILE))
  const tx1 = Math.min(n - 1, Math.floor(Math.max(...px.map((p) => p.x)) / TILE))
  const ty0 = Math.max(0, Math.floor(Math.min(...px.map((p) => p.y)) / TILE))
  const ty1 = Math.min(n - 1, Math.floor(Math.max(...px.map((p) => p.y)) / TILE))
  if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > max) return z > 1 ? tilesFor(g, corners, z - 1, max) : []
  const size = TILE * mpp
  const tiles: Tile[] = []
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      tiles.push({
        key: `${z}/${tx}/${ty}`,
        url: SATELLITE_URL.replace('{z}', String(z)).replace('{x}', String(tx)).replace('{y}', String(ty)),
        x: (tx * TILE - x0) * mpp,
        y: (ty * TILE - y0) * mpp,
        size,
      })
    }
  }
  return tiles
}

export interface Place extends LatLng { label: string }

const COORDS = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/

/**
 * Pasted "lat, lng" is used as-is; anything else goes to the geocoder (Nominatim by default: free, about
 * 1 request per second, so searches run on submit, never per keystroke).
 */
export async function searchPlaces(q: string): Promise<Place[]> {
  const m = q.match(COORDS)
  if (m) {
    const lat = +m[1], lng = +m[2]
    return Math.abs(lat) <= 85 && Math.abs(lng) <= 180 ? [{ label: `${lat}, ${lng}`, lat, lng }] : []
  }
  const res = await fetch(GEOCODER_URL.replace('{q}', encodeURIComponent(q)), { headers: { 'Accept-Language': navigator.language } })
  if (!res.ok) throw new Error(`Place search failed (${res.status})`)
  return parsePlaces(await res.json())
}

type NominatimHit = { display_name: string; lat: string; lon: string }
type GeoJsonHit = { place_name?: string; properties?: { label?: string; name?: string; formatted?: string; full_address?: string }; center?: [number, number]; geometry?: { coordinates?: [number, number] } }

/** Results from either a Nominatim-style array or a GeoJSON FeatureCollection. */
export function parsePlaces(data: unknown): Place[] {
  if (Array.isArray(data)) return (data as NominatimHit[]).slice(0, 5).map((d) => ({ label: d.display_name, lat: +d.lat, lng: +d.lon }))
  const features = (data as { features?: GeoJsonHit[] })?.features ?? []
  return features.slice(0, 5).flatMap((f) => {
    const c = f.center ?? f.geometry?.coordinates // [lng, lat]
    const label = f.place_name ?? f.properties?.full_address ?? f.properties?.formatted ?? f.properties?.label ?? f.properties?.name
    return c && Number.isFinite(c[0]) && Number.isFinite(c[1]) && label ? [{ label, lat: c[1], lng: c[0] }] : []
  })
}
