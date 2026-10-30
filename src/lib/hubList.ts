import type { EventSummary } from './db'

/** The hub's event list: filters, search and sorting, kept apart from the UI so they can be tested. */
export type HubFilter = 'all' | 'upcoming' | 'past' | 'shared' | 'archived'
export type HubSort = 'edited' | 'date' | 'name'

/** Today as YYYY-MM-DD in local time, the format of `Plan.date`. */
export function isoDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DAY = 86_400_000
const dayNumber = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY

/** "Sat 14 Nov" and "in 15 days" for an event date; null when there's no valid date. */
export function eventDate(date: string, today = isoDay()): { label: string; when: string; past: boolean } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const d = new Date(`${date}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const sameYear = date.slice(0, 4) === today.slice(0, 4)
  const label = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
  const days = dayNumber(date) - dayNumber(today)
  const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : days === -1 ? 'yesterday'
    : days > 0 ? (days < 60 ? `in ${days} days` : `in ${Math.round(days / 30)} months`)
    : (-days < 60 ? `${-days} days ago` : `${Math.round(-days / 30)} months ago`)
  return { label, when, past: days < 0 }
}

/** Case- and accent-insensitive text for search. */
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function matchesQuery(e: { name: string; venue?: string }, query: string) {
  const q = fold(query.trim())
  return !q || fold(`${e.name} ${e.venue ?? ''}`).includes(q)
}

export function hubEvents(events: EventSummary[], opts: { filter: HubFilter; sort: HubSort; query: string; sharedIds?: Set<string>; today?: string }) {
  const today = opts.today ?? isoDay()
  const dated = (e: EventSummary) => /^\d{4}-\d{2}-\d{2}$/.test(e.date)
  const keep = (e: EventSummary) => {
    if (opts.filter === 'archived') return !!e.archived
    if (e.archived) return false
    switch (opts.filter) {
      case 'upcoming': return dated(e) && e.date >= today
      case 'past': return dated(e) && e.date < today
      case 'shared': return !!e.shared || !!opts.sharedIds?.has(e.id)
      default: return true
    }
  }
  const list = events.filter((e) => keep(e) && matchesQuery(e, opts.query))
  if (opts.sort === 'name') return list.sort((a, b) => a.name.localeCompare(b.name))
  if (opts.sort === 'date') {
    // Soonest first; past events most recent first; undated last
    const dir = opts.filter === 'past' ? -1 : 1
    return list.sort((a, b) => (dated(a) ? 0 : 1) - (dated(b) ? 0 : 1) || dir * a.date.localeCompare(b.date) || b.updatedAt - a.updatedAt)
  }
  return list.sort((a, b) => b.updatedAt - a.updatedAt)
}
