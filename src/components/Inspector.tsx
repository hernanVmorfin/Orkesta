import { Copy, Trash2, Lock, Unlock, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter, AlignHorizontalSpaceAround, AlignVerticalSpaceAround, X } from 'lucide-react'
import { usePlanStore, seatsUsed } from '../store/usePlanStore'
import { CATALOG, LAYERS, isTableKind } from '../lib/catalog'
import type { PlanElement } from '../types'

function Num({ label, value, onChange, step = 0.1, disabled }: { label: string; value: number; onChange: (v: number) => void; step?: number; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input type="number" step={step} disabled={disabled} className="input font-mono" value={Number.isFinite(value) ? +value.toFixed(2) : 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
    </label>
  )
}

export function Inspector() {
  const s = usePlanStore()
  const sel = s.plan.elements.filter((e) => s.selection.includes(e.id))

  if (!sel.length)
    return (
      <div className="p-4 text-sm text-muted">
        <p className="mb-3">Select an object on the plan to edit its size, rotation, label and notes.</p>
        <div className="eyebrow mb-1">Shortcuts</div>
        <ul className="space-y-1 font-mono text-[11px]">
          <li>Del · delete</li><li>Ctrl+D · duplicate</li><li>Ctrl+Z / Ctrl+Shift+Z · undo/redo</li>
          <li>Arrows · nudge 0.1 m (Shift 1 m)</li><li>R · rotate 15°</li><li>M · measure · V · select · F · fit</li>
          <li>Shift+drag · box select · Alt+drag · pan</li>
        </ul>
      </div>
    )

  if (sel.length > 1) return <MultiInspector sel={sel} />

  const e = sel[0]
  const c = CATALOG[e.kind]
  const ro = s.viewOnly || !!e.locked
  const up = (patch: Partial<PlanElement>) => s.updateElement(e.id, patch)
  const isTable = isTableKind(e.kind)
  const guests = s.plan.guests.filter((g) => g.tableId === e.id)
  const unassigned = s.plan.guests.filter((g) => !g.tableId)

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="eyebrow">{c?.name ?? e.kind} · {LAYERS.find((l) => l.id === e.layer)?.name}</div>
        <input className="mt-1 w-full bg-transparent text-lg font-semibold outline-none" disabled={ro} value={e.label} onChange={(ev) => up({ label: ev.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Num label="X (m)" value={e.x} onChange={(x) => up({ x })} disabled={ro} />
        <Num label="Y (m)" value={e.y} onChange={(y) => up({ y })} disabled={ro} />
        <Num label="Width (m)" value={e.w} onChange={(w) => up({ w: Math.max(0.05, w) })} disabled={ro} />
        <Num label="Depth (m)" value={e.h} onChange={(h) => up({ h: Math.max(0.05, h) })} disabled={ro} />
        <Num label="Rotation °" value={e.rotation} step={15} onChange={(r) => up({ rotation: ((r % 360) + 360) % 360 })} disabled={ro} />
        {isTable && <Num label="Seats" value={e.seats ?? 0} step={1} onChange={(n) => up({ seats: Math.max(1, Math.round(n)) })} disabled={ro} />}
        {isTable && <Num label="Table #" value={e.number ?? 0} step={1} onChange={(n) => up({ number: Math.round(n), label: `Table ${Math.round(n)}` })} disabled={ro} />}
      </div>

      {isTable && (
        <div>
          <span className="eyebrow">Table tag</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {s.plan.tags.map((t) => (
              <button key={t.id} disabled={s.viewOnly} onClick={() => up({ tag: t.id })}
                className={`rounded-full border px-2 py-0.5 text-[11px] ${e.tag === t.id ? 'text-white' : 'text-ink-2'}`}
                style={{ borderColor: t.color, background: e.tag === t.id ? t.color : 'transparent' }}>{t.name}</button>
            ))}
          </div>
        </div>
      )}

      {isTable && (
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="eyebrow">Guests {seatsUsed(s.plan, e.id)}/{e.seats}</span>
          </div>
          <ul className="space-y-1">
            {guests.map((g) => (
              <li key={g.id} className="flex items-center justify-between rounded-md bg-bg px-2 py-1 text-sm">
                <span className="truncate">{g.name}<span className="ml-1 text-[11px] text-muted">{g.company}</span></span>
                {!s.viewOnly && <button onClick={() => s.assignGuest(g.id, null)} className="text-muted hover:text-red-600"><X size={14} /></button>}
              </li>
            ))}
            {!guests.length && <li className="text-xs text-muted">No guests yet. Drag guests from the Tables tab onto this table.</li>}
          </ul>
          {!s.viewOnly && unassigned.length > 0 && guests.length < (e.seats ?? 0) && (
            <select className="input mt-2" value="" onChange={(ev) => ev.target.value && s.assignGuest(ev.target.value, e.id)}>
              <option value="">+ Seat an unassigned guest…</option>
              {unassigned.map((g) => <option key={g.id} value={g.id}>{g.name}{g.company ? ` · ${g.company}` : ''}</option>)}
            </select>
          )}
        </div>
      )}

      <label className="block">
        <span className="eyebrow">Notes for vendors</span>
        <textarea className="input h-20 py-1" disabled={s.viewOnly} value={e.notes ?? ''} onChange={(ev) => up({ notes: ev.target.value })} />
      </label>

      {!s.viewOnly && (
        <div className="flex gap-1">
          <button className="btn" onClick={() => up({ locked: !e.locked })}>{e.locked ? <Unlock size={15} /> : <Lock size={15} />}{e.locked ? 'Unlock' : 'Lock'}</button>
          <button className="btn" onClick={s.duplicateSelected}><Copy size={15} />Duplicate</button>
          <button className="btn text-red-600" onClick={s.deleteSelected} disabled={e.locked}><Trash2 size={15} />Delete</button>
        </div>
      )}
    </div>
  )
}

function MultiInspector({ sel }: { sel: PlanElement[] }) {
  const s = usePlanStore()
  const ids = sel.map((e) => e.id)
  const avgX = sel.reduce((n, e) => n + e.x, 0) / sel.length
  const avgY = sel.reduce((n, e) => n + e.y, 0) / sel.length
  const distribute = (axis: 'x' | 'y') => {
    const sorted = [...sel].sort((a, b) => a[axis] - b[axis])
    const lo = sorted[0][axis], hi = sorted[sorted.length - 1][axis]
    const step = (hi - lo) / (sorted.length - 1 || 1)
    const pos = new Map(sorted.map((e, i) => [e.id, lo + step * i]))
    s.updateMany((e) => ({ ...e, [axis]: +pos.get(e.id)!.toFixed(3) }), ids)
  }
  const tables = sel.filter((e) => isTableKind(e.kind))
  return (
    <div className="space-y-4 p-4">
      <div className="text-lg font-semibold">{sel.length} objects selected</div>
      {!s.viewOnly && (
        <>
          <div>
            <span className="eyebrow">Align & distribute</span>
            <div className="mt-1 grid grid-cols-2 gap-1">
              <button className="btn" onClick={() => s.updateMany((e) => ({ ...e, y: +avgY.toFixed(3) }), ids)}><AlignVerticalJustifyCenter size={15} />Align row</button>
              <button className="btn" onClick={() => s.updateMany((e) => ({ ...e, x: +avgX.toFixed(3) }), ids)}><AlignHorizontalJustifyCenter size={15} />Align column</button>
              <button className="btn" onClick={() => distribute('x')}><AlignHorizontalSpaceAround size={15} />Space X</button>
              <button className="btn" onClick={() => distribute('y')}><AlignVerticalSpaceAround size={15} />Space Y</button>
            </div>
          </div>
          {tables.length > 0 && (
            <div>
              <span className="eyebrow">Tag {tables.length} tables</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {s.plan.tags.map((t) => (
                  <button key={t.id} onClick={() => s.updateMany((e) => (isTableKind(e.kind) ? { ...e, tag: t.id } : e), ids)}
                    className="rounded-full border px-2 py-0.5 text-[11px]" style={{ borderColor: t.color }}>{t.name}</button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-1">
            <button className="btn" onClick={s.duplicateSelected}><Copy size={15} />Duplicate</button>
            <button className="btn text-red-600" onClick={s.deleteSelected}><Trash2 size={15} />Delete</button>
          </div>
        </>
      )}
    </div>
  )
}
