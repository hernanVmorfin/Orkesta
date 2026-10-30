import { useEffect, useMemo, useState } from 'react'
import { Search, X, ChevronRight, Users, Monitor } from 'lucide-react'
import { usePlanStore } from '../../store/usePlanStore'
import { openShared, refreshSharedList } from '../../store/team'
import { eventDate, hubEvents, matchesQuery } from '../../lib/hubList'
import { ago } from '../../lib/time'
import type { EventSummary } from '../../lib/db'
import { PlanThumb } from '../hub/PlanThumb'
import { AccountMenu } from '../team/AccountMenu'

const ROLE_LABEL = { admin: 'Admin', staff: 'Staff' } as const

/** Phone home: open any event on this device or shared with you. Creating and editing stay on a computer. */
export function MobileHub() {
  const s = usePlanStore()
  const [query, setQuery] = useState('')
  useEffect(() => { void s.refreshSummaries(); void refreshSharedList() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const roleOf = useMemo(() => new Map(s.sharedEvents.map((e) => [e.eventId, e.role])), [s.sharedEvents])
  const upcoming = useMemo(() => hubEvents(s.events, { filter: 'upcoming', sort: 'date', query }), [s.events, query])
  const others = useMemo(() => hubEvents(s.events, { filter: 'all', sort: 'edited', query }).filter((e) => !upcoming.includes(e)), [s.events, query, upcoming])
  const elsewhere = s.sharedEvents.filter((e) => !s.events.some((x) => x.id === e.eventId) && matchesQuery(e, query))
  const current = !query ? s.events.find((e) => e.id === s.plan.id && !e.archived) : undefined

  const openSharedEvent = async (id: string) => {
    await openShared(id)
    if (usePlanStore.getState().plan.id === id) usePlanStore.setState({ view: 'editor' })
  }
  const row = (e: EventSummary) => {
    const d = eventDate(e.date)
    const role = roleOf.get(e.id)
    return (
      <li key={e.id}>
        <button className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left active:bg-bg" onClick={() => void s.enterEvent(e.id)}>
          <PlanThumb thumb={e.thumb} className="h-12 w-16 shrink-0 rounded" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-ink">{e.name}</span>
            <span className="block truncate text-xs text-muted">
              {[d ? `${d.label} (${d.when})` : null, e.venue || null].filter(Boolean).join(' · ') || `Edited ${ago(e.updatedAt)}`}
            </span>
            {(role || e.shared) && <span className="mt-0.5 inline-block rounded-full bg-accent/10 px-1.5 text-[10px] font-medium leading-4 text-accent-deep">{role ? ROLE_LABEL[role] : 'Shared'}</span>}
          </span>
          <ChevronRight size={18} className="shrink-0 text-muted" />
        </button>
      </li>
    )
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex shrink-0 items-center gap-2 border-b border-bg-2 bg-white px-4 pb-2.5" style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}>
        <img src="/brand/logo-inbest.png" alt="iNBest" className="h-5" />
        <span className="flex-1 text-[15px] font-semibold tracking-tight text-ink-2">Orkesta</span>
        <AccountMenu />
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto pb-8" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
        <div className="p-3">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-bg-2 bg-white px-3">
            <Search size={17} className="shrink-0 text-muted" />
            <input className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" placeholder="Find an event" value={query} enterKeyHint="search" onChange={(e) => setQuery(e.target.value)} />
            {query && <button aria-label="Clear search" className="-mr-2 grid h-10 w-10 place-items-center text-muted" onClick={() => setQuery('')}><X size={17} /></button>}
          </label>
        </div>

        {current && (
          <section className="px-3 pb-3">
            <button className="flex w-full items-center gap-3 rounded-xl border border-accent/50 bg-white p-3 text-left active:bg-bg" onClick={() => void s.enterEvent(current.id)}>
              <PlanThumb thumb={current.thumb} className="h-16 w-24 shrink-0 rounded-lg" />
              <span className="min-w-0 flex-1">
                <span className="eyebrow block">Continue</span>
                <span className="block truncate text-base font-semibold text-ink">{current.name}</span>
                <span className="block truncate text-xs text-muted">{current.venue || `Edited ${ago(current.updatedAt)}`}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-muted" />
            </button>
          </section>
        )}

        {upcoming.length > 0 && <Group title="Upcoming">{upcoming.map(row)}</Group>}
        {others.length > 0 && <Group title={upcoming.length ? 'Other events' : 'Your events'}>{others.map(row)}</Group>}
        {elsewhere.length > 0 && (
          <Group title="Shared with you">
            {elsewhere.map((e) => (
              <li key={e.eventId}>
                <button className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-bg" onClick={() => void openSharedEvent(e.eventId)}>
                  <Users size={18} className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">{e.name}</span>
                    <span className="block text-xs text-muted">{ROLE_LABEL[e.role]} · not on this phone yet</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-muted" />
                </button>
              </li>
            ))}
          </Group>
        )}
        {!upcoming.length && !others.length && !elsewhere.length && (
          <p className="px-6 py-8 text-center text-sm text-muted">{query ? `No events match “${query}”.` : 'No events on this phone yet.'}</p>
        )}
        <p className="mx-6 mt-2 flex items-start gap-2 text-xs text-muted"><Monitor size={14} className="mt-0.5 shrink-0" />Create and edit events on a computer. They show up here when shared with you or opened on this phone.</p>
      </main>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-3">
      <h2 className="eyebrow px-4 pb-1">{title}</h2>
      <ul className="divide-y divide-bg-2 border-y border-bg-2 bg-white">{children}</ul>
    </section>
  )
}
