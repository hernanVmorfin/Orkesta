import { X } from 'lucide-react'

/** Centered dialog with a title and close button; click outside or Esc to close. */
export function Modal({ title, eyebrow, onClose, children, wide = false }: {
  title: string; eyebrow?: string; onClose: () => void; children: React.ReactNode; wide?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <div role="dialog" aria-label={title} className={`max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white p-6 shadow-xl ${wide ? 'max-w-5xl' : 'max-w-md'}`}
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <div className="eyebrow">{eyebrow ?? ''}</div>
          <button onClick={onClose} className="text-muted hover:text-ink" aria-label="Close"><X size={18} /></button>
        </div>
        <h2 className="mb-4 text-xl font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function NumField({ label, value, onChange, step = 1, min, max, unit }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; unit?: string
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted">{label}{unit ? ` (${unit})` : ''}</span>
      <input type="number" className="input font-mono" step={step} min={min} max={max} value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          onChange(Number.isFinite(v) ? Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v)) : (min ?? 0))
        }} />
    </label>
  )
}
