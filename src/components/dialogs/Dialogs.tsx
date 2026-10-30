import { lazy, Suspense } from 'react'
import { usePlanStore } from '../../store/usePlanStore'

// Dialogs load on first use to keep the editor's startup download small
const RepeatDialog = lazy(() => import('./LayoutDialogs').then((m) => ({ default: m.RepeatDialog })))
const SeatBlockDialog = lazy(() => import('./LayoutDialogs').then((m) => ({ default: m.SeatBlockDialog })))
const ScheduleDialog = lazy(() => import('./OpsDialogs').then((m) => ({ default: m.ScheduleDialog })))
const FilteredExportDialog = lazy(() => import('./OpsDialogs').then((m) => ({ default: m.FilteredExportDialog })))
const ProfileDialog = lazy(() => import('../team/ProfileDialog').then((m) => ({ default: m.ProfileDialog })))
const NewEventDialog = lazy(() => import('./NewEventDialog').then((m) => ({ default: m.NewEventDialog })))
const CustomItemDialog = lazy(() => import('./LibraryDialogs').then((m) => ({ default: m.CustomItemDialog })))
const HistoryDialog = lazy(() => import('./HistoryDialog').then((m) => ({ default: m.HistoryDialog })))

/** The one open dialog, chosen by `dialog` in the store. */
export function Dialogs() {
  const dialog = usePlanStore((s) => s.dialog)
  const set = usePlanStore((s) => s.set)
  const start = usePlanStore((s) => s.newEventStart)
  // The profile form belongs to whoever is signed in; a new account starts a fresh form
  const accountId = usePlanStore((s) => s.account?.id)
  const close = () => set({ dialog: null })
  const el = (() => {
    switch (dialog) {
      case 'repeat': return <RepeatDialog onClose={close} />
      case 'seatBlock': return <SeatBlockDialog onClose={close} />
      case 'schedule': return <ScheduleDialog onClose={close} />
      case 'export': return <FilteredExportDialog onClose={close} />
      case 'newEvent': return <NewEventDialog onClose={close} start={start} />
      case 'profile': return <ProfileDialog key={accountId} onClose={close} />
      case 'welcome': return <ProfileDialog key={accountId} onClose={close} welcome />
      case 'customItem': return <CustomItemDialog onClose={close} />
      case 'history': return <HistoryDialog onClose={close} />
      default: return null
    }
  })()
  return el && <Suspense fallback={null}>{el}</Suspense>
}
