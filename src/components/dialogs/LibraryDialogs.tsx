import { useState } from 'react'
import { nanoid } from 'nanoid'
import { FilePlus2, LayoutTemplate } from 'lucide-react'
import { usePlanStore } from '../../store/usePlanStore'
import { LAYERS } from '../../lib/catalog'
import { TEMPLATES } from '../../data/templates'
import type { LayerId } from '../../types'
import { Modal, NumField } from './Modal'

/** New event: blank, or a starter layout to adapt. */
export function TemplatesDialog({ onClose }: { onClose: () => void }) {
  const s = usePlanStore()
  const start = async (build?: () => import('../../types').Plan) => {
    onClose()
    if (build) await s.importPlan(build())
    else await s.newEvent()
  }
  return (
    <Modal title="New event" eyebrow="Start from" onClose={onClose}>
      <div className="space-y-2">
        <button className="flex w-full items-start gap-3 rounded-lg border border-bg-2 p-3 text-left hover:border-accent hover:bg-accent/5" onClick={() => start()}>
          <FilePlus2 size={20} className="mt-0.5 shrink-0 text-accent-deep" />
          <span><span className="block font-semibold">Blank plan</span><span className="text-xs text-muted">An empty 30 × 20 m venue</span></span>
        </button>
        {TEMPLATES.map((t) => (
          <button key={t.id} className="flex w-full items-start gap-3 rounded-lg border border-bg-2 p-3 text-left hover:border-accent hover:bg-accent/5" onClick={() => start(t.build)}>
            <LayoutTemplate size={20} className="mt-0.5 shrink-0 text-accent-deep" />
            <span><span className="block font-semibold">{t.name}</span><span className="text-xs text-muted">{t.description}</span></span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted">Templates open as a new event you can change freely. Set the venue size and location in the Venue tab.</p>
    </Modal>
  )
}

/** An object of any size and colour, saved with this event so the team sees it too. */
export function CustomItemDialog({ onClose }: { onClose: () => void }) {
  const s = usePlanStore()
  const [name, setName] = useState('')
  const [w, setW] = useState(2)
  const [h, setH] = useState(1)
  const [color, setColor] = useState('#1ea7e8')
  const [round, setRound] = useState(false)
  const [layer, setLayer] = useState<LayerId>('decor')
  const add = () => {
    const kind = `custom-${nanoid(6)}`
    s.mutate((p) => ({ ...p, customItems: [...(p.customItems ?? []), { kind, name: name.trim(), w, h, color, round, layer }] }))
    s.set({ placing: kind, tool: 'select' })
    onClose()
  }
  return (
    <Modal title="Custom object" eyebrow="Library" onClose={onClose}>
      <label className="block"><span className="text-[11px] text-muted">Name</span>
        <input autoFocus className="input" value={name} placeholder="e.g. Sponsor arch" onChange={(e) => setName(e.target.value)} maxLength={60} />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <NumField label="Width" unit="m" step={0.1} min={0.1} value={w} onChange={setW} />
        <NumField label="Depth" unit="m" step={0.1} min={0.1} value={h} onChange={setH} />
        <label className="block"><span className="text-[11px] text-muted">Colour</span>
          <input type="color" className="input p-0.5" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <label className="block"><span className="text-[11px] text-muted">Layer</span>
          <select className="input" value={layer} onChange={(e) => setLayer(e.target.value as LayerId)}>
            {LAYERS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[#1ea7e8]" checked={round} onChange={(e) => setRound(e.target.checked)} />Round</label>
      <p className="mt-3 text-[11px] text-muted">It's added to this event's library, then you click the plan to place it.</p>
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!name.trim()} onClick={add}>Add and place</button>
      </div>
    </Modal>
  )
}
