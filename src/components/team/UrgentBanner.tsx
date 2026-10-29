import { TriangleAlert } from 'lucide-react'
import { usePlanStore } from '../../store/usePlanStore'
import { markRead } from '../../store/team'

/** Staff: the newest unread urgent message, over everything until it's read. */
export function UrgentBanner({ onView, className = '' }: { onView: () => void; className?: string }) {
  const msg = usePlanStore((s) => (s.role === 'staff' ? s.messages.find((m) => m.priority === 'urgent' && !m.readByMe) : undefined))
  if (!msg) return null
  return (
    <div role="alert" className={`flex items-start gap-3 rounded-xl bg-red-600 p-3 text-white shadow-lg ${className}`}>
      <TriangleAlert size={20} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-white/85">Urgent · {msg.senderName}</div>
        <p className="line-clamp-3 whitespace-pre-wrap break-words text-sm">{msg.body}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <button className="h-8 rounded-md bg-white px-3 text-xs font-semibold text-red-700 pointer-coarse:h-10" onClick={onView}>View</button>
        <button className="h-8 rounded-md px-3 text-xs font-medium text-white hover:bg-white/15 pointer-coarse:h-10" onClick={() => void markRead([msg.id])}>Got it</button>
      </div>
    </div>
  )
}
