import { useState } from 'react'
import { usePlanStore } from '../../store/usePlanStore'
import { canvasRef } from '../../lib/canvas'
import { CATALOG } from '../../lib/catalog'
import { currentLevel } from '../../lib/levels'
import { blockSize, seatBlock, type BlockStyle } from '../../lib/layouts'
import type { Pt } from '../../types'
import { Modal, NumField } from './Modal'

/** Plan point at the middle of what's on screen. */
function viewCenter(): Pt {
  const { pan, zoom, plan } = usePlanStore.getState()
  const r = canvasRef.current?.getBoundingClientRect()
  if (!r?.width) return { x: plan.widthM / 2, y: plan.heightM / 2 }
  return { x: +((r.width / 2 - pan.x) / zoom).toFixed(2), y: +((r.height / 2 - pan.y) / zoom).toFixed(2) }
}

/** Copies the selected object into columns × rows, spaced by the gaps, following its rotation. */
export function RepeatDialog({ onClose }: { onClose: () => void }) {
  const s = usePlanStore()
  const e = s.plan.elements.find((x) => x.id === s.selection[0])
  const [cols, setCols] = useState(4)
  const [rows, setRows] = useState(1)
  const [gapX, setGapX] = useState(e && CATALOG[e.kind]?.shape === 'roundTable' ? 1.5 : 0.5)
  const [gapY, setGapY] = useState(gapX)
  if (!e) return null
  const copies = cols * rows - 1
  return (
    <Modal title="Repeat in a grid" eyebrow={e.label} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <NumField label="Columns" value={cols} min={1} max={20} onChange={setCols} />
        <NumField label="Rows" value={rows} min={1} max={20} onChange={setRows} />
        <NumField label="Gap between columns" unit="m" step={0.1} min={0} value={gapX} onChange={setGapX} />
        <NumField label="Gap between rows" unit="m" step={0.1} min={0} value={gapY} onChange={setGapY} />
      </div>
      <p className="mt-3 text-sm text-muted">
        Adds {copies} {copies === 1 ? 'copy' : 'copies'} ({cols} × {rows}), spaced {(e.w + gapX).toFixed(2)} m by {(e.h + gapY).toFixed(2)} m center to center.
        Gaps are measured edge to edge{CATALOG[e.kind]?.shape === 'roundTable' ? '; leave room for chairs (about 0.75 m each side)' : ''}.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={copies < 1} onClick={() => { s.repeat(e.id, cols, rows, gapX, gapY); onClose() }}>Add copies</button>
      </div>
    </Modal>
  )
}

/** Rows of chairs (theatre) or tables with chairs behind them (classroom), with aisles, as one folder. */
export function SeatBlockDialog({ onClose }: { onClose: () => void }) {
  const s = usePlanStore()
  const [style, setStyle] = useState<BlockStyle>('theatre')
  const [rows, setRows] = useState(10)
  const [perRow, setPerRow] = useState(12)
  const [seatW, setSeatW] = useState(0.5)
  const [rowGap, setRowGap] = useState(0.9)
  const [aisleEvery, setAisleEvery] = useState(6)
  const [aisleW, setAisleW] = useState(1.2)
  const [perTable, setPerTable] = useState(3)

  const pickStyle = (v: BlockStyle) => {
    setStyle(v)
    setRowGap(v === 'theatre' ? 0.9 : 1.5)
    setSeatW(v === 'theatre' ? 0.5 : 0.6)
  }
  const opts = { style, rows, perRow, seatW, rowGap, aisleEvery, aisleW, perTable }
  const { width, depth } = blockSize(opts)
  const seats = rows * perRow

  const create = () => {
    // Centered on the view, as one folder
    const c = viewCenter()
    s.addElements(seatBlock(opts, c.x - width / 2, c.y - depth / 2, currentLevel(s.plan, s.levelId)))
    s.groupSelected(`${style === 'theatre' ? 'Theatre' : 'Classroom'} block · ${seats} seats`)
    onClose()
  }

  return (
    <Modal title="Seating block" eyebrow="Layout" onClose={onClose}>
      <div className="mb-3 flex gap-2">
        {(['theatre', 'classroom'] as BlockStyle[]).map((v) => (
          <button key={v} onClick={() => pickStyle(v)}
            className={`flex-1 rounded-lg border p-3 text-left text-sm ${style === v ? 'border-accent bg-accent/5' : 'border-bg-2'}`}>
            <div className="font-semibold capitalize">{v}</div>
            <div className="text-xs text-muted">{v === 'theatre' ? 'Rows of chairs facing the stage' : 'Rows of tables with chairs behind'}</div>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumField label="Rows" value={rows} min={1} max={60} onChange={setRows} />
        <NumField label="Seats per row" value={perRow} min={1} max={80} onChange={setPerRow} />
        <NumField label="Seat width" unit="m" step={0.05} min={0.4} value={seatW} onChange={setSeatW} />
        <NumField label="Row spacing" unit="m" step={0.05} min={0.6} value={rowGap} onChange={setRowGap} />
        <NumField label="Aisle every … seats (0 = none)" value={aisleEvery} min={0} max={80} onChange={setAisleEvery} />
        <NumField label="Aisle width" unit="m" step={0.1} min={0.6} value={aisleW} onChange={setAisleW} />
        {style === 'classroom' && <NumField label="Seats per table" value={perTable} min={1} max={10} onChange={setPerTable} />}
      </div>
      <p className="mt-3 rounded-lg bg-bg p-3 text-sm">
        <b>{seats.toLocaleString()} seats</b> · block about {width.toFixed(1)} × {depth.toFixed(1)} m. It's placed in the middle of your view as one folder you can move and lock.
      </p>
      {rows * perRow > 1500 && <p className="mt-2 text-xs text-red-600">That's a lot of objects; very large blocks can slow the editor down.</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={create}>Add {seats.toLocaleString()} seats</button>
      </div>
    </Modal>
  )
}
