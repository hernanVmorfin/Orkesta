import LZString from 'lz-string'
import type { Guest, Plan } from '../types'

/** Guests a link may carry: view-only links drop the guest list unless names are requested, and never include emails or dietary notes. */
function sharedGuests(plan: Plan, viewOnly: boolean, guestNames: boolean): Guest[] {
  if (!viewOnly) return plan.guests
  if (!guestNames) return []
  return plan.guests.map(({ id, name, company, group, tableId, checkedIn, tag }) => ({ id, name, company, group, tableId, checkedIn, tag }))
}

/**
 * What a link carries. Uploaded (data:) drawings are dropped to keep links short; view-only links
 * also leave out the team's comments.
 */
function leanPlan(plan: Plan, viewOnly: boolean, guestNames: boolean): Plan {
  return {
    ...plan,
    shared: undefined,
    guests: sharedGuests(plan, viewOnly, guestNames),
    comments: viewOnly ? undefined : plan.comments,
    basemap: plan.basemap?.src.startsWith('data:') ? undefined : plan.basemap,
    levels: plan.levels?.map((l) => (l.basemap?.src.startsWith('data:') ? { ...l, basemap: undefined } : l)),
  }
}

const linkFor = (data: string, viewOnly: boolean, encrypted = false) => {
  const url = new URL(window.location.href)
  url.hash = `plan=${data}${encrypted ? '&enc=1' : ''}${viewOnly ? '&mode=view' : ''}`
  return url.toString()
}

/** Encodes a plan into a URL hash. */
export function shareUrl(plan: Plan, viewOnly: boolean, guestNames = false) {
  return linkFor(LZString.compressToEncodedURIComponent(JSON.stringify(leanPlan(plan, viewOnly, guestNames))), viewOnly)
}

// ---- Password-protected links -----------------------------------------------
// The plan is encrypted in the browser (AES-GCM, key from PBKDF2-SHA-256). Only someone with the
// password can read it; nothing is sent to a server.

const ITERATIONS = 250_000
function b64url(b: Uint8Array) {
  // In chunks: spreading a large array into one call can overflow the argument limit
  let s = ''
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const unb64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

async function keyFrom(password: string, salt: Uint8Array<ArrayBuffer>) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function protectedShareUrl(plan: Plan, viewOnly: boolean, guestNames: boolean, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const body = new Uint8Array(LZString.compressToUint8Array(JSON.stringify(leanPlan(plan, viewOnly, guestNames))))
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(password, salt), body))
  const out = new Uint8Array(salt.length + iv.length + cipher.length)
  out.set(salt); out.set(iv, 16); out.set(cipher, 28)
  return linkFor(b64url(out), viewOnly, true)
}

/** Returns the plan, or null when the password is wrong or the link is damaged. */
export async function decryptShared(payload: string, password: string): Promise<Plan | null> {
  try {
    const all = unb64url(payload)
    const key = await keyFrom(password, all.slice(0, 16))
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(16, 28) }, key, all.slice(28)))
    const json = LZString.decompressFromUint8Array(plain)
    return json ? (JSON.parse(json) as Plan) : null
  } catch {
    return null
  }
}

export type SharedLink =
  | { plan: Plan; viewOnly: boolean; encrypted?: undefined }
  | { plan?: undefined; viewOnly: boolean; encrypted: string }

export function readShared(): SharedLink | null {
  const h = new URLSearchParams(window.location.hash.slice(1))
  const data = h.get('plan')
  if (!data) return null
  const viewOnly = h.get('mode') === 'view'
  if (h.get('enc') === '1') return { encrypted: data, viewOnly }
  try {
    const json = LZString.decompressFromEncodedURIComponent(data)
    if (!json) return null
    return { plan: JSON.parse(json) as Plan, viewOnly }
  } catch {
    return null
  }
}
