import { describe, expect, it } from 'vitest'
import { fromGoogle, parsePlaces } from './geo'

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

describe('Google places', () => {
  const location = { latitude: 25.68, longitude: -100.28 }
  it('leads the label with the venue name', () => {
    expect(fromGoogle({ displayName: { text: 'Parque Fundidora' }, formattedAddress: 'Av. Fundidora 501, Monterrey, N.L., México', location }))
      .toEqual({ label: 'Parque Fundidora, Av. Fundidora 501, Monterrey, N.L., México', lat: 25.68, lng: -100.28 })
  })
  it('does not repeat a name the address already starts with', () => {
    expect(fromGoogle({ displayName: { text: 'Av. Fundidora 501' }, formattedAddress: 'Av. Fundidora 501, Monterrey', location })?.label)
      .toBe('Av. Fundidora 501, Monterrey')
  })
  it('skips places without a location', () => {
    expect(fromGoogle({ displayName: { text: 'Somewhere' } })).toBeNull()
  })
})
