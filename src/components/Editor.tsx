import { usePlanStore } from '../store/usePlanStore'
import { openMessages } from '../store/team'
import { useIsWide } from '../lib/useMediaQuery'
import { TopBar } from './TopBar'
import { Library } from './Library'
import { FloorCanvas } from './FloorCanvas'
import { RightPanel } from './RightPanel'
import { UrgentBanner } from './team/UrgentBanner'

/** The desktop editor for the open event. Loaded on demand, so the hub opens without it. */
export default function Editor() {
  const viewOnly = usePlanStore((s) => s.viewOnly)
  const showLibrary = usePlanStore((s) => s.showLibrary)
  const showPanel = usePlanStore((s) => s.showPanel)
  const wide = useIsWide()
  return (
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
  )
}
