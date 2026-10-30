import { useEffect, useState } from 'react'
import { History, RotateCcw, Trash2 } from 'lucide-react'
import { usePlanStore } from '../../store/usePlanStore'
import * as db from '../../lib/db'
import { ago } from '../../lib/time'
import { toast } from '../../lib/toast'
import { Modal } from './Modal'

/**
 * Version history on this device: automatic snapshots (every 30 minutes of editing, last 30 kept)
 * and named versions. Restoring saves the current plan first, so a restore can itself be undone.
 */
export function HistoryDialog({ onClose }: { onClose: () => void }) {
  const s = usePlanStore()
  const [list, setList] = useState<db.VersionMeta[] | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const reload = () => db.listVersions(s.plan.id).then(setList, () => setList([]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void reload() }, [s.plan.id])

  const save = async () => {
    setBusy(true)
    try { await db.saveVersion(s.plan, name.trim() || `Version ${new Date().toLocaleString()}`, false); setName(''); await reload() } catch { toast('Couldn’t save the version') }
    setBusy(false)
  }
  const restore = async (v: db.VersionMeta) => {
    if (!confirm(`Restore "${v.name}" from ${new Date(v.createdAt).toLocaleString()}? Your current plan is saved to history first.`)) return
    setBusy(true)
    try {
      const snap = await db.getVersion(v.id)
      if (!snap) throw new Error('missing')
      await db.saveVersion(s.plan, `Before restoring “${v.name}”`, false)
      // Same event: keep its id and team link, take everything else from the snapshot
      s.mutate((p) => ({ ...snap, id: p.id, shared: p.shared }))
      s.set({ selection: [], levelId: null })
      toast(`Restored "${v.name}"`)
      onClose()
    } catch { toast('Couldn’t restore that version') }
    setBusy(false)
  }
  const remove = async (v: db.VersionMeta) => {
    await db.deleteVersion(v.id).catch(() => {})
    await reload()
  }

  return (
    <Modal title="Version history" eyebrow={s.plan.name} onClose={onClose}>
      {!s.viewOnly && (
        <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); void save() }}>
          <input className="input" placeholder="Name this version, e.g. Sent to venue" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-primary shrink-0" disabled={busy}><History size={15} />Save version</button>
        </form>
      )}
      {list === null ? <p className="text-sm text-muted">Loading…</p> : list.length ? (
        <ul className="max-h-80 divide-y divide-bg-2 overflow-y-auto rounded-lg border border-bg-2">
          {list.map((v) => (
            <li key={v.id} className="group flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className={`truncate text-sm ${v.auto ? 'text-ink-2' : 'font-semibold text-ink'}`}>{v.name}</div>
                <div className="text-[11px] text-muted">{new Date(v.createdAt).toLocaleString()} · {ago(v.createdAt)} · {v.objects} objects</div>
              </div>
              {!s.viewOnly && <button className="btn h-7 border border-bg-2 px-2 text-xs" disabled={busy} onClick={() => restore(v)}><RotateCcw size={13} />Restore</button>}
              <button className="rounded p-1 text-muted opacity-0 hover:text-red-600 group-hover:opacity-100" title="Delete version" onClick={() => remove(v)}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      ) : <p className="rounded-lg bg-bg p-3 text-sm text-muted">No versions yet. A snapshot is saved automatically every 30 minutes while you edit, or save one now.</p>}
      <p className="mt-3 text-[11px] text-muted">History is kept in this browser. The last 30 automatic snapshots are kept; named versions stay until you delete them.</p>
    </Modal>
  )
}
