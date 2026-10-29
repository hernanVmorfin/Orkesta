import { useMemo, useState } from 'react'
import { Check, Download, MapPin, Share2, ShieldCheck, TriangleAlert } from 'lucide-react'
import { usePlanStore } from '../../store/usePlanStore'
import { isTableKind } from '../../lib/catalog'
import { clearanceIssues } from '../../lib/geometry'
import { canvasRef } from '../../lib/canvas'
import { shareUrl } from '../../lib/share'
import { summarize } from '../../lib/db'

/** Phone Details tab: event summary, safety status, PDF, sharing and (on your own phone) switching events. */
export function MobileDetails() {
  const s = usePlanStore()
  const { plan, viewOnly } = s
  const [busy, setBusy] = useState(false)

  const tables = plan.elements.filter((e) => isTableKind(e.kind))
  const seats = tables.reduce((n, t) => n + (t.seats ?? 0), 0)
  const seated = plan.guests.filter((g) => g.tableId).length
  const checkedIn = plan.guests.filter((g) => g.checkedIn).length
  const conflicts = useMemo(
    () => clearanceIssues(plan.elements.filter((e) => plan.layers[e.layer]?.visible !== false), plan.minAisleM).length,
    [plan.elements, plan.layers, plan.minAisleM],
  )
  const date = plan.date
    ? new Date(`${plan.date}T00:00`).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
    : 'Date not set'
  const tagCounts = plan.tags
    .map((t) => ({ ...t, n: tables.filter((x) => (x.tag ?? 'general') === t.id).length }))
    .filter((t) => t.n > 0)
  const events = viewOnly ? [] : s.events.some((e) => e.id === plan.id) ? s.events : [summarize(plan), ...s.events]

  const downloadPdf = async () => {
    if (!canvasRef.current) return
    setBusy(true)
    try { await (await import('../../lib/exportPlan')).exportPdf(canvasRef.current, plan) } catch { toast('Couldn’t create the PDF. Try again.') }
    setBusy(false)
  }

  /** Shares a view-only link without guest details (or passes this link on), falling back to the clipboard. */
  const share = async () => {
    const url = viewOnly ? window.location.href : shareUrl(plan, true)
    if (navigator.share) {
      try { await navigator.share({ title: plan.name, url }); return } catch (err) { if ((err as Error).name === 'AbortError') return }
    }
    try { await navigator.clipboard.writeText(url); toast('Link copied') } catch { toast('Couldn’t copy the link') }
  }

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="space-y-5 p-4">
        <section>
          <h2 className="text-lg font-semibold text-ink">{plan.name}</h2>
          <p className="text-sm text-muted">{date}{plan.venue ? ` · ${plan.venue}` : ''}</p>
          {plan.geo?.label && (
            <p className="mt-1 flex items-start gap-1 text-xs text-muted"><MapPin size={13} className="mt-0.5 shrink-0" /><span className="line-clamp-2">{plan.geo.label}</span></p>
          )}
        </section>

        <section className="grid grid-cols-2 gap-2">
          {([['Tables', tables.length], ['Seats', seats], ['Seated', `${seated}/${plan.guests.length}`], ['Checked in', checkedIn]] as const).map(([label, value]) => (
            <div key={label} className="rounded-xl bg-bg p-3">
              <div className="text-xs text-muted">{label}</div>
              <div className="font-mono text-xl font-semibold text-ink">{value}</div>
            </div>
          ))}
        </section>

        <section className="divide-y divide-bg-2 rounded-xl border border-bg-2">
          <div className="flex min-h-12 items-center gap-3 px-3 py-2 text-sm">
            {conflicts
              ? <><TriangleAlert size={18} className="shrink-0 text-red-600" /><span className="text-ink">{conflicts} aisle {conflicts === 1 ? 'conflict' : 'conflicts'} under {plan.minAisleM} m</span></>
              : <><ShieldCheck size={18} className="shrink-0 text-green-600" /><span className="text-ink">No aisle conflicts (minimum {plan.minAisleM} m)</span></>}
          </div>
          {tagCounts.map((t) => (
            <div key={t.id} className="flex min-h-12 items-center gap-3 px-3 py-2 text-sm">
              <span className="ml-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color }} />
              <span className="flex-1 text-ink">{t.name}</span>
              <span className="text-muted">{t.n} {t.n === 1 ? 'table' : 'tables'}</span>
            </div>
          ))}
        </section>

        <section className="space-y-2">
          <button className="btn h-12 w-full justify-center border border-bg-2 text-[15px]" disabled={busy} onClick={() => void downloadPdf()}>
            <Download size={17} />{busy ? 'Creating PDF…' : 'Download PDF plan'}
          </button>
          <button className="btn h-12 w-full justify-center border border-bg-2 text-[15px]" onClick={() => void share()}>
            <Share2 size={17} />{viewOnly ? 'Share this link' : 'Share view-only link'}
          </button>
          {!viewOnly && <p className="text-xs text-muted">The shared link includes the plan and satellite view, but no guest details or uploaded drawings.</p>}
        </section>

        {events.length > 0 && (
          <section>
            <div className="eyebrow mb-1">Your events</div>
            <ul className="divide-y divide-bg-2 rounded-xl border border-bg-2">
              {events.map((ev) => (
                <li key={ev.id}>
                  <button className="flex min-h-14 w-full items-center gap-2 px-3 py-2 text-left active:bg-bg" onClick={() => void s.openEvent(ev.id)}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] text-ink">{ev.name || 'Untitled event'}</div>
                      <div className="truncate text-xs text-muted">{[ev.venue, ev.date].filter(Boolean).join(' · ') || 'No venue yet'}</div>
                    </div>
                    {ev.id === plan.id && <Check size={18} className="shrink-0 text-accent-deep" aria-label="Open now" />}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

const toast = (msg: string) => window.dispatchEvent(new CustomEvent('fp:toast', { detail: msg }))
