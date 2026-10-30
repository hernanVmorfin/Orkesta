import { useEffect, useMemo, useState } from 'react'
import { X, Copy, Check, Lock } from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'
import { protectedShareUrl, shareUrl } from '../lib/share'

export function ShareDialog({ onClose }: { onClose: () => void }) {
  const plan = usePlanStore((s) => s.plan)
  const [viewOnly, setViewOnly] = useState(true)
  const [guestNames, setGuestNames] = useState(false)
  const [copied, setCopied] = useState(false)
  const [protect, setProtect] = useState(false)
  const [password, setPassword] = useState('')
  const [locked, setLocked] = useState<{ key: string; url: string } | null>(null)
  const plainUrl = useMemo(() => shareUrl(plan, viewOnly, guestNames), [plan, viewOnly, guestNames])
  const strong = password.length >= 8
  // The protected link belongs to these exact inputs; any change makes the old one stale
  const key = protect && strong ? JSON.stringify([password, viewOnly, guestNames, plan.updatedAt]) : null
  // Encrypting takes a moment (key stretching), so build the protected link after typing pauses
  useEffect(() => {
    if (!key) return
    let live = true
    const t = setTimeout(() => { void protectedShareUrl(plan, viewOnly, guestNames, password).then((url) => { if (live) setLocked({ key, url }) }) }, 300)
    return () => { live = false; clearTimeout(t) }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const url = protect ? (locked?.key === key ? locked.url : '') : plainUrl
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40" onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div className="mx-4 w-full max-w-[520px] rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <div className="eyebrow">Vendor collaboration</div>
          <button onClick={onClose} className="text-muted hover:text-ink"><X size={18} /></button>
        </div>
        <h2 className="mb-4 text-xl font-semibold">Share this <span className="em">plan</span></h2>
        <div className="mb-3 flex gap-2">
          {[true, false].map((v) => (
            <button key={String(v)} onClick={() => setViewOnly(v)}
              className={`flex-1 rounded-lg border p-3 text-left text-sm ${viewOnly === v ? 'border-accent bg-accent/5' : 'border-bg-2'}`}>
              <div className="font-semibold">{v ? 'View only' : 'Can edit (copy)'}</div>
              <div className="text-xs text-muted">{v ? 'Vendors, decorators and venue see the live layout, pan, zoom and export.' : 'Recipient gets an editable copy in their browser.'}</div>
            </button>
          ))}
        </div>
        {plan.guests.length > 0 && (viewOnly ? (
          <label className="mb-3 flex items-start gap-2 rounded-lg bg-bg p-3 text-sm">
            <input type="checkbox" className="mt-0.5 accent-[#1ea7e8]" checked={guestNames} onChange={(e) => setGuestNames(e.target.checked)} />
            <span>
              <span className="font-semibold">Show guest names on tables</span>
              <span className="block text-xs text-muted">For check-in staff. Emails and dietary notes are never included in view-only links.</span>
            </span>
          </label>
        ) : (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            An editable copy includes the full guest list, with emails and dietary notes. Only send it to people who should see them.
          </p>
        ))}
        <div className="mb-3 rounded-lg border border-bg-2 p-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="accent-[#1ea7e8]" checked={protect} onChange={(e) => setProtect(e.target.checked)} />
            <Lock size={14} className="text-muted" /><span className="font-semibold">Protect with a password</span>
          </label>
          {protect && (
            <div className="mt-2 space-y-1">
              <input type="password" className="input" autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className={`text-[11px] ${password && !strong ? 'text-red-600' : 'text-muted'}`}>
                {password && !strong ? `${8 - password.length} more character${8 - password.length > 1 ? 's' : ''} needed. ` : ''}
                The plan is encrypted inside the link. Send the password separately; it can't be recovered.
              </p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <input readOnly value={url} placeholder={protect ? (strong ? 'Encrypting…' : 'Enter a password to create the link') : ''} className="input font-mono text-[11px]" onFocus={(e) => e.target.select()} />
          <button onClick={copy} disabled={!url} className="btn btn-primary shrink-0">{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy'}</button>
        </div>
        <p className="mt-3 text-[11px] leading-snug text-muted">
          The link holds a snapshot of the plan as it is now. To work on the live event with your team, invite them from the Team tab.
          {plan.basemap?.src.startsWith('data:') && ' Uploaded basemaps are not included in links.'}
        </p>
      </div>
    </div>
  )
}
