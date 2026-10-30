/**
 * Your profile: how you appear to your team on comments, messages and team lists. Validation lives here so
 * the app and the backend (test or real) apply the same rules.
 */
export interface ProfileFields {
  name: string
  /** job title, e.g. "Event producer" */
  title?: string
  company?: string
  /** shown only to admins of events you're on, like your email */
  phone?: string
  /** avatar colour when there's no photo; one of AVATAR_COLORS */
  color?: string
  /** small square JPEG/PNG/WebP as a data URL */
  photo?: string
}
/** A change to the profile. An empty string clears an optional field. */
export type ProfilePatch = Partial<ProfileFields>

export const AVATAR_COLORS = ['#075e99', '#1ea7e8', '#0f766e', '#16a34a', '#d97706', '#db2777', '#7c3aed', '#475569'] as const
export const PROFILE_LIMITS = { name: 80, title: 80, company: 80, phone: 30, photoChars: 150_000 } as const

const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/
const PHONE = /^\+?[0-9 ().-]{6,}$/

/** Checks and tidies a profile change. Returns the cleaned change, or the first problem in words. */
export function cleanProfile(p: ProfilePatch): { ok: true; patch: ProfilePatch } | { ok: false; error: string } {
  const out: ProfilePatch = {}
  if (p.name !== undefined) {
    const name = p.name.replace(/\s+/g, ' ').trim()
    if (!name) return { ok: false, error: 'Enter your name' }
    if (name.length > PROFILE_LIMITS.name) return { ok: false, error: `Keep your name under ${PROFILE_LIMITS.name} characters` }
    out.name = name
  }
  for (const key of ['title', 'company'] as const) {
    if (p[key] === undefined) continue
    const v = p[key]!.replace(/\s+/g, ' ').trim()
    if (v.length > PROFILE_LIMITS[key]) return { ok: false, error: `Keep the ${key === 'title' ? 'job title' : 'company'} under ${PROFILE_LIMITS[key]} characters` }
    out[key] = v
  }
  if (p.phone !== undefined) {
    const phone = p.phone.trim()
    if (phone && (!PHONE.test(phone) || phone.length > PROFILE_LIMITS.phone)) return { ok: false, error: 'Enter a phone number with digits, spaces, + ( ) - only' }
    out.phone = phone
  }
  if (p.color !== undefined) {
    if (p.color && !(AVATAR_COLORS as readonly string[]).includes(p.color)) return { ok: false, error: 'Pick one of the avatar colours' }
    out.color = p.color
  }
  if (p.photo !== undefined) {
    if (p.photo && (!PHOTO.test(p.photo) || p.photo.length > PROFILE_LIMITS.photoChars)) return { ok: false, error: 'That photo can’t be used. Try a JPEG or PNG.' }
    out.photo = p.photo
  }
  return { ok: true, patch: out }
}

/** Applies a cleaned change: empty optional fields are removed; an empty name is ignored. */
export function applyProfile<T extends ProfileFields>(current: T, patch: ProfilePatch): T {
  const next = { ...current } as Record<string, unknown>
  for (const [k, v] of Object.entries(patch)) {
    if (v === '') { if (k !== 'name') delete next[k] }
    else if (v !== undefined) next[k] = v
  }
  return next as T
}

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?'

/** A steady default colour for someone who hasn't picked one. */
export function colorFor(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

/** "Event producer · iNBest" */
export const subtitle = (p: { title?: string; company?: string }) => [p.title, p.company].filter(Boolean).join(' · ')
