import { Fragment, useState } from 'react'
import { Copy, Trash2, Lock, Unlock, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter, AlignHorizontalSpaceAround, AlignVerticalSpaceAround, X, ChevronRight, EyeOff, Grid2x2, FolderPlus } from 'lucide-react'
import { usePlanStore, seatsUsed } from '../store/usePlanStore'
import { CATALOG, LAYERS, isTableKind } from '../lib/catalog'
import { CALCS, calcInputs, calcOf } from '../lib/calcs'
import { fmtArea, fmtLen, pathLength, polygonArea } from '../lib/shapes'
import { cellRef } from '../lib/gridref'
import type { ElementStyle, LinePattern, ObjectSetup, PlanElement } from '../types'

function Num({ label, value, onChange, step = 0.1, disabled }: { label: string; value: number; onChange: (v: number) => void; step?: number; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input type="number" step={step} disabled={disabled} className="input font-mono" value={Number.isFinite(value) ? +value.toFixed(2) : 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
    </label>
  )
}

/** Collapsible block; open state survives switching objects. */
function Section({ id, title, children, defaultOpen = false }: { id: string; title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(() => openSections[id] ?? defaultOpen)
  const toggle = () => { openSections[id] = !open; setOpen(!open) }
  return (
    <div className="rounded-lg border border-bg-2">
      <button className="flex w-full items-center gap-1 px-3 py-2 text-left text-xs font-semibold text-ink-2" onClick={toggle}>
        <ChevronRight size={14} className={open ? 'rotate-90 transition' : 'transition'} />{title}
      </button>
      {open && <div className="space-y-2 border-t border-bg-2 p-3">{children}</div>}
    </div>
  )
}
const openSections: Record<string, boolean> = {}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[11px] text-muted">{label}</span>{children}</label>
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
          <li>Del · delete</li><li>Ctrl+C / Ctrl+V · copy / paste</li><li>Ctrl+D · duplicate</li><li>Ctrl+Z / Ctrl+Shift+Z · undo/redo</li>
          <li>Arrows · nudge 0.1 m (Shift 1 m)</li><li>R · rotate 15°</li><li>] / [ · bring to front / send to back</li>
          <li>M · measure · V · select · C · comment · F · fit</li>
          <li>Shift+drag · box select · Alt+drag · pan · right-click · menu</li>
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
  const drawn = !!e.points?.length
  const area = c?.geometry === 'polygon'

  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="eyebrow">{c?.name ?? e.kind} · {LAYERS.find((l) => l.id === e.layer)?.name}{cellRef(s.plan, e) ? ` · cell ${cellRef(s.plan, e)}` : ''}</div>
        <input className="mt-1 w-full bg-transparent text-lg font-semibold outline-none" disabled={ro} value={e.label} onChange={(ev) => up({ label: ev.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Num label="X (m)" value={e.x} onChange={(x) => up({ x })} disabled={ro} />
        <Num label="Y (m)" value={e.y} onChange={(y) => up({ y })} disabled={ro} />
        {!drawn && <Num label="Width (m)" value={e.w} onChange={(w) => up({ w: Math.max(0.05, w) })} disabled={ro} />}
        {!drawn && <Num label="Depth (m)" value={e.h} onChange={(h) => up({ h: Math.max(0.05, h) })} disabled={ro} />}
        <Num label="Rotation °" value={e.rotation} step={15} onChange={(r) => up({ rotation: ((r % 360) + 360) % 360 })} disabled={ro} />
        {isTable && <Num label="Seats" value={e.seats ?? 0} step={1} onChange={(n) => up({ seats: Math.max(1, Math.round(n)) })} disabled={ro} />}
        {isTable && <Num label="Table #" value={e.number ?? 0} step={1} onChange={(n) => up({ number: Math.round(n), label: `Table ${Math.round(n)}` })} disabled={ro} />}
      </div>

      {drawn && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg bg-bg p-3 text-sm">
          {area ? (
            <>
              <dt className="text-muted">Area</dt><dd className="font-mono">{fmtArea(polygonArea(e.points!))}</dd>
              <dt className="text-muted">Perimeter</dt><dd className="font-mono">{fmtLen(pathLength(e.points!, true))}</dd>
            </>
          ) : (
            <><dt className="text-muted">Length</dt><dd className="font-mono">{fmtLen(pathLength(e.points!))}</dd></>
          )}
          <dt className="text-muted">Points</dt><dd className="font-mono">{e.points!.length}</dd>
        </dl>
      )}

      <CalcSection e={e} ro={ro} />

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

      {!isTable && <StyleSection e={e} ro={ro} />}
      <SetupSection e={e} ro={s.viewOnly} />

      <label className="block">
        <span className="eyebrow">Notes for vendors</span>
        <textarea className="input h-20 py-1" disabled={s.viewOnly} value={e.notes ?? ''} onChange={(ev) => up({ notes: ev.target.value })} />
      </label>

      {!s.viewOnly && (
        <div className="flex flex-wrap gap-1">
          <button className="btn" onClick={() => up({ locked: !e.locked })}>{e.locked ? <Unlock size={15} /> : <Lock size={15} />}{e.locked ? 'Unlock' : 'Lock'}</button>
          <button className="btn" onClick={() => s.setHidden([e.id], true)} title="Hide (show it again from the Layers tab)"><EyeOff size={15} />Hide</button>
          <button className="btn" onClick={s.duplicateSelected}><Copy size={15} />Duplicate</button>
          <button className="btn" onClick={() => s.set({ dialog: 'repeat' })} title="Copy into rows and columns"><Grid2x2 size={15} />Repeat</button>
          <button className="btn text-red-600" onClick={s.deleteSelected} disabled={e.locked}><Trash2 size={15} />Delete</button>
        </div>
      )}
    </div>
  )
}

/** Inputs and live results of the object's calculator. */
function CalcSection({ e, ro }: { e: PlanElement; ro: boolean }) {
  const s = usePlanStore()
  const id = calcOf(e)
  if (!id) return null
  const def = CALCS[id]
  const v = calcInputs(e)
  const set = (key: string, value: number) => s.updateElement(e.id, { calc: { ...e.calc, [key]: value } })
  return (
    <div className="space-y-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
      <div className="text-xs font-semibold text-ink-2">{def.title}</div>
      {def.fields.map((f) => (
        <Field key={f.key} label={`${f.label}${f.unit ? ` (${f.unit})` : ''}`}>
          {f.options ? (
            <select className="input" disabled={ro} value={v[f.key] ?? ''} onChange={(ev) => set(f.key, +ev.target.value)}>
              {!f.options.some((o) => o.value === v[f.key]) && <option value={v[f.key]}>{v[f.key]}</option>}
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input type="number" className="input font-mono" disabled={ro} step={f.step} min={f.min} value={v[f.key] ?? 0}
              onChange={(ev) => set(f.key, Math.max(f.min ?? -Infinity, parseFloat(ev.target.value) || 0))} />
          )}
        </Field>
      ))}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {def.run(e, v, s.plan).map((r) => (
          <Fragment key={r.label}><dt className="text-muted">{r.label}</dt><dd className="font-mono font-semibold text-ink">{r.value}</dd></Fragment>
        ))}
      </dl>
      {def.hint && <p className="text-[11px] text-muted">{def.hint}</p>}
    </div>
  )
}

const PATTERNS: { value: LinePattern; label: string }[] = [
  { value: 'none', label: 'None' }, { value: 'ticks', label: 'Section ticks' }, { value: 'arrows', label: 'Arrows' },
  { value: 'chevrons', label: 'Chevrons' }, { value: 'dots', label: 'Posts / cones' },
]

function StyleSection({ e, ro }: { e: PlanElement; ro: boolean }) {
  const s = usePlanStore()
  const c = CATALOG[e.kind]
  const st: ElementStyle = { ...c?.style, ...e.style }
  const setStyle = (patch: ElementStyle) => s.updateElement(e.id, { style: { ...e.style, ...patch } })
  const drawn = !!e.points?.length
  const area = c?.geometry === 'polygon'
  const color = e.color ?? c?.color ?? '#5b6576'

  return (
    <Section id="style" title="Style">
      {drawn && !area && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Colour"><input type="color" className="input p-0.5" disabled={ro} value={st.stroke ?? color} onChange={(ev) => setStyle({ stroke: ev.target.value })} /></Field>
          <Field label="Width (m)"><input type="number" step={0.02} min={0.01} className="input font-mono" disabled={ro} value={st.strokeWidth ?? 0.1}
            onChange={(ev) => setStyle({ strokeWidth: Math.max(0.01, parseFloat(ev.target.value) || 0.01) })} /></Field>
          <Field label="Line"><LineStyle st={st} ro={ro} onChange={setStyle} /></Field>
          <Field label="Pattern">
            <select className="input" disabled={ro} value={st.pattern ?? 'none'} onChange={(ev) => setStyle({ pattern: ev.target.value as LinePattern })}>
              {PATTERNS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
        </div>
      )}
      {drawn && area && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Fill"><input type="color" className="input p-0.5" disabled={ro} value={st.fill ?? color} onChange={(ev) => setStyle({ fill: ev.target.value })} /></Field>
          <Field label={`Fill opacity ${Math.round((st.fillOpacity ?? 0.1) * 100)}%`}>
            <input type="range" min={0} max={1} step={0.05} className="h-[30px] w-full accent-[#1ea7e8]" disabled={ro} value={st.fillOpacity ?? 0.1}
              onChange={(ev) => setStyle({ fillOpacity: +ev.target.value })} />
          </Field>
          <Field label="Outline"><input type="color" className="input p-0.5" disabled={ro} value={st.stroke ?? color} onChange={(ev) => setStyle({ stroke: ev.target.value })} /></Field>
          <Field label="Outline style"><LineStyle st={st} ro={ro} onChange={setStyle} /></Field>
        </div>
      )}
      {!drawn && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Colour"><input type="color" className="input p-0.5" disabled={ro} value={color} onChange={(ev) => s.updateElement(e.id, { color: ev.target.value })} /></Field>
          <Field label={`Opacity ${Math.round((st.fillOpacity ?? 0.9) * 100)}%`}>
            <input type="range" min={0.05} max={1} step={0.05} className="h-[30px] w-full accent-[#1ea7e8]" disabled={ro} value={st.fillOpacity ?? 0.9}
              onChange={(ev) => setStyle({ fillOpacity: +ev.target.value })} />
          </Field>
        </div>
      )}
      {!ro && (e.style || e.color) && (
        <button className="btn text-xs" onClick={() => s.updateElement(e.id, { style: undefined, color: undefined })}>Reset to default</button>
      )}
    </Section>
  )
}

function LineStyle({ st, ro, onChange }: { st: ElementStyle; ro: boolean; onChange: (p: ElementStyle) => void }) {
  return (
    <select className="input" disabled={ro} value={st.strokeStyle ?? 'solid'} onChange={(ev) => onChange({ strokeStyle: ev.target.value as ElementStyle['strokeStyle'] })}>
      <option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option>
    </select>
  )
}

/** Vendor, zone, load-in/out and power: feeds the schedule, power budget and inventory. */
function SetupSection({ e, ro }: { e: PlanElement; ro: boolean }) {
  const s = usePlanStore()
  const su = e.setup ?? {}
  const setSetup = (patch: ObjectSetup) => {
    const next = { ...su, ...patch }
    const empty = Object.values(next).every((v) => v === undefined || v === '')
    s.updateElement(e.id, { setup: empty ? undefined : next })
  }
  const vendors = [...new Set(s.plan.elements.map((x) => x.setup?.vendor).filter(Boolean))] as string[]
  const zones = [...new Set(s.plan.elements.map((x) => x.setup?.zone).filter(Boolean))] as string[]
  const badTimes = su.inAt && su.outAt && su.inAt > su.outAt
  return (
    <Section id="setup" title={su.vendor ? `Vendor & logistics · ${su.vendor}` : 'Vendor & logistics'}>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Vendor">
          <input className="input" list="vendor-list" disabled={ro} value={su.vendor ?? ''} placeholder="Company" onChange={(ev) => setSetup({ vendor: ev.target.value || undefined })} />
        </Field>
        <Field label="Zone">
          <input className="input" list="zone-list" disabled={ro} value={su.zone ?? ''} placeholder="e.g. Back of house" onChange={(ev) => setSetup({ zone: ev.target.value || undefined })} />
        </Field>
        <Field label="Load-in">
          <input type="datetime-local" className="input px-1 text-xs" disabled={ro} value={su.inAt ?? ''} onChange={(ev) => setSetup({ inAt: ev.target.value || undefined })} />
        </Field>
        <Field label="Load-out">
          <input type="datetime-local" className="input px-1 text-xs" disabled={ro} value={su.outAt ?? ''} onChange={(ev) => setSetup({ outAt: ev.target.value || undefined })} />
        </Field>
        <Field label="Power draw (kW)">
          <input type="number" step={0.1} min={0} className="input font-mono" disabled={ro} value={su.powerKw ?? ''} placeholder="0"
            onChange={(ev) => setSetup({ powerKw: ev.target.value === '' ? undefined : Math.max(0, parseFloat(ev.target.value) || 0) })} />
        </Field>
      </div>
      {badTimes && <p className="text-[11px] text-red-600">Load-in is after load-out.</p>}
      <datalist id="vendor-list">{vendors.map((v) => <option key={v} value={v} />)}</datalist>
      <datalist id="zone-list">{zones.map((v) => <option key={v} value={v} />)}</datalist>
    </Section>
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
          <div className="flex flex-wrap gap-1">
            <button className="btn" onClick={() => { s.groupSelected() }} title="Group into a folder (Ctrl+G)"><FolderPlus size={15} />Group</button>
            <button className="btn" onClick={() => s.setHidden(ids, true)}><EyeOff size={15} />Hide</button>
            <button className="btn" onClick={s.duplicateSelected}><Copy size={15} />Duplicate</button>
            <button className="btn text-red-600" onClick={s.deleteSelected}><Trash2 size={15} />Delete</button>
          </div>
        </>
      )}
    </div>
  )
}
