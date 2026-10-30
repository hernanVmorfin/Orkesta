import { useEffect, useState } from 'react'
import { TopBar } from './components/TopBar'
import { Library } from './components/Library'
import { FloorCanvas } from './components/FloorCanvas'
import { RightPanel } from './components/RightPanel'
import { MobileApp } from './components/mobile/MobileApp'
import { usePlanStore } from './store/usePlanStore'
import { acceptInvite, initTeam, openMessages, takeInviteToken } from './store/team'
import { UrgentBanner } from './components/team/UrgentBanner'
import { requestFit } from './lib/canvas'
import { toast as showToast } from './lib/toast'
import { selectableIds } from './lib/levels'
import { Dialogs } from './components/dialogs/Dialogs'
import { PasswordGate } from './components/PasswordGate'
import { MOBILE_QUERY, useIsMobile, useIsWide } from './lib/useMediaQuery'

export default function App() {
  const viewOnly = usePlanStore((s) => s.viewOnly)
  const hydrated = usePlanStore((s) => s.hydrated)
  const locked = usePlanStore((s) => !!s.lockedShare)
  const showLibrary = usePlanStore((s) => s.showLibrary)
  const showPanel = usePlanStore((s) => s.showPanel)
  const isMobile = useIsMobile()
  const wide = useIsWide()
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    // Taken before anything awaits, so a second run of this effect can't use it again
    const invite = takeInviteToken()
    void (async () => {
      await usePlanStore.getState().hydrate()
      await initTeam()
      if (invite) await acceptInvite(invite)
    })()
  }, [])

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const onToast = (e: Event) => {
      const msg = (e as CustomEvent<string>).detail
      setToast(msg)
      clearTimeout(t)
      t = setTimeout(() => setToast(null), Math.max(2200, msg.length * 60))
    }
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
      if (e.key === 'Escape') {
        if (s.dialog) { s.set({ dialog: null }); return }
        s.set({ placing: null, selection: [], measure: null, tool: 'select', drawing: null, commentDraft: null, activeComment: null })
      }
      if (!mod && e.key === 'f') requestFit()
      // Phones are read-only, even with a hardware keyboard attached
      if (s.viewOnly || window.matchMedia(MOBILE_QUERY).matches) return
      if (s.drawing) {
        if (e.key === 'Enter') { e.preventDefault(); const err = s.finishDrawing(); if (err) showToast(err) }
        else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); s.undoDrawPoint() }
        return
      }
      if (mod) {
        const k = e.key.toLowerCase()
        const sel = s.selection
        if (k === 'z') { e.preventDefault(); if (e.shiftKey) s.redo(); else s.undo() }
        else if (k === 'y') { e.preventDefault(); s.redo() }
        else if (k === 'd') { e.preventDefault(); s.duplicateSelected() }
        else if (k === 'c' && sel.length) { e.preventDefault(); showToast(`Copied ${s.copySelected()} object${sel.length > 1 ? 's' : ''}`) }
        else if (k === 'x' && sel.length) { e.preventDefault(); s.cutSelected() }
        else if (k === 'v') { e.preventDefault(); if (!s.paste()) showToast('Nothing copied yet') }
        else if (k === 'a') { e.preventDefault(); s.set({ selection: selectableIds(s.plan, s.levelId) }) }
        else if (k === 'g' && e.shiftKey) {
          e.preventDefault()
          const g = s.plan.elements.find((x) => sel.includes(x.id) && x.groupId)?.groupId
          if (g) s.ungroup(g)
        } else if (k === 'g' && sel.length > 1) { e.preventDefault(); s.groupSelected() }
        else if (k === 'l' && e.shiftKey && sel.length) {
          e.preventDefault()
          const lock = !s.plan.elements.filter((x) => sel.includes(x.id)).every((x) => x.locked)
          s.updateMany((x) => ({ ...x, locked: lock || undefined }), sel)
        } else if (k === 'h' && e.shiftKey && sel.length) { e.preventDefault(); s.setHidden(sel, true) }
        return
      }
      if (e.code === 'BracketRight' && s.selection.length) s.reorder(e.shiftKey ? 'forward' : 'front')
      else if (e.code === 'BracketLeft' && s.selection.length) s.reorder(e.shiftKey ? 'backward' : 'back')
      else if (e.key === 'c') s.set({ tool: s.tool === 'comment' ? 'select' : 'comment', placing: null, measure: null })
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

  if (locked) return <PasswordGate />
  if (!hydrated) return <div className="grid h-full place-items-center text-sm text-muted">Loading your events…</div>

  return (
    <>
      {isMobile ? <MobileApp /> : (
        <div className="flex h-full flex-col">
          <TopBar />
          {/* Below 1280 px the side panels slide over the plan instead of squeezing it */}
          <div className="relative flex min-h-0 flex-1">
            {!viewOnly && (wide || showLibrary) && (
              <div className={wide ? 'contents' : 'absolute inset-y-0 left-0 z-30 flex shadow-xl'}><Library /></div>
            )}
            <main className="min-w-0 flex-1"><FloorCanvas /></main>
            {(wide || showPanel) && (
              <div className={wide ? 'contents' : 'absolute inset-y-0 right-0 z-30 flex shadow-xl'}><RightPanel /></div>
            )}
            <UrgentBanner onView={openMessages} className="absolute left-1/2 top-3 z-40 w-[min(520px,calc(100%-32px))] -translate-x-1/2" />
          </div>
        </div>
      )}
      <Dialogs />
      {toast && (
        <div className={`fixed left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-center text-sm text-on-ink shadow-lg ${isMobile ? 'bottom-24' : 'bottom-6'}`}>
          {toast}
        </div>
      )}
    </>
  )
}
