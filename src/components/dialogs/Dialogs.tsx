import { lazy, Suspense } from 'react'
import { usePlanStore } from '../../store/usePlanStore'

// Dialogs load on first use to keep the editor's startup download small
const RepeatDialog = lazy(() => import('./LayoutDialogs').then((m) => ({ default: m.RepeatDialog })))
const SeatBlockDialog = lazy(() => import('./LayoutDialogs').then((m) => ({ default: m.SeatBlockDialog })))
const ScheduleDialog = lazy(() => import('./OpsDialogs').then((m) => ({ default: m.ScheduleDialog })))
const FilteredExportDialog = lazy(() => import('./OpsDialogs').then((m) => ({ default: m.FilteredExportDialog })))
const TemplatesDialog = lazy(() => import('./LibraryDialogs').then((m) => ({ default: m.TemplatesDialog })))
const CustomItemDialog = lazy(() => import('./LibraryDialogs').then((m) => ({ default: m.CustomItemDialog })))
const HistoryDialog = lazy(() => import('./HistoryDialog').then((m) => ({ default: m.HistoryDialog })))

/** The one open dialog, chosen by `dialog` in the store. */
export function Dialogs() {
  const dialog = usePlanStore((s) => s.dialog)
  const set = usePlanStore((s) => s.set)
  const close = () => set({ dialog: null })
  const el = (() => {
    switch (dialog) {
      case 'repeat': return <RepeatDialog onClose={close} />
      case 'seatBlock': return <SeatBlockDialog onClose={close} />
      case 'schedule': return <ScheduleDialog onClose={close} />
      case 'export': return <FilteredExportDialog onClose={close} />
      case 'templates': return <TemplatesDialog onClose={close} />
      case 'customItem': return <CustomItemDialog onClose={close} />
      case 'history': return <HistoryDialog onClose={close} />
      default: return null
    }
  })()
  return el && <Suspense fallback={null}>{el}</Suspense>
}
