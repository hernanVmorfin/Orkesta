import { useEffect, useState } from 'react'
import { LogIn, MessageSquare, Users } from 'lucide-react'
import { usePlanStore } from '../../store/usePlanStore'
import { shareEvent, signIn, useUnread, watchPeople } from '../../store/team'
import type { MessagePin } from '../../lib/backend'
import { MessagesSection } from './MessagesSection'
import { PeopleSection } from './PeopleSection'

/** Team tab (desktop panel and phone tab): messages and people for a shared event, or how to share it. */
export function TeamPanel({ onShowPin }: { onShowPin: (pin: MessagePin) => void }) {
  const mode = usePlanStore((s) => s.backendMode)
  const account = usePlanStore((s) => s.account)
  const shared = usePlanStore((s) => !!s.plan.shared)
  const role = usePlanStore((s) => s.role)
  const view = usePlanStore((s) => s.teamView)
  const unread = useUnread()
  useEffect(() => watchPeople(), [])

  let body: React.ReactNode
  if (!mode) body = <p className="p-4 text-sm text-muted">Connecting…</p>
  else if (!account) {
    body = (
      <Intro title="Work on this event with your team">
        <p>Sign in to invite people to this event and send them messages.</p>
        <button className="btn btn-primary mt-3 w-full justify-center" onClick={() => void signIn()}><LogIn size={15} />Sign in</button>
      </Intro>
    )
  } else if (!shared) body = <SharePrompt />
  else if (!role) {
    body = (
      <Intro title="You’re not on this team">
        <p>You were removed from this event, or it’s no longer shared. The copy on this device stays, read-only. Ask an admin to invite you again.</p>
      </Intro>
    )
  } else {
    body = (
      <>
        <div className="flex gap-1 border-b border-bg-2 p-2">
          {(['messages', 'people'] as const).map((v) => (
            <button key={v} aria-pressed={view === v} onClick={() => usePlanStore.setState({ teamView: v })}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium pointer-coarse:py-2.5 ${view === v ? 'bg-ink text-on-ink' : 'text-ink-2 hover:bg-bg'}`}>
              {v === 'messages' ? <><MessageSquare size={14} />Messages</> : <><Users size={14} />People</>}
              {v === 'messages' && unread > 0 && <span className="rounded-full bg-red-600 px-1.5 text-[10px] leading-4 text-white">{unread}</span>}
            </button>
          ))}
        </div>
        {view === 'messages' ? <MessagesSection onShowPin={onShowPin} /> : <PeopleSection />}
      </>
    )
  }

  return (
    <div>
      {body}
      {mode === 'mock' && (
        <p className="m-4 rounded-lg bg-amber-50 p-3 text-[11px] leading-snug text-amber-900">
          Test mode: no server is connected yet, so the team, invites and messages are saved in this browser only. Open an invite link in another tab to try the app as that person.
        </p>
      )}
    </div>
  )
}

function Intro({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4">
      <h3 className="mb-1 text-sm font-semibold text-ink">{title}</h3>
      <div className="text-sm text-ink-2">{children}</div>
    </div>
  )
}

function SharePrompt() {
  const [busy, setBusy] = useState(false)
  const share = async () => {
    setBusy(true)
    await shareEvent()
    setBusy(false)
  }
  return (
    <Intro title="Work on this event with your team">
      <ul className="list-disc space-y-1 pl-4 text-[13px]">
        <li><span className="font-medium text-ink">Admins</span> edit the plan, invite people and send messages.</li>
        <li><span className="font-medium text-ink">Staff</span> see the plan and guest details, check guests in and get your messages on their phones.</li>
      </ul>
      <p className="mt-2 text-xs text-muted">You become this event’s admin. Each person only sees the events they’re invited to.</p>
      <button className="btn btn-primary mt-3 w-full justify-center" disabled={busy} onClick={() => void share()}><Users size={15} />{busy ? 'Sharing…' : 'Share with my team'}</button>
    </Intro>
  )
}
