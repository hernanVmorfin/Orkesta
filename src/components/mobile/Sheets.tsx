import { X, Check, CheckCircle2, MapPin } from 'lucide-react'
import { usePlanStore } from '../../store/usePlanStore'
import { checkIn, useCanCheckIn } from '../../store/team'
import { CATALOG, LAYERS, isTableKind } from '../../lib/catalog'
import type { Guest, PlanElement, TableTag } from '../../types'

/** Bottom sheet frame shared by the phone tabs; sits at the bottom of the nearest positioned container. */
function Sheet({ title, badge, sub, onClose, children }: { title: string; badge?: TableTag; sub: string; onClose: () => void; children?: React.ReactNode }) {
  return (
    <div role="dialog" aria-label={title}
      className="absolute inset-x-0 bottom-0 z-20 max-h-[55%] overflow-y-auto rounded-t-2xl border-t border-bg-2 bg-white px-4 pb-4 pt-2 shadow-[0_-8px_24px_rgba(10,23,41,0.12)]">
      <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-bg-2" />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[17px] font-semibold text-ink">{title}</h2>
            {badge && <TagBadge tag={badge} />}
          </div>
          <div className="truncate text-[13px] text-muted">{sub}</div>
        </div>
        <button aria-label="Close details" onClick={onClose} className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted active:bg-bg"><X size={19} /></button>
      </div>
      {children}
    </div>
  )
}

export function TagBadge({ tag }: { tag: TableTag }) {
  return <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium text-white" style={{ background: tag.color }}>{tag.name}</span>
}

export function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={`h-9 shrink-0 rounded-full border px-3.5 text-[13px] ${active ? 'border-accent bg-accent/10 text-accent-deep' : 'border-bg-2 text-ink-2 active:bg-bg'}`}>
      {children}
    </button>
  )
}

/** Big round check-in toggle for admins and staff. View-only links can't save, so they only show the status. */
export function CheckInToggle({ g }: { g: Guest }) {
  const canCheckIn = useCanCheckIn()
  if (!canCheckIn) return g.checkedIn ? <CheckCircle2 size={18} className="mx-3 shrink-0 text-green-600" aria-label="Checked in" /> : <span className="w-11 shrink-0" />
  return (
    <button aria-pressed={!!g.checkedIn} aria-label={g.checkedIn ? `Undo check-in for ${g.name}` : `Check in ${g.name}`}
      onClick={() => checkIn(g.id, !g.checkedIn)}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border ${g.checkedIn ? 'border-green-600 bg-green-50 text-green-700' : 'border-bg-2 text-muted active:bg-bg'}`}>
      <Check size={18} />
    </button>
  )
}

/** A table (who sits there) or any other object (what it is). */
export function ObjectSheet({ e, foundGuest, onClose, onShowOnMap }: { e: PlanElement; foundGuest: string | null; onClose: () => void; onShowOnMap?: () => void }) {
  const plan = usePlanStore((s) => s.plan)
  const linkViewOnly = usePlanStore((s) => s.linkViewOnly)
  const isTable = isTableKind(e.kind)
  const tag = isTable ? plan.tags.find((t) => t.id === e.tag) : undefined
  const guests = isTable ? plan.guests.filter((g) => g.tableId === e.id) : []
  const kind = CATALOG[e.kind]?.name ?? e.kind
  const layer = LAYERS.find((l) => l.id === e.layer)?.name

  return (
    <Sheet title={e.label} badge={tag} onClose={onClose}
      sub={isTable ? `${guests.length}/${e.seats ?? 0} seated` : [kind, layer].filter(Boolean).join(' · ')}>
      {onShowOnMap && (
        <button className="btn mt-2 h-11 w-full justify-center border border-bg-2" onClick={onShowOnMap}><MapPin size={16} />Show on map</button>
      )}
      {isTable && (guests.length > 0 ? (
        <ul className="mt-1 divide-y divide-bg-2">
          {guests.map((g) => (
            <li key={g.id} className={`flex min-h-11 items-center gap-2 py-2 ${g.id === foundGuest ? 'text-accent-deep' : 'text-ink'}`}>
              <span className={`min-w-0 flex-1 truncate text-[15px] ${g.id === foundGuest ? 'font-semibold' : ''}`}>{g.name}</span>
              {g.company && <span className="max-w-[40%] truncate text-xs text-muted">{g.company}</span>}
              {g.checkedIn && <CheckCircle2 size={16} className="shrink-0 text-green-600" aria-label="Checked in" />}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">{linkViewOnly && !plan.guests.length ? 'Guest names aren’t included in this link.' : 'No guests at this table yet.'}</p>
      ))}
      {!isTable && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">Size</dt>
          <dd className="font-mono text-ink">{e.w.toFixed(2)} × {e.h.toFixed(2)} m</dd>
        </dl>
      )}
      {e.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-ink"><span className="text-muted">Notes · </span>{e.notes}</p>}
    </Sheet>
  )
}

/** One guest: table, details (links leave out dietary notes and emails; staff get no emails), and check-in. */
export function GuestSheet({ g, onClose, onShowOnMap }: { g: Guest; onClose: () => void; onShowOnMap?: (tableId: string) => void }) {
  const plan = usePlanStore((s) => s.plan)
  const canCheckIn = useCanCheckIn()
  const table = plan.elements.find((e) => e.id === g.tableId)
  const tag = g.tag ? plan.tags.find((t) => t.id === g.tag) : undefined

  return (
    <Sheet title={g.name} badge={tag} sub={[g.company, g.group].filter(Boolean).join(' · ') || 'Guest'} onClose={onClose}>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">Table</dt>
        <dd className={table ? 'text-ink' : 'text-red-600'}>{table ? table.label : 'No table yet'}</dd>
        {g.dietary && <><dt className="text-muted">Dietary</dt><dd className="text-ink">{g.dietary}</dd></>}
        {g.email && <><dt className="text-muted">Email</dt><dd className="truncate text-ink">{g.email}</dd></>}
      </dl>
      <div className="mt-3 flex gap-2">
        {table && onShowOnMap && (
          <button className="btn h-11 flex-1 justify-center border border-bg-2" onClick={() => onShowOnMap(table.id)}><MapPin size={16} />Show on map</button>
        )}
        {canCheckIn && (
          <button className={`btn h-11 flex-1 justify-center ${g.checkedIn ? 'border border-green-600 text-green-700' : 'btn-primary'}`}
            aria-pressed={!!g.checkedIn} onClick={() => checkIn(g.id, !g.checkedIn)}>
            {g.checkedIn ? <><CheckCircle2 size={16} />Checked in</> : <><Check size={16} />Check in</>}
          </button>
        )}
      </div>
    </Sheet>
  )
}
