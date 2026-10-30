import { useState } from 'react'
import { Lock } from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'

/** Shown instead of the app for a password-protected link until the right password is entered. */
export function PasswordGate() {
  const unlock = usePlanStore((s) => s.unlockShare)
  const viewOnly = usePlanStore((s) => s.lockedShare?.viewOnly)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState(false)
  const submit = async () => {
    setBusy(true); setWrong(false)
    const ok = await unlock(password)
    if (!ok) { setWrong(true); setBusy(false) }
  }
  return (
    <div className="grid h-full place-items-center bg-bg p-4">
      <form className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onSubmit={(e) => { e.preventDefault(); void submit() }}>
        <div className="mb-6 flex items-center gap-2">
          <img src="/brand/logo-inbest.png" alt="iNBest" className="h-6" />
          <span className="text-sm font-semibold tracking-tight text-ink-2">Orkesta</span>
        </div>
        <div className="mb-1 flex items-center gap-2 text-lg font-semibold"><Lock size={18} />Password-protected plan</div>
        <p className="mb-4 text-sm text-muted">{viewOnly ? 'Enter the password you were given to view this plan.' : 'Enter the password to open your editable copy of this plan.'}</p>
        <input type="password" autoFocus className="input" placeholder="Password" value={password} onChange={(e) => { setPassword(e.target.value); setWrong(false) }} />
        {wrong && <p className="mt-1 text-xs text-red-600">That password doesn't open this plan.</p>}
        <button className="btn btn-primary mt-4 w-full justify-center" disabled={!password || busy}>{busy ? 'Opening…' : 'Open plan'}</button>
      </form>
    </div>
  )
}
