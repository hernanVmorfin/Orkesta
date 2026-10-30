import { describe, expect, it } from 'vitest'
import { parsePlaces } from './geo'

describe('place search results', () => {
  it('reads Nominatim-style arrays', () => {
    expect(parsePlaces([{ display_name: 'Riverside Hall, Monterrey', lat: '25.67', lon: '-100.31' }]))
      .toEqual([{ label: 'Riverside Hall, Monterrey', lat: 25.67, lng: -100.31 }])
  })

  it('reads GeoJSON feature collections (MapTiler, Mapbox, Geoapify)', () => {
    expect(parsePlaces({ features: [
      { place_name: 'Riverside Hall', center: [-100.31, 25.67] },
      { properties: { formatted: 'Expo Center' }, geometry: { coordinates: [-99.1, 19.4] } },
      { properties: {}, geometry: { coordinates: [0, 0] } },
    ] })).toEqual([
      { label: 'Riverside Hall', lat: 25.67, lng: -100.31 },
      { label: 'Expo Center', lat: 19.4, lng: -99.1 },
    ])
  })

  it('returns nothing for anything else', () => {
    expect(parsePlaces({ error: 'quota' })).toEqual([])
    expect(parsePlaces(null)).toEqual([])
  })
})
