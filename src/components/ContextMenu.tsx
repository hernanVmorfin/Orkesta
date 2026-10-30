import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePlanStore } from '../store/usePlanStore'
import { planToLatLng } from '../lib/geo'
import { isLockedEl, selectableIds } from '../lib/levels'
import { toast } from '../lib/toast'
import type { Pt } from '../types'

export interface MenuState { x: number; y: number; at: Pt }

const MOD = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform) ? '⌘' : 'Ctrl+'

/** Right-click menu on the plan: acts on the selection, or on the clicked point when nothing is selected. */
export function ContextMenu({ menu, onClose, onComment }: { menu: MenuState; onClose: () => void; onComment: (at: Pt) => void }) {
  const s = usePlanStore()
  const sel = s.plan.elements.filter((e) => s.selection.includes(e.id))
  const one = sel.length === 1 ? sel[0] : null
  const allLocked = sel.length > 0 && sel.every((e) => e.locked)
  const grouped = one?.groupId ?? (sel.length && sel.every((e) => e.groupId && e.groupId === sel[0].groupId) ? sel[0].groupId : undefined)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Keep the whole menu on screen: shift it up or left when it would overflow the canvas
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: menu.x, top: menu.y })
  useLayoutEffect(() => {
    const el = ref.current, parent = el?.offsetParent as HTMLElement | null
    if (!el || !parent) return
    setPos({
      left: Math.max(8, Math.min(menu.x, parent.clientWidth - el.offsetWidth - 8)),
      top: Math.max(8, Math.min(menu.y, parent.clientHeight - el.offsetHeight - 8)),
    })
  }, [menu.x, menu.y])

  const run = (fn: () => void) => () => { fn(); onClose() }
  const copyCoords = () => {
    const p = one ? { x: one.x, y: one.y } : menu.at
    let text = `x ${p.x.toFixed(2)} m, y ${p.y.toFixed(2)} m`
    if (s.plan.geo) {
      const ll = planToLatLng(s.plan.geo, p)
      text += ` · ${ll.lat.toFixed(6)}, ${ll.lng.toFixed(6)}`
    }
    navigator.clipboard?.writeText(text).then(() => toast('Coordinates copied'), () => toast(text))
  }

  type Item = { label: string; keys?: string; on: () => void; danger?: boolean; disabled?: boolean } | 'sep'
  const items: Item[] = sel.length ? [
    { label: 'Cut', keys: `${MOD}X`, on: s.cutSelected },
    { label: `Copy${sel.length > 1 ? ` ${sel.length} objects` : ''}`, keys: `${MOD}C`, on: () => { s.copySelected() } },
    { label: 'Paste', keys: `${MOD}V`, on: () => { s.paste(menu.at) } },
    { label: 'Duplicate', keys: `${MOD}D`, on: s.duplicateSelected },
    'sep',
    { label: 'Bring to front', keys: ']', on: () => s.reorder('front') },
    { label: 'Bring forward', keys: '⇧]', on: () => s.reorder('forward') },
    { label: 'Send backward', keys: '⇧[', on: () => s.reorder('backward') },
    { label: 'Send to back', keys: '[', on: () => s.reorder('back') },
    'sep',
    ...(one ? [{ label: 'Repeat in a grid…', on: () => s.set({ dialog: 'repeat' }) }] : []),
    grouped
      ? { label: 'Ungroup', keys: `⇧${MOD}G`, on: () => s.ungroup(grouped) }
      : { label: 'Group into a folder', keys: `${MOD}G`, on: () => { s.groupSelected() }, disabled: sel.length < 2 },
    { label: allLocked ? 'Unlock' : 'Lock', keys: `⇧${MOD}L`, on: () => s.updateMany((e) => ({ ...e, locked: !allLocked || undefined }), sel.map((e) => e.id)) },
    { label: 'Hide', keys: `⇧${MOD}H`, on: () => s.setHidden(sel.map((e) => e.id), true) },
    { label: 'Copy coordinates', on: copyCoords },
    'sep',
    { label: 'Delete', keys: 'Del', on: s.deleteSelected, danger: true, disabled: sel.every((e) => isLockedEl(s.plan, e)) },
  ] : [
    { label: 'Paste here', keys: `${MOD}V`, on: () => { if (!s.paste(menu.at)) toast('Nothing copied yet') } },
    { label: 'Add comment here', keys: 'C', on: () => onComment(menu.at) },
    { label: 'Copy coordinates', on: copyCoords },
    'sep',
    { label: 'Select all', keys: `${MOD}A`, on: () => s.set({ selection: selectableIds(s.plan, s.levelId) }) },
  ]

  return (
    <>
      <div className="fixed inset-0 z-40" onPointerDown={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div ref={ref} role="menu" className="absolute z-50 w-60 rounded-lg border border-bg-2 bg-white p-1 text-sm shadow-xl"
        style={pos}>
        {items.map((it, i) => it === 'sep' ? <div key={i} className="my-1 h-px bg-bg-2" /> : (
          <button key={i} role="menuitem" disabled={it.disabled} onClick={run(it.on)}
            className={`flex w-full items-center justify-between rounded-md px-3 py-1.5 text-left hover:bg-bg disabled:opacity-40 ${it.danger ? 'text-red-600' : 'text-ink-2'}`}>
            <span>{it.label}</span>{it.keys && <span className="font-mono text-[11px] text-muted">{it.keys}</span>}
          </button>
        ))}
      </div>
    </>
  )
}

