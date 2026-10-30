import { registerSW } from 'virtual:pwa-register'
import { toast } from './toast'

/**
 * Service worker: the app keeps working offline once opened. A new version waits until the user
 * chooses to reload, so an update never interrupts someone mid-edit.
 */
let update: ((reload?: boolean) => Promise<void>) | null = null

export function startOffline() {
  if (!('serviceWorker' in navigator)) return
  update = registerSW({
    onNeedRefresh: () => window.dispatchEvent(new Event('fp:update')),
    onOfflineReady: () => toast('Orkesta now works offline on this device'),
  })
}

export const applyUpdate = () => update?.(true)
