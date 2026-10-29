import { useEffect, useState } from 'react'
import { TopBar } from './components/TopBar'
import { Library } from './components/Library'
import { FloorCanvas, requestFit } from './components/FloorCanvas'
import { RightPanel } from './components/RightPanel'
import { usePlanStore } from './store/usePlanStore'

export default function App() {
  const viewOnly = usePlanStore((s) => s.viewOnly)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const onToast = (e: Event) => { setToast((e as CustomEvent<string>).detail); clearTimeout(t); t = setTimeout(() => setToast(null), 2200) }
    window.addEventListener('fp:toast', onToast)
    return () => window.removeEventListener('fp:toast', onToast)
  }, [])

  // Selecting something on the canvas jumps to the inspector unless the user is managing guests
  useEffect(() => usePlanStore.subscribe((s, prev) => {
    if (s.selection.length && s.selection !== prev.selection && s.rightTab === 'venue') usePlanStore.setState({ rightTab: 'inspect' })
  }), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const s = usePlanStore.getState()
      const mod = e.metaKey || e.ctrlKey
      if (e.key === 'Escape') s.set({ placing: null, selection: [], measure: null, tool: 'select' })
      if (e.key === 'f') requestFit()
      if (s.viewOnly) return
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? s.redo() : s.undo() }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); s.redo() }
      else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); s.duplicateSelected() }
      else if (e.key === 'Delete' || e.key === 'Backspace') s.deleteSelected()
      else if (e.key === 'm') s.set({ tool: 'measure', placing: null })
      else if (e.key === 'v') s.set({ tool: 'select', measure: null })
      else if (e.key === 'r' && s.selection.length) s.updateMany((el) => ({ ...el, rotation: (el.rotation + 15) % 360 }), s.selection)
      else if (e.key.startsWith('Arrow') && s.selection.length) {
        e.preventDefault()
        const d = e.shiftKey ? 1 : 0.1
        const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0
        const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0
        s.updateMany((el) => (el.locked ? el : { ...el, x: +(el.x + dx).toFixed(3), y: +(el.y + dy).toFixed(3) }), s.selection)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        {!viewOnly && <Library />}
        <main className="min-w-0 flex-1"><FloorCanvas /></main>
        <RightPanel />
      </div>
      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-on-ink shadow-lg">{toast}</div>}
    </div>
  )
}
