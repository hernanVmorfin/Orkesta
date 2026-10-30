import { useState } from 'react'
import { Eye, EyeOff, Lock, Unlock, ChevronRight, Folder, FolderOpen, Ungroup } from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'
import { LAYERS } from '../lib/catalog'
import { activeLevel, onLevel } from '../lib/levels'
import type { Group, PlanElement } from '../types'

/** Layers → folders → objects on the level being shown, each with show/hide and lock. */
export function LayersPanel() {
  const s = usePlanStore()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const toggleOpen = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }))
  const lv = activeLevel(s.plan, s.levelId).id
  const onThisLevel = s.plan.elements.filter((e) => onLevel(e, lv))
  const groups = s.plan.groups ?? []
  const hiddenCount = onThisLevel.filter((e) => e.hidden).length

  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="eyebrow">Layers · toggle overlays per audience</div>
        {hiddenCount > 0 && !s.viewOnly && (
          <button className="text-[11px] text-accent-deep hover:underline" onClick={() => s.setHidden(onThisLevel.filter((e) => e.hidden).map((e) => e.id), false)}>
            Show {hiddenCount} hidden
          </button>
        )}
      </div>
      {LAYERS.map((l) => {
        const els = onThisLevel.filter((e) => e.layer === l.id)
        const st = s.plan.layers[l.id]
        const layerGroups = groups.filter((g) => g.layer === l.id && els.some((e) => e.groupId === g.id))
        const loose = els.filter((e) => !e.groupId || !groups.some((g) => g.id === e.groupId))
        return (
          <div key={l.id} className="mb-1 rounded-md border border-bg-2">
            <div className="flex items-center gap-1 px-2 py-1.5">
              <button onClick={() => toggleOpen(l.id)} className="text-muted"><ChevronRight size={14} className={open[l.id] ? 'rotate-90' : ''} /></button>
              <button className="flex-1 text-left text-sm" onClick={() => s.set({ selection: els.filter((e) => !e.locked && !e.hidden && !st.locked).map((e) => e.id) })}>
                {l.name} <span className="font-mono text-[11px] text-muted">{els.length}</span>
              </button>
              <button title="Visibility" onClick={() => s.setLayer(l.id, { visible: !st.visible })} className="rounded p-1 hover:bg-bg">
                {st.visible ? <Eye size={15} /> : <EyeOff size={15} className="text-muted" />}
              </button>
              {!s.viewOnly && (
                <button title="Lock layer" onClick={() => s.setLayer(l.id, { locked: !st.locked })} className="rounded p-1 hover:bg-bg">
                  {st.locked ? <Lock size={15} className="text-accent-deep" /> : <Unlock size={15} className="text-muted" />}
                </button>
              )}
            </div>
            {open[l.id] && (
              <ul className="border-t border-bg-2 py-1">
                {layerGroups.map((g) => (
                  <GroupRow key={g.id} g={g} els={els.filter((e) => e.groupId === g.id)} open={!!open[g.id]} onToggle={() => toggleOpen(g.id)} />
                ))}
                {loose.map((e) => <ObjectRow key={e.id} e={e} indent="pl-8" />)}
                {!els.length && <li className="px-8 py-1 text-xs text-muted">Empty</li>}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

function GroupRow({ g, els, open, onToggle }: { g: Group; els: PlanElement[]; open: boolean; onToggle: () => void }) {
  const s = usePlanStore()
  const [editing, setEditing] = useState(false)
  return (
    <li>
      <div className="group flex items-center gap-1 py-0.5 pl-5 pr-2">
        <button onClick={onToggle} className="text-muted"><ChevronRight size={13} className={open ? 'rotate-90' : ''} /></button>
        {open ? <FolderOpen size={14} className="shrink-0 text-muted" /> : <Folder size={14} className="shrink-0 text-muted" />}
        {editing ? (
          <input autoFocus className="input h-6 text-xs" defaultValue={g.name}
            onBlur={(e) => { s.updateGroup(g.id, { name: e.target.value.trim() || g.name }); setEditing(false) }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false) }} />
        ) : (
          <button className="min-w-0 flex-1 truncate text-left text-xs font-medium text-ink-2" title="Click to select · double-click to rename"
            onClick={() => s.set({ selection: els.filter((e) => !e.hidden).map((e) => e.id), rightTab: 'inspect' })}
            onDoubleClick={() => !s.viewOnly && setEditing(true)}>
            {g.name} <span className="font-mono text-[10px] text-muted">{els.length}</span>
          </button>
        )}
        {!s.viewOnly && (
          <button title="Ungroup" onClick={() => s.ungroup(g.id)} className="rounded p-0.5 text-muted opacity-0 hover:bg-bg group-hover:opacity-100 pointer-coarse:opacity-100">
            <Ungroup size={13} />
          </button>
        )}
        <button title="Show / hide folder" onClick={() => s.updateGroup(g.id, { visible: !g.visible })} className="rounded p-0.5 hover:bg-bg">
          {g.visible ? <Eye size={13} /> : <EyeOff size={13} className="text-muted" />}
        </button>
        {!s.viewOnly && (
          <button title="Lock folder" onClick={() => s.updateGroup(g.id, { locked: !g.locked })} className="rounded p-0.5 hover:bg-bg">
            {g.locked ? <Lock size={13} className="text-accent-deep" /> : <Unlock size={13} className="text-muted" />}
          </button>
        )}
      </div>
      {open && <ul>{els.map((e) => <ObjectRow key={e.id} e={e} indent="pl-12" />)}</ul>}
    </li>
  )
}

function ObjectRow({ e, indent }: { e: PlanElement; indent: string }) {
  const s = usePlanStore()
  return (
    <li className={`group flex items-center gap-1 pr-2 ${indent}`}>
      <button onClick={() => !e.hidden && s.set({ selection: [e.id], rightTab: 'inspect' })}
        className={`min-w-0 flex-1 truncate py-0.5 text-left text-xs hover:text-accent-deep ${s.selection.includes(e.id) ? 'text-accent-deep' : e.hidden ? 'text-muted line-through' : 'text-ink-2'}`}>
        {e.label || 'Untitled'}
      </button>
      {!s.viewOnly && (
        <>
          <button title={e.hidden ? 'Show' : 'Hide'} onClick={() => s.setHidden([e.id], !e.hidden)}
            className={`rounded p-0.5 hover:bg-bg ${e.hidden ? '' : 'opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100'}`}>
            {e.hidden ? <EyeOff size={12} className="text-muted" /> : <Eye size={12} />}
          </button>
          <button title={e.locked ? 'Unlock' : 'Lock'} onClick={() => s.updateElement(e.id, { locked: !e.locked || undefined })}
            className={`rounded p-0.5 hover:bg-bg ${e.locked ? '' : 'opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100'}`}>
            {e.locked ? <Lock size={12} className="text-accent-deep" /> : <Unlock size={12} className="text-muted" />}
          </button>
        </>
      )}
    </li>
  )
}
