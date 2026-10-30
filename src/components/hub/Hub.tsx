import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus, FileText, FileUp, Search, X, LayoutGrid, List, MoreHorizontal, ArrowRight, CheckSquare, Square,
  Archive, ArchiveRestore, Trash2, Copy, Pencil, Link2, History, Users, CalendarDays,
} from 'lucide-react'
import { usePlanStore } from '../../store/usePlanStore'
import { openShared, refreshSharedList } from '../../store/team'
import { TEMPLATES } from '../../data/templates'
import type { EventSummary } from '../../lib/db'
import { eventDate, hubEvents, matchesQuery, type HubFilter, type HubSort } from '../../lib/hubList'
import { ago } from '../../lib/time'
import { toast } from '../../lib/toast'
import type { Plan } from '../../types'
import { PlanThumb } from './PlanThumb'
import { templateThumb } from './templateThumbs'
import { ShareDialog } from '../ShareDialog'
import { AccountMenu } from '../team/AccountMenu'
import { Modal } from '../dialogs/Modal'

const ROLE_LABEL = { admin: 'Admin', staff: 'Staff' } as const
const FILTERS: { id: HubFilter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'upcoming', label: 'Upcoming' }, { id: 'past', label: 'Past' },
  { id: 'shared', label: 'Shared' }, { id: 'archived', label: 'Archived' },
]

/** A view setting remembered on this device (filter, sort, layout). */
function usePref<T extends string>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try { return (localStorage.getItem(`orkesta:${key}`) as T | null) ?? initial } catch { return initial }
  })
  return [v, (next) => { setV(next); try { localStorage.setItem(`orkesta:${key}`, next) } catch { /* storage unavailable */ } }]
}

/** Home: pick up the last event, start a new one, or find any event on this device or shared with you. */
export function Hub() {
  const s = usePlanStore()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = usePref<HubFilter>('hub.filter', 'all')
  const [sort, setSort] = usePref<HubSort>('hub.sort', 'edited')
  const [layout, setLayout] = usePref<'grid' | 'list'>('hub.layout', 'grid')
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [renaming, setRenaming] = useState<EventSummary | null>(null)
  const [deleting, setDeleting] = useState<EventSummary[] | null>(null)
  const [sharing, setSharing] = useState(false)
  const jsonRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { void s.refreshSummaries(); void refreshSharedList() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const roleOf = useMemo(() => new Map(s.sharedEvents.map((e) => [e.eventId, e.role])), [s.sharedEvents])
  const list = useMemo(() => hubEvents(s.events, { filter, sort, query, sharedIds: new Set(roleOf.keys()) }), [s.events, filter, sort, query, roleOf])
  const current = s.events.find((e) => e.id === s.plan.id && !e.archived)
  const elsewhere = s.sharedEvents.filter((e) => !s.events.some((x) => x.id === e.eventId) && matchesQuery(e, query))
  const active = s.events.filter((e) => !e.archived).length

  const open = (id: string) => void s.enterEvent(id)
  const newEvent = (start = 'blank') => s.set({ dialog: 'newEvent', newEventStart: start })
  const toggle = (id: string) => setSelected((sel) => {
    const next = new Set(sel)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const act = async (e: EventSummary, what: string) => {
    switch (what) {
      case 'open': return open(e.id)
      case 'rename': return setRenaming(e)
      case 'duplicate': { if (await s.copyEvent(e.id)) toast(`Copied “${e.name}”`); return }
      case 'share': await s.openEvent(e.id); return setSharing(true)
      case 'history': await s.openEvent(e.id); return s.set({ dialog: 'history' })
      case 'archive': await s.archiveEvents([e.id], !e.archived); return toast(e.archived ? `“${e.name}” is back in your events` : `Archived “${e.name}”`)
      case 'delete': return setDeleting([e])
    }
  }

  const importFile = async (f: File) => {
    let p: Plan
    try { p = JSON.parse(await f.text()) as Plan } catch { toast('That isn’t an Orkesta project file'); return }
    if (!Array.isArray(p?.elements) || !p.layers) { toast('That isn’t an Orkesta project file'); return }
    await s.startPlan(p)
  }

  const openSharedEvent = async (id: string) => {
    await openShared(id)
    if (usePlanStore.getState().plan.id === id) usePlanStore.setState({ view: 'editor' })
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-bg-2 bg-white px-4">
        <img src="/brand/logo-inbest.png" alt="iNBest" className="h-6" />
        <span className="text-sm font-semibold tracking-tight text-ink-2">Orkesta</span>
        <label className="mx-auto flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-bg-2 bg-bg px-3 focus-within:border-accent">
          <Search size={15} className="shrink-0 text-muted" />
          <input ref={searchRef} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Search events and venues" value={query}
            onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setQuery('') }} />
          {query && <button aria-label="Clear search" className="text-muted hover:text-ink" onClick={() => setQuery('')}><X size={14} /></button>}
        </label>
        <AccountMenu />
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-8">
          {current && !query && (
            <section>
              <h2 className="eyebrow mb-2">Continue</h2>
              <div className="flex items-center gap-4 rounded-xl border border-bg-2 bg-white p-3">
                <PlanThumb thumb={current.thumb} className="hidden h-24 w-36 shrink-0 rounded-lg sm:block" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-semibold text-ink">{current.name}</div>
                  <Meta e={current} role={roleOf.get(current.id)} />
                </div>
                <button className="btn btn-primary shrink-0" onClick={() => open(current.id)}>Open <ArrowRight size={15} /></button>
              </div>
            </section>
          )}

          <section className="grid gap-2 sm:grid-cols-3">
            <StartButton icon={<Plus size={18} />} title="New event" hint="Name, date and venue" primary onClick={() => newEvent()} />
            <StartButton icon={<FileText size={18} />} title="From a venue drawing" hint="PDF or image of the floor plan" onClick={() => newEvent('drawing')} />
            <StartButton icon={<FileUp size={18} />} title="Open a project file" hint="An Orkesta .json export" onClick={() => jsonRef.current?.click()} />
            <input ref={jsonRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importFile(f) }} />
          </section>

          <section>
            <h2 className="eyebrow mb-2">Templates</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {TEMPLATES.map((t) => (
                <button key={t.id} className="group rounded-xl border border-bg-2 bg-white p-2 text-left hover:border-accent/60" title={t.description} onClick={() => newEvent(t.id)}>
                  <PlanThumb thumb={templateThumb(t.id)} className="aspect-[4/3] w-full rounded-lg" />
                  <div className="mt-1.5 text-sm font-semibold text-ink group-hover:text-accent-deep">{t.name}</div>
                  <div className="truncate text-[11px] text-muted">{t.description.split(' · ')[1] ?? ''}</div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="eyebrow mr-2">Your events{active ? ` · ${active}` : ''}</h2>
              <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter events">
                {FILTERS.map((f) => (
                  <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => { setFilter(f.id); setSelected(null) }}
                    className={`rounded-full border px-2.5 py-0.5 text-xs ${filter === f.id ? 'border-accent bg-accent/10 font-medium text-accent-deep' : 'border-bg-2 bg-white text-ink-2 hover:border-accent/50'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-1">
                <select className="input h-8 w-auto py-0 text-xs" aria-label="Sort events" value={sort} onChange={(e) => setSort(e.target.value as HubSort)}>
                  <option value="edited">Last edited</option><option value="date">Event date</option><option value="name">Name</option>
                </select>
                <button className={`btn h-8 border border-bg-2 px-2 ${layout === 'grid' ? 'bg-white text-ink' : 'text-muted'}`} aria-label="Grid" aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}><LayoutGrid size={15} /></button>
                <button className={`btn h-8 border border-bg-2 px-2 ${layout === 'list' ? 'bg-white text-ink' : 'text-muted'}`} aria-label="List" aria-pressed={layout === 'list'} onClick={() => setLayout('list')}><List size={15} /></button>
                {list.length > 0 && (
                  <button className={`btn h-8 border px-2 text-xs ${selected ? 'border-accent bg-accent/10 text-accent-deep' : 'border-bg-2'}`} onClick={() => setSelected(selected ? null : new Set())}>
                    {selected ? 'Done' : 'Select'}
                  </button>
                )}
              </div>
            </div>

            {list.length ? (
              <div className={layout === 'grid' ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'divide-y divide-bg-2 rounded-xl border border-bg-2 bg-white'}>
                {list.map((e) => (
                  <EventCard key={e.id} e={e} layout={layout} role={roleOf.get(e.id)} current={e.id === s.plan.id}
                    selected={selected?.has(e.id) ?? null} onOpen={() => (selected ? toggle(e.id) : open(e.id))} onAction={(what) => void act(e, what)} />
                ))}
              </div>
            ) : (
              <Empty filter={filter} query={query} hasEvents={s.events.length > 0} onNew={() => newEvent()} onClear={() => { setQuery(''); setFilter('all') }} />
            )}
          </section>

          {elsewhere.length > 0 && filter !== 'archived' && (
            <section>
              <h2 className="eyebrow mb-2">Shared with you · not on this device yet</h2>
              <ul className="divide-y divide-bg-2 rounded-xl border border-bg-2 bg-white">
                {elsewhere.map((e) => (
                  <li key={e.eventId} className="flex items-center gap-3 px-4 py-2.5">
                    <Users size={16} className="shrink-0 text-muted" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink">{e.name}</div>
                      <div className="text-[11px] text-muted">{ROLE_LABEL[e.role]} · updated {ago(e.updatedAt)}</div>
                    </div>
                    <button className="btn border border-bg-2" onClick={() => void openSharedEvent(e.eventId)}>Open</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>

      {selected && (
        <div className="flex shrink-0 items-center gap-2 border-t border-bg-2 bg-white px-4 py-2.5 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <button className="text-xs text-accent-deep hover:underline" onClick={() => setSelected(new Set(list.map((e) => e.id)))}>Select all {list.length}</button>
          <div className="ml-auto flex gap-1">
            <button className="btn border border-bg-2" disabled={!selected.size}
              onClick={async () => { await s.archiveEvents([...selected], filter !== 'archived'); toast(`${filter === 'archived' ? 'Restored' : 'Archived'} ${selected.size} event${selected.size > 1 ? 's' : ''}`); setSelected(new Set()) }}>
              {filter === 'archived' ? <ArchiveRestore size={15} /> : <Archive size={15} />}{filter === 'archived' ? 'Unarchive' : 'Archive'}
            </button>
            <button className="btn border border-red-200 text-red-700" disabled={!selected.size} onClick={() => setDeleting(s.events.filter((e) => selected.has(e.id)))}><Trash2 size={15} />Delete</button>
            <button className="btn" onClick={() => setSelected(null)}>Cancel</button>
          </div>
        </div>
      )}

      {renaming && <RenameDialog e={renaming} onClose={() => setRenaming(null)} />}
      {deleting && <DeleteDialog events={deleting} onClose={(done) => { setDeleting(null); if (done) setSelected(null) }} />}
      {sharing && <ShareDialog onClose={() => setSharing(false)} />}
    </div>
  )
}

function StartButton({ icon, title, hint, primary, onClick }: { icon: React.ReactNode; title: string; hint: string; primary?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border bg-white p-3 text-left hover:border-accent ${primary ? 'border-accent/60' : 'border-bg-2'}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${primary ? 'bg-accent text-white' : 'bg-bg text-accent-deep'}`}>{icon}</span>
      <span className="min-w-0"><span className="block text-sm font-semibold text-ink">{title}</span><span className="block truncate text-xs text-muted">{hint}</span></span>
    </button>
  )
}

/** Venue, date and status line used on cards and the Continue card. */
function Meta({ e, role }: { e: EventSummary; role?: keyof typeof ROLE_LABEL }) {
  const d = eventDate(e.date)
  const c = e.counts
  return (
    <>
      <div className="truncate text-xs text-ink-2">{e.venue || 'No venue yet'}</div>
      {d && (
        <div className="flex min-w-0 items-center gap-1 text-xs text-ink-2">
          <CalendarDays size={12} className="shrink-0 text-muted" /><span className="truncate">{d.label}</span>
          <span className={`shrink-0 ${d.past ? 'text-muted' : 'text-accent-deep'}`}>· {d.when}</span>
        </div>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
        {(role || e.shared) && <span className="rounded-full bg-accent/10 px-1.5 font-medium leading-4 text-accent-deep">{role ? ROLE_LABEL[role] : 'Shared'}</span>}
        {e.archived && <span className="rounded-full bg-bg-2 px-1.5 leading-4">Archived</span>}
        <span>Edited {ago(e.updatedAt)}</span>
        {c && c.seats > 0 && <span>· {c.guests ? `${c.seated}/${c.seats} seated` : `${c.seats} seats`}</span>}
        {c && c.levels > 1 && <span>· {c.levels} levels</span>}
      </div>
    </>
  )
}

function EventCard({ e, layout, role, current, selected, onOpen, onAction }: {
  e: EventSummary; layout: 'grid' | 'list'; role?: keyof typeof ROLE_LABEL; current: boolean; selected: boolean | null
  onOpen: () => void; onAction: (what: string) => void
}) {
  const [menu, setMenu] = useState(false)
  const check = selected !== null && (
    <span className={`grid h-6 w-6 place-items-center rounded-md bg-white/90 ${selected ? 'text-accent-deep' : 'text-muted'}`} aria-hidden="true">
      {selected ? <CheckSquare size={18} /> : <Square size={18} />}
    </span>
  )
  const menuEl = (
    <div className="relative">
      <button aria-label={`Actions for ${e.name}`} aria-expanded={menu} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-bg hover:text-ink"
        onClick={(ev) => { ev.stopPropagation(); setMenu(!menu) }}><MoreHorizontal size={17} /></button>
      {menu && (
        <>
          <div className="fixed inset-0 z-20" onClick={(ev) => { ev.stopPropagation(); setMenu(false) }} />
          <div role="menu" className="absolute bottom-9 right-0 z-30 w-52 rounded-lg border border-bg-2 bg-white py-1 text-sm shadow-lg">
            {([
              ['open', 'Open', <ArrowRight size={14} key="i" />],
              ['rename', 'Rename…', <Pencil size={14} key="i" />],
              ['duplicate', 'Duplicate', <Copy size={14} key="i" />],
              ['share', 'Share link…', <Link2 size={14} key="i" />],
              ['history', 'Version history…', <History size={14} key="i" />],
              ['archive', e.archived ? 'Unarchive' : 'Archive', e.archived ? <ArchiveRestore size={14} key="i" /> : <Archive size={14} key="i" />],
            ] as const).map(([id, label, icon]) => (
              <button key={id} role="menuitem" className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-bg" onClick={(ev) => { ev.stopPropagation(); setMenu(false); onAction(id) }}>
                <span className="text-muted">{icon}</span>{label}
              </button>
            ))}
            <div className="my-1 border-t border-bg-2" />
            <button role="menuitem" className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-red-700 hover:bg-red-50" onClick={(ev) => { ev.stopPropagation(); setMenu(false); onAction('delete') }}>
              <Trash2 size={14} />{e.shared ? 'Remove from this device…' : 'Delete…'}
            </button>
          </div>
        </>
      )}
    </div>
  )

  if (layout === 'list') {
    return (
      <div className={`flex items-center gap-3 px-3 py-2 ${selected ? 'bg-accent/5' : ''}`}>
        <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={onOpen}>
          {check}
          <PlanThumb thumb={e.thumb} className="h-12 w-16 shrink-0 rounded" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-ink">{e.name}</span>{current && <span className="text-[10px] text-muted">Open now</span>}</span>
            <Meta e={e} role={role} />
          </span>
        </button>
        {selected === null && menuEl}
      </div>
    )
  }
  return (
    <div className={`group relative rounded-xl border bg-white transition-colors ${selected ? 'border-accent ring-2 ring-accent/30' : 'border-bg-2 hover:border-accent/60'}`}>
      <button className="block w-full text-left" onClick={onOpen}>
        <PlanThumb thumb={e.thumb} className="aspect-[16/10] w-full rounded-t-xl" />
        <div className="p-3 pr-10">
          <div className="truncate text-sm font-semibold text-ink">{e.name}</div>
          <Meta e={e} role={role} />
        </div>
      </button>
      {check && <div className="pointer-events-none absolute left-2 top-2">{check}</div>}
      {selected === null && <div className="absolute bottom-2 right-1.5">{menuEl}</div>}
    </div>
  )
}

function Empty({ filter, query, hasEvents, onNew, onClear }: { filter: HubFilter; query: string; hasEvents: boolean; onNew: () => void; onClear: () => void }) {
  if (!hasEvents) {
    return (
      <div className="rounded-xl border border-dashed border-accent/50 bg-white p-8 text-center">
        <div className="text-lg font-semibold text-ink">Start your first event</div>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">Set up a blank venue, pick a template above, or bring in the venue's floor plan as a PDF.</p>
        <button className="btn btn-primary mt-4" onClick={onNew}><Plus size={15} />New event</button>
      </div>
    )
  }
  const what = query ? `No events match “${query}”` : filter === 'archived' ? 'No archived events' : filter === 'upcoming' ? 'No upcoming events' : filter === 'past' ? 'No past events' : filter === 'shared' ? 'No shared events on this device' : 'No events'
  return (
    <div className="rounded-xl border border-bg-2 bg-white p-6 text-center text-sm text-muted">
      {what}. {(query || filter !== 'all') && <button className="text-accent-deep hover:underline" onClick={onClear}>Show all events</button>}
    </div>
  )
}

function RenameDialog({ e, onClose }: { e: EventSummary; onClose: () => void }) {
  const renameEvent = usePlanStore((s) => s.renameEvent)
  const [name, setName] = useState(e.name)
  const save = async () => { if (name.trim() && name.trim() !== e.name) await renameEvent(e.id, name.trim()); onClose() }
  return (
    <Modal title="Rename event" onClose={onClose}>
      <form onSubmit={(ev) => { ev.preventDefault(); void save() }}>
        <input autoFocus className="input" value={name} maxLength={120} onChange={(ev) => setName(ev.target.value)} onFocus={(ev) => ev.target.select()} />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!name.trim()}>Save</button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * Deleting removes the plan, its guest list and its version history from this device, so it asks for
 * the event's name (or "delete" for several), as OnePlan does. Shared events only leave this device.
 */
function DeleteDialog({ events, onClose }: { events: EventSummary[]; onClose: (done: boolean) => void }) {
  const deleteEvents = usePlanStore((s) => s.deleteEvents)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const onlyShared = events.every((e) => e.shared)
  const word = events.length === 1 ? events[0].name : 'delete'
  const ok = onlyShared || typed.trim().toLowerCase() === word.trim().toLowerCase()
  const go = async () => {
    if (!ok) return
    setBusy(true)
    await deleteEvents(events.map((e) => e.id))
    toast(events.length === 1 ? `${onlyShared ? 'Removed' : 'Deleted'} “${events[0].name}”` : `Deleted ${events.length} events`)
    onClose(true)
  }
  return (
    <Modal title={onlyShared ? (events.length === 1 ? 'Remove from this device' : `Remove ${events.length} events from this device`) : events.length === 1 ? 'Delete event' : `Delete ${events.length} events`} onClose={() => onClose(false)}>
      <form onSubmit={(ev) => { ev.preventDefault(); void go() }}>
        {onlyShared ? (
          <p className="text-sm text-ink-2">They stay shared with your team. You can open them again from “Shared with you”.</p>
        ) : (
          <>
            <p className="text-sm text-ink-2">
              {events.length === 1 ? <>This deletes <b>{events[0].name}</b></> : <>This deletes {events.length} events</>}, with the guest list and version history, from this device. It can't be undone.
              {events.some((e) => e.shared) && ' Shared events only leave this device.'}
            </p>
            <label className="mt-3 block"><span className="text-[11px] text-muted">Type <b>{word}</b> to confirm</span>
              <input autoFocus className="input" value={typed} onChange={(ev) => setTyped(ev.target.value)} />
            </label>
          </>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => onClose(false)}>Cancel</button>
          <button className="btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-50" disabled={!ok || busy}>{busy ? 'Deleting…' : onlyShared ? 'Remove' : 'Delete'}</button>
        </div>
      </form>
    </Modal>
  )
}
