import { useMemo, useState } from 'react'
import { X, Copy, Check } from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'
import { shareUrl } from '../lib/share'

export function ShareDialog({ onClose }: { onClose: () => void }) {
  const plan = usePlanStore((s) => s.plan)
  const [viewOnly, setViewOnly] = useState(true)
  const [guestNames, setGuestNames] = useState(false)
  const [copied, setCopied] = useState(false)
  const url = useMemo(() => shareUrl(plan, viewOnly, guestNames), [plan, viewOnly, guestNames])
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40" onClick={onClose}>
      <div className="w-[520px] rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
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
        <div className="flex gap-2">
          <input readOnly value={url} className="input font-mono text-[11px]" onFocus={(e) => e.target.select()} />
          <button onClick={copy} className="btn btn-primary shrink-0">{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy'}</button>
        </div>
        <p className="mt-3 text-[11px] leading-snug text-muted">
          Prototype: the plan is encoded in the link itself (snapshot). Phase 2 swaps this for a hosted, real-time room (Supabase Realtime or Liveblocks) so every link always shows the latest revision.
          {plan.basemap?.src.startsWith('data:') && ' Uploaded basemaps are not included in links.'}
        </p>
      </div>
    </div>
  )
}
