import { useMemo, useState } from 'react'
import { X, Copy, Check } from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'
import { shareUrl } from '../lib/share'

export function ShareDialog({ onClose }: { onClose: () => void }) {
  const plan = usePlanStore((s) => s.plan)
  const [viewOnly, setViewOnly] = useState(true)
  const [copied, setCopied] = useState(false)
  const url = useMemo(() => shareUrl(plan, viewOnly), [plan, viewOnly])
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
