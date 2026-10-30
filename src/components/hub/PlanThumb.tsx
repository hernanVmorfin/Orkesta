import { memo, useMemo } from 'react'
import { readThumb, SHAPE, type Thumb } from '../../lib/thumb'

/** Colours per tone (see TONE in lib/thumb): tables, staging, service, safety, areas, other, barriers. */
interface Paint { fill?: string; fillOpacity?: number; stroke?: string }
const TONES: Paint[] = [
  { fill: '#ffffff', stroke: '#1ea7e8' },
  { fill: '#1c2638' },
  { fill: '#d97706' },
  { fill: '#16a34a' },
  { fill: '#1ea7e8', fillOpacity: 0.12, stroke: '#1ea7e8' },
  { fill: '#94a3b8' },
  { fill: 'none', stroke: '#475569' },
]

/** A small drawing of a plan's first level, from its summary. */
export const PlanThumb = memo(function PlanThumb({ thumb, className = '' }: { thumb?: Thumb; className?: string }) {
  const shapes = useMemo(() => (thumb ? readThumb(thumb) : []), [thumb])
  if (!thumb || !(thumb.w > 0) || !(thumb.h > 0)) return <div className={`bg-bg ${className}`} />
  const sw = Math.max(thumb.w, thumb.h) / 220
  return (
    <svg viewBox={`${-sw * 4} ${-sw * 4} ${thumb.w + sw * 8} ${thumb.h + sw * 8}`} preserveAspectRatio="xMidYMid meet" className={`bg-bg ${className}`} aria-hidden="true">
      <rect width={thumb.w} height={thumb.h} fill="#ffffff" stroke="#cbd5e1" strokeWidth={sw * 1.5} />
      {shapes.map((sh, i) => {
        const paint = { strokeWidth: sw, ...(TONES[sh.tone] ?? TONES[5]) }
        if ('points' in sh) {
          const pts = sh.points.map(([x, y]) => `${x},${y}`).join(' ')
          return sh.kind === SHAPE.area
            ? <polygon key={i} points={pts} {...paint} />
            : <polyline key={i} points={pts} {...paint} strokeWidth={sw * 2} fill="none" />
        }
        const turn = sh.rotation ? `rotate(${sh.rotation} ${sh.x} ${sh.y})` : undefined
        return sh.kind === SHAPE.ellipse
          ? <ellipse key={i} cx={sh.x} cy={sh.y} rx={sh.w / 2} ry={sh.h / 2} transform={turn} {...paint} />
          : <rect key={i} x={sh.x - sh.w / 2} y={sh.y - sh.h / 2} width={sh.w} height={sh.h} transform={turn} {...paint} />
      })}
    </svg>
  )
})
