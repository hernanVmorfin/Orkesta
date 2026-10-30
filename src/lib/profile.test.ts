import { describe, expect, it } from 'vitest'
import { applyProfile, AVATAR_COLORS, cleanProfile, colorFor, initials, PROFILE_LIMITS, subtitle } from './profile'

const ok = (p: Parameters<typeof cleanProfile>[0]) => {
  const r = cleanProfile(p)
  if (!r.ok) throw new Error(r.error)
  return r.patch
}
const error = (p: Parameters<typeof cleanProfile>[0]) => {
  const r = cleanProfile(p)
  return r.ok ? null : r.error
}
const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=='

describe('profile rules', () => {
  it('tidy names and require one', () => {
    expect(ok({ name: '  Ana   Ruiz ' }).name).toBe('Ana Ruiz')
    expect(error({ name: '   ' })).toBe('Enter your name')
    expect(error({ name: 'x'.repeat(PROFILE_LIMITS.name + 1) })).toMatch(/under 80/)
  })

  it('leave out fields that aren’t being changed', () => {
    expect(ok({ title: 'Event producer' })).toEqual({ title: 'Event producer' })
  })

  it('accept phone numbers with the usual punctuation, and nothing else', () => {
    expect(ok({ phone: '+52 (81) 1234-5678' }).phone).toBe('+52 (81) 1234-5678')
    expect(error({ phone: 'call me' })).toMatch(/phone number/)
    expect(error({ phone: '12' })).toMatch(/phone number/)
    expect(error({ phone: '1'.repeat(PROFILE_LIMITS.phone + 1) })).toMatch(/phone number/)
  })

  it('only allow the avatar palette', () => {
    expect(ok({ color: AVATAR_COLORS[2] }).color).toBe(AVATAR_COLORS[2])
    expect(error({ color: 'red" onload="x' })).toMatch(/colours/)
  })

  it('only allow small image data URLs as photos', () => {
    expect(ok({ photo: PHOTO }).photo).toBe(PHOTO)
    expect(error({ photo: 'https://example.com/me.jpg' })).toMatch(/photo/)
    expect(error({ photo: 'data:image/svg+xml;base64,PHN2Zz4=' })).toMatch(/photo/)
    expect(error({ photo: `data:image/png;base64,${'A'.repeat(PROFILE_LIMITS.photoChars)}` })).toMatch(/photo/)
  })

  it('clear optional fields with an empty value', () => {
    const before = { name: 'Ana', title: 'Producer', company: 'iNBest', phone: '+52 81 1234 5678', color: AVATAR_COLORS[0], photo: PHOTO }
    const after = applyProfile(before, ok({ title: '', company: ' ', phone: '', color: '', photo: '' }))
    expect(after).toEqual({ name: 'Ana' })
  })

  it('never clear the name', () => {
    expect(applyProfile({ name: 'Ana' }, { name: '' })).toEqual({ name: 'Ana' })
  })
})

describe('avatars', () => {
  it('use up to two initials', () => {
    expect(initials('Ana María Ruiz')).toBe('AM')
    expect(initials('ana')).toBe('A')
    expect(initials('  ')).toBe('?')
  })

  it('give each person a steady colour from the palette', () => {
    expect(colorFor('u-owner')).toBe(colorFor('u-owner'))
    expect(AVATAR_COLORS).toContain(colorFor('u-abc123'))
  })

  it('describe someone by title and company', () => {
    expect(subtitle({ title: 'Event producer', company: 'iNBest' })).toBe('Event producer · iNBest')
    expect(subtitle({ company: 'iNBest' })).toBe('iNBest')
    expect(subtitle({})).toBe('')
  })
})
