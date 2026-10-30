import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Plan } from '../types'
import { decryptShared, protectedShareUrl, readShared, shareUrl } from './share'
import { el, planWith } from '../test/fixtures'

// Links are built from and read back out of the page address
const page = { href: 'https://plan.example.com/', hash: '' }
beforeEach(() => { vi.stubGlobal('window', { location: page }) })
afterEach(() => { vi.unstubAllGlobals(); page.hash = '' })

const open = (url: string) => { page.hash = new URL(url).hash; return readShared() }
const payload = (url: string) => new URLSearchParams(new URL(url).hash.slice(1)).get('plan')!

const event = (): Plan => planWith([el('round-10', 5, 5, { id: 't1' })], {
  name: 'Gala',
  guests: [{ id: 'g1', name: 'Ana Ruiz', email: 'ana@example.com', dietary: 'Vegan', tableId: 't1', company: 'Acme' }],
  comments: [{ id: 'c1', x: 1, y: 1, body: 'Move the bar', author: 'Sam', createdAt: 0, replies: [] }],
  basemap: { src: 'data:image/png;base64,AAAA', widthM: 30, aspect: 1.5, x: 0, y: 0, opacity: 0.5 },
})

describe('share links', () => {
  it('leave guests, comments and uploaded drawings out of view-only links', () => {
    const link = open(shareUrl(event(), true))
    expect(link?.viewOnly).toBe(true)
    expect(link?.plan).toMatchObject({ name: 'Gala', guests: [] })
    expect(link?.plan?.comments).toBeUndefined()
    expect(link?.plan?.basemap).toBeUndefined()
    expect(link?.plan?.elements).toHaveLength(1)
  })

  it('show guest names on request, never emails or dietary notes', () => {
    const [g] = open(shareUrl(event(), true, true))!.plan!.guests
    expect(g).toMatchObject({ name: 'Ana Ruiz', tableId: 't1', company: 'Acme' })
    expect(g.email).toBeUndefined()
    expect(g.dietary).toBeUndefined()
  })

  it('give an editable copy the full guest list', () => {
    const link = open(shareUrl(event(), false))
    expect(link?.viewOnly).toBe(false)
    expect(link?.plan?.guests[0]).toMatchObject({ email: 'ana@example.com', dietary: 'Vegan' })
    expect(link?.plan?.comments).toHaveLength(1)
  })
})

describe('password-protected links', () => {
  it('only open with the right password', async () => {
    const url = await protectedShareUrl(event(), true, false, 'correct horse')
    const link = open(url)
    expect(link).toMatchObject({ viewOnly: true, encrypted: payload(url) })
    expect(link?.plan).toBeUndefined()
    expect(await decryptShared(payload(url), 'wrong password')).toBeNull()
    const plan = await decryptShared(payload(url), 'correct horse')
    expect(plan).toMatchObject({ name: 'Gala', guests: [] })
  })

  it('carry nothing readable and reject tampering', async () => {
    const url = await protectedShareUrl(event(), false, false, 'correct horse')
    const p = payload(url)
    expect(atob(p.replace(/-/g, '+').replace(/_/g, '/'))).not.toMatch(/Gala|Ana|example\.com/)
    const flipped = p.slice(0, 40) + (p[40] === 'A' ? 'B' : 'A') + p.slice(41)
    expect(await decryptShared(flipped, 'correct horse')).toBeNull()
  })

  it('use a fresh salt every time', async () => {
    const a = await protectedShareUrl(event(), true, false, 'correct horse')
    const b = await protectedShareUrl(event(), true, false, 'correct horse')
    expect(payload(a)).not.toBe(payload(b))
  })
})
