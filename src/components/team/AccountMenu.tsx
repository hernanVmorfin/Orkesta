import { useState } from 'react'
import { Check, LogIn, LogOut, UserRound } from 'lucide-react'
import { usePlanStore } from '../../store/usePlanStore'
import { signIn, signOut, switchTestUser, testUsers } from '../../store/team'
import { Avatar } from './Avatar'

/** Who's signed in, their role in the open event, sign in/out, and (test mode) switching accounts. */
export function AccountCard({ onDone }: { onDone?: () => void }) {
  const account = usePlanStore((s) => s.account)
  const mode = usePlanStore((s) => s.backendMode)
  const role = usePlanStore((s) => s.role)
  const shared = usePlanStore((s) => !!s.plan.shared)
  const act = (fn: () => Promise<void>) => { onDone?.(); void fn() }
  if (!mode) return <p className="p-3 text-sm text-muted">Connecting…</p>

  if (!account) {
    return (
      <div className="p-3">
        <p className="mb-2 text-sm text-ink-2">Sign in to share events with your team and get their messages.</p>
        <button className="btn btn-primary w-full justify-center" onClick={() => act(signIn)}><LogIn size={15} />Sign in{mode === 'mock' ? ' (test account)' : ''}</button>
      </div>
    )
  }

  const users = mode === 'mock' ? testUsers() : []
  const roleText = !shared ? 'This event isn’t shared yet.'
    : role === 'admin' ? 'You’re an admin of this event.'
    : role === 'staff' ? 'You’re staff on this event.'
    : 'You’re not on this event’s team.'

  return (
    <div>
      <div className="flex items-center gap-3 p-3 pb-2">
        <Avatar name={account.name} dark />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-ink">{account.name}</div>
          <div className="truncate text-xs text-muted">{account.email}</div>
        </div>
      </div>
      <p className="px-3 pb-3 text-xs text-ink-2">{roleText}</p>
      {mode === 'mock' && (
        <div className="border-t border-bg-2 p-1">
          <div className="eyebrow px-2 pb-1 pt-2">Test mode · see the app as</div>
          {users.length > 1 ? users.map((u) => (
            <button key={u.id} onClick={() => { if (u.id !== account.id) act(() => switchTestUser(u.id)) }} aria-pressed={u.id === account.id}
              className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-bg pointer-coarse:min-h-11">
              <span className="min-w-0 flex-1 truncate">{u.name}</span>
              {u.id === account.id && <Check size={15} className="shrink-0 text-accent-deep" />}
            </button>
          )) : <p className="px-2 pb-2 text-xs text-muted">Invite someone from the Team tab, then switch to their account here.</p>}
        </div>
      )}
      <div className="border-t border-bg-2 p-1">
        <button className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-bg pointer-coarse:min-h-11" onClick={() => act(signOut)}>
          <LogOut size={15} className="text-muted" />Sign out
        </button>
      </div>
    </div>
  )
}

/** Top bar button that opens the account card. */
export function AccountMenu() {
  const account = usePlanStore((s) => s.account)
  const mode = usePlanStore((s) => s.backendMode)
  const [open, setOpen] = useState(false)
  if (!mode) return null
  return (
    <div className="relative shrink-0">
      <button title={account ? `${account.name} (account)` : 'Sign in'} onClick={() => setOpen(!open)}
        className="relative grid h-8 w-8 place-items-center rounded-full text-ink-2 hover:bg-bg-2 pointer-coarse:h-10 pointer-coarse:w-10">
        {account ? <Avatar name={account.name} dark /> : <UserRound size={18} />}
        {mode === 'mock' && <span className="absolute -bottom-1 -right-1.5 rounded bg-amber-300 px-0.5 font-mono text-[8px] font-bold leading-3 text-ink">TEST</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-30 w-72 rounded-lg border border-bg-2 bg-white shadow-lg">
            <AccountCard onDone={() => setOpen(false)} />
          </div>
        </>
      )}
    </div>
  )
}
