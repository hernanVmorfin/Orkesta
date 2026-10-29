import LZString from 'lz-string'
import type { Guest, Plan } from '../types'

/** Guests a link may carry: view-only links drop the guest list unless names are requested, and never include emails or dietary notes. */
function sharedGuests(plan: Plan, viewOnly: boolean, guestNames: boolean): Guest[] {
  if (!viewOnly) return plan.guests
  if (!guestNames) return []
  return plan.guests.map(({ id, name, company, group, tableId, checkedIn }) => ({ id, name, company, group, tableId, checkedIn }))
}

/** Encodes a plan into a URL hash. Uploaded (data:) basemaps are dropped to keep links short. */
export function shareUrl(plan: Plan, viewOnly: boolean, guestNames = false) {
  const lean: Plan = {
    ...plan,
    guests: sharedGuests(plan, viewOnly, guestNames),
    basemap: plan.basemap?.src.startsWith('data:') ? undefined : plan.basemap,
  }
  const data = LZString.compressToEncodedURIComponent(JSON.stringify(lean))
  const url = new URL(window.location.href)
  url.hash = `plan=${data}${viewOnly ? '&mode=view' : ''}`
  return url.toString()
}

export function readShared(): { plan: Plan; viewOnly: boolean } | null {
  const h = new URLSearchParams(window.location.hash.slice(1))
  const data = h.get('plan')
  if (!data) return null
  try {
    const json = LZString.decompressFromEncodedURIComponent(data)
    if (!json) return null
    return { plan: JSON.parse(json) as Plan, viewOnly: h.get('mode') === 'view' }
  } catch {
    return null
  }
}
