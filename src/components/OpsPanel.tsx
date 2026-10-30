import { useState } from 'react'
import { ChevronRight, TriangleAlert, Download, CalendarClock, MapPin } from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'
import { DEFAULT_SAFETY, safetyOf } from '../lib/calcs'
import { arrivalModel, arrivalOf, expectedCrowd, clashes, egress, entrances, exitBlockers, inventory, powerBudget, scheduleItems } from '../lib/ops'
import { activeLevel, levelsOf } from '../lib/levels'
import { requestFocus } from '../lib/canvas'
import { download } from '../lib/csv'
import { inventoryCsv } from '../lib/inventoryCsv'
import { ago } from '../lib/time'
import type { ArrivalModel, PlanElement, SafetySettings } from '../types'

function Section({ title, badge, children, defaultOpen = false }: { title: string; badge?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-b border-bg-2">
      <button className="flex w-full items-center gap-1 px-4 py-3 text-left text-sm font-semibold text-ink" onClick={() => setOpen(!open)}>
        <ChevronRight size={15} className={open ? 'rotate-90 transition' : 'transition'} /><span className="flex-1">{title}</span>{badge}
      </button>
      {open && <div className="space-y-3 px-4 pb-4 text-sm">{children}</div>}
    </section>
  )
}

const Warn = ({ children }: { children: React.ReactNode }) => (
  <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 text-[11px] font-medium text-red-700"><TriangleAlert size={12} />{children}</span>
)

const fmtMin = (m: number) => {
  if (!Number.isFinite(m)) return '–'
  const s = Math.round(m * 60)
  if (s < 60) return `${s} s`
  if (s < 3600) return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`
  const min = Math.round(s / 60)
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`
}

/** Jumps to an object: shows its level, selects it and centers the view on it. */
function useShow() {
  const s = usePlanStore()
  return (e: PlanElement) => {
    s.set({ levelId: e.levelId ?? null, selection: [e.id], rightTab: 'inspect' })
    requestAnimationFrame(() => requestFocus({ x: e.x, y: e.y, zoom: 20 }))
  }
}

/** Ops tab: evacuation, arrivals, power, load-in schedule, inventory and comments. */
export function OpsPanel() {
  const s = usePlanStore()
  return (
    <div>
      <EgressSection />
      <ArrivalSection />
      <PowerSection />
      <ScheduleSection />
      <InventorySection />
      {(s.plan.comments?.length ?? 0) > 0 && <CommentsSection />}
    </div>
  )
}

function EgressSection() {
  const s = usePlanStore()
  const show = useShow()
  const ro = s.viewOnly
  const eg = egress(s.plan, s.levelId)
  const blocked = exitBlockers(s.plan, s.levelId)
  const safety = safetyOf(s.plan)
  const setSafety = (patch: Partial<SafetySettings>) => s.mutate((p) => ({ ...p, safety: { ...DEFAULT_SAFETY, ...p.safety, ...patch } }))
  const multi = levelsOf(s.plan).length > 1
  const rates = [82, 66, 40]
  return (
    <Section title={`Evacuation${multi ? ` · ${activeLevel(s.plan, s.levelId).name}` : ''}`} defaultOpen
      badge={!eg.exits.length ? <Warn>No exits</Warn> : blocked.length ? <Warn>{blocked.length} blocked</Warn> : <span className="font-mono text-xs text-muted">{fmtMin(eg.minutes)}</span>}>
      <div className="grid grid-cols-3 gap-2 rounded-lg bg-bg p-3 text-center">
        <div><div className="eyebrow">People</div><div className="font-mono text-lg font-semibold">{eg.occupancy.toLocaleString()}</div></div>
        <div><div className="eyebrow">Exit flow</div><div className="font-mono text-lg font-semibold">{Math.round(eg.capacity)}/min</div></div>
        <div><div className="eyebrow">Clear in</div><div className={`font-mono text-lg font-semibold ${!Number.isFinite(eg.minutes) ? 'text-red-600' : ''}`}>{fmtMin(eg.minutes)}</div></div>
      </div>
      <p className="text-xs text-muted">
        {eg.overridden ? 'Using your crowd size' : `${eg.seats.toLocaleString()} seats + ${eg.standing.toLocaleString()} standing (from crowd areas)`}
        {eg.lost ? ` · without the widest exit (${eg.lost.label})` : ''}.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="text-[11px] text-muted">Crowd size (blank = from the plan)</span>
          <input type="number" min={0} className="input font-mono" disabled={ro} value={safety.crowdSize ?? ''} placeholder={String(eg.seats + eg.standing)}
            onChange={(e) => setSafety({ crowdSize: e.target.value === '' ? undefined : Math.max(0, Math.round(+e.target.value)) })} />
        </label>
        <label className="block"><span className="text-[11px] text-muted">Flow rate (people/m/min)</span>
          <select className="input" disabled={ro} value={rates.includes(safety.flowRate) ? safety.flowRate : 'custom'}
            onChange={(e) => e.target.value !== 'custom' && setSafety({ flowRate: +e.target.value })}>
            <option value={82}>Level routes · 82</option><option value={66}>Stepped routes · 66</option><option value={40}>Conservative · 40</option>
            {!rates.includes(safety.flowRate) && <option value="custom">Custom · {safety.flowRate}</option>}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" className="accent-[#1ea7e8]" disabled={ro} checked={safety.worstCase} onChange={(e) => setSafety({ worstCase: e.target.checked })} />
        Assume the widest exit is unavailable
      </label>
      {eg.exits.length ? (
        <ul className="divide-y divide-bg-2 rounded-lg border border-bg-2">
          {eg.exits.map(({ e, flow }) => (
            <li key={e.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
              <button className="min-w-0 flex-1 truncate text-left hover:text-accent-deep" onClick={() => show(e)}>{e.label}</button>
              <span className={`font-mono ${eg.lost?.id === e.id ? 'text-muted line-through' : ''}`}>{Math.round(flow)}/min</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">Place emergency exits (Safety group) to estimate how long the venue takes to clear. Set each exit's clear width in the Inspector.</p>
      )}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-ink-2">Exit approaches</span>
          <label className="flex items-center gap-1 text-[11px] text-muted">keep clear
            <input type="number" min={0.5} step={0.5} className="input h-6 w-14 px-1 font-mono text-xs" disabled={ro} value={safety.exitClearM}
              onChange={(e) => setSafety({ exitClearM: Math.max(0.5, +e.target.value || 0.5) })} /> m
          </label>
        </div>
        {blocked.length ? (
          <ul className="space-y-1">
            {blocked.map(({ exit, blockers }) => (
              <li key={exit.id} className="rounded-md bg-red-50 px-3 py-1.5 text-xs text-red-800">
                <button className="font-semibold hover:underline" onClick={() => show(exit)}>{exit.label}</button> is blocked by{' '}
                {blockers.slice(0, 3).map((b, i) => <button key={b.id} className="underline-offset-2 hover:underline" onClick={() => show(b)}>{i ? ', ' : ''}{b.label}</button>)}
                {blockers.length > 3 ? ` +${blockers.length - 3} more` : ''}
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-muted">{eg.exits.length ? 'All exit approaches are clear.' : '–'}</p>}
      </div>
      <p className="text-[11px] text-muted">An estimate from exit width × flow rate. Check it against your local fire code and the venue's approved capacity.</p>
    </Section>
  )
}

function ArrivalSection() {
  const s = usePlanStore()
  const show = useShow()
  const ro = s.viewOnly
  const model = arrivalOf(s.plan)
  const ents = entrances(s.plan)
  const { rows, capacity } = arrivalModel(s.plan)
  const setModel = (m: ArrivalModel, record = true) => s.mutate((p) => ({ ...p, arrival: m }), record)
  const [total, setTotal] = useState(() => expectedCrowd(s.plan) || 1000)
  const [mins, setMins] = useState(60)
  const peak = rows.reduce((a, b) => (b.queue > a.queue ? b : a), rows[0] ?? { queue: 0, waitMin: 0, lengthM: 0, time: '' })
  const cleared = rows.find((r, i) => i >= model.slots.length - 1 && r.queue === 0)

  return (
    <Section title="Arrivals" badge={!ents.length ? <Warn>No entrances</Warn> : peak.queue > 0 ? <span className="font-mono text-xs text-muted">peak wait {fmtMin(peak.waitMin)}</span> : undefined}>
      {ents.length ? (
        <ul className="divide-y divide-bg-2 rounded-lg border border-bg-2">
          {ents.map(({ e, per15 }) => (
            <li key={e.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
              <button className="min-w-0 flex-1 truncate text-left hover:text-accent-deep" onClick={() => show(e)}>{e.label}</button>
              <span className="font-mono">{per15} / 15 min</span>
            </li>
          ))}
          <li className="flex justify-between px-3 py-1.5 text-xs font-semibold"><span>All entrances</span><span className="font-mono">{capacity} / 15 min</span></li>
        </ul>
      ) : (
        <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700">Add registration desks or security checkpoints, then set how many people each handles per 15 minutes in the Inspector.</p>
      )}
      {!ro && (
        <div className="flex flex-wrap items-end gap-1 text-xs">
          <span className="pb-1.5 text-muted">Spread</span>
          <input type="number" min={0} className="input h-7 w-20 font-mono" value={total} onChange={(e) => setTotal(Math.max(0, +e.target.value || 0))} />
          <span className="pb-1.5 text-muted">people over</span>
          <input type="number" min={15} step={15} className="input h-7 w-16 font-mono" value={mins} onChange={(e) => setMins(Math.max(15, +e.target.value || 15))} />
          <span className="pb-1.5 text-muted">min</span>
          <button className="btn h-7 border border-bg-2 px-2 text-xs" onClick={() => {
            const n = Math.max(1, Math.round(mins / 15))
            const each = Math.floor(total / n)
            setModel({ ...model, slots: Array.from({ length: n }, (_, i) => each + (i < total - each * n ? 1 : 0)) })
          }}>Fill</button>
        </div>
      )}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted">Doors open</span>
        <input type="time" className="input h-7 w-28" disabled={ro} value={model.start} onChange={(e) => setModel({ ...model, start: e.target.value || '18:00' })} />
      </div>
      <table className="w-full text-xs">
        <thead><tr className="text-left text-[10px] uppercase tracking-wide text-muted">
          <th className="py-1 font-normal">Time</th><th className="font-normal">Arrive</th><th className="font-normal">Queue</th><th className="font-normal">Wait</th><th className="font-normal">Line</th>
        </tr></thead>
        <tbody className="font-mono">
          {rows.map((r, i) => (
            <tr key={i} className={r.queue > 0 ? 'text-red-700' : ''}>
              <td className="py-0.5">{r.time}</td>
              <td>{i < model.slots.length && !ro ? (
                <input type="number" min={0} className="input h-6 w-16 px-1 text-xs" value={model.slots[i]}
                  onChange={(e) => setModel({ ...model, slots: model.slots.map((v, k) => (k === i ? Math.max(0, Math.round(+e.target.value || 0)) : v)) }, false)} />
              ) : r.arrivals}</td>
              <td>{r.queue}</td><td>{fmtMin(r.waitMin)}</td><td>{r.lengthM} m</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!ro && (
        <div className="flex gap-1">
          <button className="btn h-7 border border-bg-2 px-2 text-xs" onClick={() => setModel({ ...model, slots: [...model.slots, 0] })}>+ 15 min</button>
          {model.slots.length > 1 && <button className="btn h-7 border border-bg-2 px-2 text-xs" onClick={() => setModel({ ...model, slots: model.slots.slice(0, -1) })}>Remove last</button>}
        </div>
      )}
      <p className="text-xs text-ink-2">
        {peak.queue > 0
          ? <>Longest queue <b>{peak.queue}</b> people (about <b>{peak.lengthM} m</b>, <b>{fmtMin(peak.waitMin)}</b> wait) at {peak.time}{cleared ? `; clears by ${cleared.time}` : ''}.</>
          : 'No queue builds up with this capacity.'}
      </p>
      <p className="text-[11px] text-muted">Queue = previous queue + arrivals − capacity, per 15 minutes; about 4 people per meter of queue.</p>
    </Section>
  )
}

function PowerSection() {
  const s = usePlanStore()
  const pb = powerBudget(s.plan)
  const over = pb.draw > pb.supply
  return (
    <Section title="Power" badge={over ? <Warn>{(pb.draw - pb.supply).toFixed(1)} kW short</Warn> : pb.draw ? <span className="font-mono text-xs text-muted">{pb.draw.toFixed(1)} / {pb.supply} kW</span> : undefined}>
      <div className="h-2 overflow-hidden rounded-full bg-bg-2">
        <div className={`h-full ${over ? 'bg-red-600' : 'bg-accent'}`} style={{ width: `${Math.min(100, pb.supply ? (pb.draw / pb.supply) * 100 : pb.draw ? 100 : 0)}%` }} />
      </div>
      <p className="text-xs">Drawing <b>{pb.draw.toFixed(1)} kW</b> of <b>{pb.supply} kW</b> available.</p>
      {pb.zones.length > 0 && (
        <table className="w-full text-xs">
          <thead><tr className="text-left text-[10px] uppercase tracking-wide text-muted"><th className="py-1 font-normal">Zone</th><th className="font-normal">Supply</th><th className="font-normal">Draw</th><th /></tr></thead>
          <tbody>{pb.zones.map((z) => (
            <tr key={z.zone}><td className="py-0.5">{z.zone}</td><td className="font-mono">{z.supply} kW</td><td className="font-mono">{z.draw.toFixed(1)} kW</td>
              <td>{z.supply && z.draw > z.supply ? <span className="text-red-600">over</span> : ''}</td></tr>
          ))}</tbody>
        </table>
      )}
      <p className="text-[11px] text-muted">Supply comes from generators and mains points (Inspector, Power supply). Draw comes from each object's Vendor & logistics section.</p>
    </Section>
  )
}

function ScheduleSection() {
  const s = usePlanStore()
  const items = scheduleItems(s.plan)
  const cl = clashes(items)
  const vendors = new Set(items.map((i) => i.vendor))
  return (
    <Section title="Load-in schedule" badge={cl.length ? <Warn>{cl.length} clash{cl.length > 1 ? 'es' : ''}</Warn> : items.length ? <span className="font-mono text-xs text-muted">{items.length}</span> : undefined}>
      <p className="text-xs">{items.length ? <>{items.length} objects from {vendors.size} vendor{vendors.size > 1 ? 's' : ''} have load-in or load-out times.</> : 'Set load-in and load-out times in each object’s Vendor & logistics section to build the schedule.'}</p>
      <button className="btn w-full justify-center border border-bg-2" disabled={!items.length} onClick={() => s.set({ dialog: 'schedule' })}><CalendarClock size={15} />Open schedule</button>
    </Section>
  )
}

function InventorySection() {
  const s = usePlanStore()
  const lines = inventory(s.plan)
  return (
    <Section title="Inventory" badge={<span className="font-mono text-xs text-muted">{s.plan.elements.length}</span>}>
      {lines.length ? (
        <table className="w-full text-xs">
          <tbody>{lines.slice(0, 14).map((l) => (
            <tr key={l.kind}><td className="py-0.5">{l.name}</td><td className="text-right font-mono">{l.unit === 'pcs' ? l.count : `${l.quantity} ${l.unit}`}</td></tr>
          ))}</tbody>
        </table>
      ) : <p className="text-xs text-muted">Nothing placed yet.</p>}
      {lines.length > 14 && <p className="text-[11px] text-muted">+{lines.length - 14} more types in the export.</p>}
      <div className="flex gap-1">
        <button className="btn flex-1 justify-center border border-bg-2 text-xs" disabled={!lines.length}
          onClick={() => download(`${slug(s.plan.name)}-inventory.csv`, inventoryCsv(s.plan, 'objects'), 'text/csv')}><Download size={14} />Every object</button>
        <button className="btn flex-1 justify-center border border-bg-2 text-xs" disabled={!lines.length}
          onClick={() => download(`${slug(s.plan.name)}-counts.csv`, inventoryCsv(s.plan, 'counts'), 'text/csv')}><Download size={14} />Counts by type</button>
      </div>
    </Section>
  )
}

function CommentsSection() {
  const s = usePlanStore()
  const all = s.plan.comments ?? []
  const open = all.filter((c) => !c.resolved)
  const list = s.showResolved ? all : open
  const go = (id: string) => {
    const c = all.find((x) => x.id === id)!
    s.set({ levelId: c.levelId ?? null, activeComment: id, showComments: true, showResolved: s.showResolved || !!c.resolved })
    requestAnimationFrame(() => requestFocus({ x: c.x, y: c.y }))
  }
  return (
    <Section title="Comments" badge={open.length ? <span className="rounded-full bg-accent-deep px-1.5 text-[11px] leading-4 text-white">{open.length}</span> : undefined}>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="accent-[#1ea7e8]" checked={s.showResolved} onChange={(e) => s.set({ showResolved: e.target.checked })} />Show resolved</label>
      <ul className="space-y-1">
        {list.map((c) => (
          <li key={c.id}>
            <button className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-bg" onClick={() => go(c.id)}>
              <MapPin size={14} className={`mt-0.5 shrink-0 ${c.resolved ? 'text-muted' : 'text-accent-deep'}`} />
              <span className="min-w-0 flex-1">
                <span className={`line-clamp-2 text-xs ${c.resolved ? 'text-muted line-through' : 'text-ink'}`}>{all.indexOf(c) + 1}. {c.body}</span>
                <span className="text-[11px] text-muted">{c.author} · {ago(c.createdAt)}{c.replies.length ? ` · ${c.replies.length} repl${c.replies.length > 1 ? 'ies' : 'y'}` : ''}</span>
              </span>
            </button>
          </li>
        ))}
        {!list.length && <li className="text-xs text-muted">No open comments.</li>}
      </ul>
    </Section>
  )
}

const slug = (s: string) => s.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'event'
