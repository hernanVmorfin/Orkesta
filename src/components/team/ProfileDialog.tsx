import { useRef, useState } from 'react'
import { Camera, Check, Mail, Trash2 } from 'lucide-react'
import { usePlanStore } from '../../store/usePlanStore'
import { signIn, skipProfileSetup, updateProfile } from '../../store/team'
import { AVATAR_COLORS, cleanProfile, colorFor, PROFILE_LIMITS } from '../../lib/profile'
import { squarePhoto } from '../../lib/photo'
import { toast } from '../../lib/toast'
import { Modal } from '../dialogs/Modal'
import { Avatar } from './Avatar'

/**
 * Your profile: how you appear on comments, messages and team lists. `welcome` is the one-time setup after
 * signing in (or joining from an invite, when the name was only guessed from the email address).
 */
export function ProfileDialog({ onClose, welcome = false }: { onClose: () => void; welcome?: boolean }) {
  const account = usePlanStore((s) => s.account)
  const mode = usePlanStore((s) => s.backendMode)
  const [name, setName] = useState(account?.name ?? '')
  const [title, setTitle] = useState(account?.title ?? '')
  const [company, setCompany] = useState(account?.company ?? '')
  const [phone, setPhone] = useState(account?.phone ?? '')
  const [color, setColor] = useState(account?.color ?? '')
  const [photo, setPhoto] = useState(account?.photo ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  // Dismissing the welcome step means "later": it won't come back on this device
  const close = welcome ? () => { skipProfileSetup(); onClose() } : onClose

  if (!account) {
    return (
      <Modal title="Your profile" eyebrow="Account" onClose={onClose}>
        <p className="text-sm text-ink-2">Sign in to set up how you appear to your team.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Cancel</button>
          {mode && <button className="btn btn-primary" onClick={() => { onClose(); void signIn() }}>Sign in</button>}
        </div>
      </Modal>
    )
  }

  const pickPhoto = async (f: File) => {
    try { setPhoto(await squarePhoto(f)); setError(null) } catch { setError('That file isn’t an image we can read. Try a JPEG or PNG.') }
  }
  const save = async () => {
    const clean = cleanProfile({ name, title, company, phone, color, photo })
    if (!clean.ok) { setError(clean.error); return }
    setBusy(true)
    try {
      const saved = await updateProfile(clean.patch)
      toast(welcome ? `Welcome, ${saved.name.split(' ')[0]}` : 'Profile saved')
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }
  const field = (label: string, value: string, set: (v: string) => void, opts: { placeholder: string; max: number; hint?: string; type?: string; autoFocus?: boolean; autoComplete?: string }) => (
    <label className="block">
      <span className="text-[11px] text-muted">{label}</span>
      <input className="input" type={opts.type ?? 'text'} value={value} maxLength={opts.max} placeholder={opts.placeholder} autoFocus={opts.autoFocus} autoComplete={opts.autoComplete}
        onChange={(e) => { set(e.target.value); setError(null) }} />
      {opts.hint && <span className="mt-0.5 block text-[11px] text-muted">{opts.hint}</span>}
    </label>
  )

  return (
    <Modal title={welcome ? 'Set up your profile' : 'Your profile'} eyebrow={welcome ? 'Welcome to Orkesta' : 'Account'} onClose={close}>
      <form onSubmit={(e) => { e.preventDefault(); void save() }}>
        <p className="mb-4 text-sm text-ink-2">This is how you appear to your team: on comments, messages and the people list. You can change it anytime.</p>

        <div className="mb-4 flex items-center gap-4">
          <Avatar name={name || account.name} id={account.id} color={color || undefined} photo={photo || undefined} size="lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap gap-1">
              <button type="button" className="btn border border-bg-2" onClick={() => fileRef.current?.click()}><Camera size={15} />{photo ? 'Change photo' : 'Add photo'}</button>
              {photo && <button type="button" className="btn text-red-700" onClick={() => setPhoto('')}><Trash2 size={15} />Remove</button>}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void pickPhoto(f) }} />
            </div>
            {!photo && (
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Avatar colour">
                {AVATAR_COLORS.map((c) => {
                  const on = (color || colorFor(account.id)) === c
                  return (
                    <button key={c} type="button" role="radio" aria-checked={on} aria-label={`Colour ${c}`} onClick={() => setColor(c)}
                      className={`grid h-6 w-6 place-items-center rounded-full ring-offset-2 ${on ? 'ring-2 ring-ink' : ''}`} style={{ background: c }}>
                      {on && <Check size={13} className="text-white" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {field('Name', name, setName, { placeholder: 'Ana Ruiz', max: PROFILE_LIMITS.name, autoFocus: true, autoComplete: 'name' })}
          <div className="grid gap-3 sm:grid-cols-2">
            {field('Job title', title, setTitle, { placeholder: 'Event producer', max: PROFILE_LIMITS.title, autoComplete: 'organization-title' })}
            {field('Company', company, setCompany, { placeholder: 'iNBest', max: PROFILE_LIMITS.company, autoComplete: 'organization' })}
          </div>
          {field('Phone', phone, setPhone, { placeholder: '+52 81 1234 5678', max: PROFILE_LIMITS.phone, type: 'tel', autoComplete: 'tel', hint: 'Only admins of events you’re on can see it, for event-day contact.' })}
          <div>
            <span className="text-[11px] text-muted">Email</span>
            <div className="flex items-center gap-2 rounded-md bg-bg px-2.5 py-1.5 text-sm text-ink-2"><Mail size={14} className="shrink-0 text-muted" /><span className="truncate">{account.email}</span></div>
            <span className="mt-0.5 block text-[11px] text-muted">
              {mode === 'mock' ? 'Test accounts keep their email.' : 'You sign in with this email. To change it, contact your Orkesta admin.'}
            </span>
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn" onClick={close}>{welcome ? 'Later' : 'Cancel'}</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : welcome ? 'Save profile' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}
