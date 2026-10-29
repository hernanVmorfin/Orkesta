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
import { MOBILE_QUERY, useIsMobile, useIsWide } from './lib/useMediaQuery'

export default function App() {
  const viewOnly = usePlanStore((s) => s.viewOnly)
  const hydrated = usePlanStore((s) => s.hydrated)
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
      if (e.key === 'Escape') s.set({ placing: null, selection: [], measure: null, tool: 'select' })
      if (!mod && e.key === 'f') requestFit()
      // Phones are read-only, even with a hardware keyboard attached
      if (s.viewOnly || window.matchMedia(MOBILE_QUERY).matches) return
      if (mod) {
        const k = e.key.toLowerCase()
        if (k === 'z') { e.preventDefault(); if (e.shiftKey) s.redo(); else s.undo() }
        else if (k === 'y') { e.preventDefault(); s.redo() }
        else if (k === 'd') { e.preventDefault(); s.duplicateSelected() }
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') s.deleteSelected()
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
      {toast && (
        <div className={`fixed left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-center text-sm text-on-ink shadow-lg ${isMobile ? 'bottom-24' : 'bottom-6'}`}>
          {toast}
        </div>
      )}
    </>
  )
}
