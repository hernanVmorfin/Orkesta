import { useState } from 'react'
import { Check, RotateCcw, Trash2, X } from 'lucide-react'
import { usePlanStore } from '../store/usePlanStore'
import { activeLevel, BASE_LEVEL } from '../lib/levels'
import { ago } from '../lib/time'
import type { PlanComment } from '../types'

/** Comment pins and threads, drawn over the plan in screen pixels. */
export function CommentsLayer({ readOnly, width }: { readOnly: boolean; width: number }) {
  const s = usePlanStore()
  const { plan, zoom, pan } = s
  if (!s.showComments && !s.commentDraft) return null
  const all = plan.comments ?? []
  const lv = activeLevel(plan, s.levelId).id
  const list = all.filter((c) => (c.levelId ?? BASE_LEVEL) === lv && (s.showResolved || !c.resolved || c.id === s.activeComment))
  const screen = (x: number, y: number) => ({ left: pan.x + x * zoom, top: pan.y + y * zoom })
  const active = list.find((c) => c.id === s.activeComment)
  const popAt = (x: number, y: number) => {
    const p = screen(x, y)
    return p.left + 320 > width ? { left: p.left - 300, top: p.top - 12 } : { left: p.left + 18, top: p.top - 12 }
  }

  return (
    <>
      {s.showComments && list.map((c) => {
        const p = screen(c.x, c.y)
        const n = all.indexOf(c) + 1
        return (
          <button key={c.id} title={`${c.author}: ${c.body}`} onClick={() => s.set({ activeComment: c.id === s.activeComment ? null : c.id, commentDraft: null })}
            className={`absolute z-10 grid h-7 min-w-7 -translate-x-1/2 -translate-y-full place-items-center rounded-full rounded-bl-none px-1.5 text-xs font-semibold shadow-md ring-2 ring-white ${c.resolved ? 'bg-muted text-white' : 'bg-accent-deep text-white'} ${c.id === s.activeComment ? 'scale-110' : ''}`}
            style={{ left: p.left, top: p.top }}>
            {c.replies.length ? `${n}·${c.replies.length + 1}` : n}
          </button>
        )
      })}
      {active && <Thread c={active} n={all.indexOf(active) + 1} readOnly={readOnly} style={popAt(active.x, active.y)} />}
      {s.commentDraft && !readOnly && <Draft style={popAt(s.commentDraft.x, s.commentDraft.y)} pin={screen(s.commentDraft.x, s.commentDraft.y)} />}
    </>
  )
}

function Draft({ style, pin }: { style: React.CSSProperties; pin: { left: number; top: number } }) {
  const s = usePlanStore()
  const [body, setBody] = useState('')
  const post = () => { if (body.trim() && s.commentDraft) s.addComment(s.commentDraft, body.trim()) }
  return (
    <>
      <div className="absolute z-10 h-7 w-7 -translate-x-1/2 -translate-y-full rounded-full rounded-bl-none bg-accent shadow-md ring-2 ring-white" style={pin} />
      <div className="absolute z-20 w-72 rounded-xl border border-bg-2 bg-white p-3 shadow-xl" style={style}>
        <textarea autoFocus className="input h-20 py-1" placeholder="Add a comment for the team…" value={body} maxLength={1000}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post() } if (e.key === 'Escape') s.set({ commentDraft: null }) }} />
        <div className="mt-2 flex justify-end gap-1">
          <button className="btn" onClick={() => s.set({ commentDraft: null })}>Cancel</button>
          <button className="btn btn-primary" disabled={!body.trim()} onClick={post}>Post</button>
        </div>
      </div>
    </>
  )
}

function Thread({ c, n, readOnly, style }: { c: PlanComment; n: number; readOnly: boolean; style: React.CSSProperties }) {
  const s = usePlanStore()
  const [reply, setReply] = useState('')
  const send = () => { if (reply.trim()) { s.replyComment(c.id, reply.trim()); setReply('') } }
  return (
    <div className="absolute z-20 w-72 rounded-xl border border-bg-2 bg-white shadow-xl" style={style}>
      <div className="flex items-center gap-1 border-b border-bg-2 px-3 py-2">
        <span className="flex-1 text-xs font-semibold text-ink-2">Comment {n}{c.resolved ? ' · resolved' : ''}</span>
        {!readOnly && (
          <button className="rounded p-1 text-muted hover:bg-bg hover:text-ink" title={c.resolved ? 'Reopen' : 'Resolve'} onClick={() => s.resolveComment(c.id, !c.resolved)}>
            {c.resolved ? <RotateCcw size={15} /> : <Check size={15} />}
          </button>
        )}
        {!readOnly && (
          <button className="rounded p-1 text-muted hover:bg-bg hover:text-red-600" title="Delete thread"
            onClick={() => { if (confirm('Delete this comment thread? This can’t be undone.')) s.deleteComment(c.id) }}><Trash2 size={15} /></button>
        )}
        <button className="rounded p-1 text-muted hover:bg-bg hover:text-ink" title="Close" onClick={() => s.set({ activeComment: null })}><X size={15} /></button>
      </div>
      <ul className="max-h-64 space-y-2 overflow-y-auto px-3 py-2">
        {[c, ...c.replies].map((r, i) => (
          <li key={r.id} className="group text-sm">
            <div className="flex items-center gap-1 text-[11px] text-muted">
              <span className="font-semibold text-ink-2">{r.author}</span><span>· {ago(r.createdAt)}</span>
              {i > 0 && !readOnly && (
                <button className="ml-auto opacity-0 hover:text-red-600 group-hover:opacity-100" title="Delete reply" onClick={() => s.deleteComment(c.id, r.id)}><Trash2 size={12} /></button>
              )}
            </div>
            <p className="whitespace-pre-wrap text-ink">{r.body}</p>
          </li>
        ))}
      </ul>
      {!readOnly && (
        <div className="flex gap-1 border-t border-bg-2 p-2">
          <input className="input" placeholder="Reply…" value={reply} maxLength={1000} onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send() }} />
          <button className="btn btn-primary shrink-0" disabled={!reply.trim()} onClick={send}>Reply</button>
        </div>
      )}
    </div>
  )
}
