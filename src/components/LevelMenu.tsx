import { useState } from 'react'
import { Layers3, Plus, Copy, Trash2, ArrowUp, ArrowDown, Pencil, Check } from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'
import { activeLevel, levelsOf, onLevel } from '../lib/levels'

/** Level (floor / room) switcher; editors can add, rename, duplicate, reorder and delete levels. */
export function LevelMenu() {
  const s = usePlanStore()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const levels = levelsOf(s.plan)
  const current = activeLevel(s.plan, s.levelId)
  const ro = s.viewOnly
  if (ro && levels.length < 2) return null
  const count = (id: string) => s.plan.elements.filter((e) => onLevel(e, id)).length

  return (
    <div className="relative">
      <button className="btn h-8 max-w-40 px-2 text-xs" title="Levels" onClick={() => setOpen(!open)}>
        <Layers3 size={15} /><span className="truncate">{levels.length > 1 ? current.name : 'Levels'}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => { setOpen(false); setEditing(null) }} />
          <div className="absolute left-0 top-10 z-30 w-72 rounded-lg border border-bg-2 bg-white p-1 text-sm shadow-lg">
            <div className="eyebrow px-3 pb-1 pt-2">Levels · floors or rooms</div>
            <ul>
              {levels.map((l, i) => (
                <li key={l.id} className={`group flex items-center gap-1 rounded-md pr-1 hover:bg-bg ${l.id === current.id ? 'bg-accent/10' : ''}`}>
                  {editing === l.id ? (
                    <form className="flex flex-1 items-center gap-1 px-2 py-1" onSubmit={(e) => {
                      e.preventDefault()
                      const v = (new FormData(e.currentTarget).get('name') as string).trim()
                      if (v) s.renameLevel(l.id, v)
                      setEditing(null)
                    }}>
                      <input name="name" autoFocus className="input h-7" defaultValue={l.name} maxLength={40} />
                      <button className="rounded p-1 text-accent-deep"><Check size={15} /></button>
                    </form>
                  ) : (
                    <button className="min-w-0 flex-1 px-3 py-2 text-left" onClick={() => { s.set({ levelId: l.id, selection: [] }); setOpen(false) }}>
                      <span className="block truncate font-medium text-ink">{l.name}</span>
                      <span className="text-[11px] text-muted">{count(l.id)} objects</span>
                    </button>
                  )}
                  {!ro && editing !== l.id && (
                    <span className="flex opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100">
                      <button className="rounded p-1 text-muted hover:text-ink" title="Rename" onClick={() => setEditing(l.id)}><Pencil size={13} /></button>
                      <button className="rounded p-1 text-muted hover:text-ink disabled:opacity-30" title="Move up" disabled={!i} onClick={() => s.moveLevel(l.id, -1)}><ArrowUp size={13} /></button>
                      <button className="rounded p-1 text-muted hover:text-ink disabled:opacity-30" title="Move down" disabled={i === levels.length - 1} onClick={() => s.moveLevel(l.id, 1)}><ArrowDown size={13} /></button>
                      <button className="rounded p-1 text-muted hover:text-ink" title="Duplicate level" onClick={() => { s.duplicateLevel(l.id); setOpen(false) }}><Copy size={13} /></button>
                      {levels.length > 1 && (
                        <button className="rounded p-1 text-muted hover:text-red-600" title="Delete level"
                          onClick={() => { if (confirm(`Delete "${l.name}"? Its ${count(l.id)} objects and comments go too.`)) s.deleteLevel(l.id) }}><Trash2 size={13} /></button>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {!ro && (
              <div className="mt-1 border-t border-bg-2 pt-1">
                <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-bg" onClick={() => { s.addLevel(); setOpen(false) }}>
                  <Plus size={15} />Add level
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
