import { useState } from 'react'
import { Eye, EyeOff, Lock, Unlock, ChevronRight } from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'
import { LAYERS } from '../lib/catalog'

export function LayersPanel() {
  const s = usePlanStore()
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="p-3">
      <div className="eyebrow mb-2 px-1">Layers · toggle overlays per audience</div>
      {LAYERS.map((l) => {
        const els = s.plan.elements.filter((e) => e.layer === l.id)
        const st = s.plan.layers[l.id]
        return (
          <div key={l.id} className="mb-1 rounded-md border border-bg-2">
            <div className="flex items-center gap-1 px-2 py-1.5">
              <button onClick={() => setOpen(open === l.id ? null : l.id)} className="text-muted"><ChevronRight size={14} className={open === l.id ? 'rotate-90' : ''} /></button>
              <button className="flex-1 text-left text-sm" onClick={() => s.set({ selection: els.filter((e) => !e.locked && !st.locked).map((e) => e.id) })}>
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
            {open === l.id && (
              <ul className="border-t border-bg-2 py-1">
                {els.map((e) => (
                  <li key={e.id}>
                    <button onClick={() => s.set({ selection: [e.id], rightTab: 'inspect' })}
                      className={`w-full truncate px-8 py-0.5 text-left text-xs hover:bg-bg ${s.selection.includes(e.id) ? 'text-accent-deep' : 'text-ink-2'}`}>
                      {e.label}{e.locked ? ' (locked)' : ''}
                    </button>
                  </li>
                ))}
                {!els.length && <li className="px-8 py-1 text-xs text-muted">Empty</li>}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
