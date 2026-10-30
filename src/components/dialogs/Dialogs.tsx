import { usePlanStore } from '../../store/usePlanStore'
import { RepeatDialog, SeatBlockDialog } from './LayoutDialogs'
import { FilteredExportDialog, ScheduleDialog } from './OpsDialogs'
import { CustomItemDialog, TemplatesDialog } from './LibraryDialogs'

/** The one open dialog, chosen by `dialog` in the store. */
export function Dialogs() {
  const dialog = usePlanStore((s) => s.dialog)
  const set = usePlanStore((s) => s.set)
  const close = () => set({ dialog: null })
  switch (dialog) {
    case 'repeat': return <RepeatDialog onClose={close} />
    case 'seatBlock': return <SeatBlockDialog onClose={close} />
    case 'schedule': return <ScheduleDialog onClose={close} />
    case 'export': return <FilteredExportDialog onClose={close} />
    case 'templates': return <TemplatesDialog onClose={close} />
    case 'customItem': return <CustomItemDialog onClose={close} />
    default: return null
  }
}
