import { memo } from 'react'
import type { ElementStyle, PlanElement, Pt, TableTag } from '../types'
import { CATALOG } from '../lib/catalog'
import { ICONS } from '../lib/icons'
import { calcInputs, planSummary } from '../lib/calcs'
import { centroid, marksAlong, midpointAlong, pathLength } from '../lib/shapes'

interface Props {
  e: PlanElement
  tag?: TableTag
  used?: number
  showLabels: boolean
  highlight?: boolean
}

const FONT = 'Geist, Arial, sans-serif'

function Chairs({ e }: { e: PlanElement }) {
  const n = e.seats ?? 0
  const shape = CATALOG[e.kind]?.shape
  const chairs: { x: number; y: number; r: number }[] = []
  if (shape === 'roundTable') {
    const R = e.w / 2 + 0.3
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2
      chairs.push({ x: Math.cos(a) * R, y: Math.sin(a) * R, r: (a * 180) / Math.PI + 90 })
    }
  } else {
    const per = Math.ceil(n / 2)
    for (let i = 0; i < n; i++) {
      const side = i < per ? -1 : 1
      const k = i < per ? i : i - per
      const cnt = i < per ? per : n - per
      chairs.push({ x: -e.w / 2 + (e.w / cnt) * (k + 0.5), y: side * (e.h / 2 + 0.3), r: side < 0 ? 0 : 180 })
    }
  }
  return (
    <g>
      {chairs.map((c, i) => (
        <rect key={i} x={-0.21} y={-0.18} width={0.42} height={0.36} rx={0.08}
          transform={`translate(${c.x} ${c.y}) rotate(${c.r})`}
          fill="#ffffff" stroke="#5b6576" strokeWidth={0.04} />
      ))}
    </g>
  )
}

const dashFor = (st: ElementStyle, w: number) =>
  st.strokeStyle === 'dashed' ? `${w * 4} ${w * 3}` : st.strokeStyle === 'dotted' ? `0 ${w * 2.2}` : undefined

/** Upright text angle for a line running at `a` radians. */
const readable = (a: number) => {
  const d = (a * 180) / Math.PI
  return d > 90 || d < -90 ? d + 180 : d
}

/** Pattern marks along a drawn line: section ticks, flow arrows, chevrons, or posts/cones. */
function Marks({ pts, st, e }: { pts: Pt[]; st: ElementStyle; e: PlanElement }) {
  const sw = st.strokeWidth ?? 0.1
  const stroke = st.stroke ?? '#5b6576'
  const v = calcInputs(e)
  switch (st.pattern) {
    case 'ticks': {
      const seg = v.segmentM ?? 2
      const half = Math.max(sw * 2.2, 0.2)
      return <g>{marksAlong(pts, seg, seg).map((m, i) => (
        <line key={i} x1={0} y1={-half} x2={0} y2={half} stroke={stroke} strokeWidth={sw * 0.8}
          transform={`translate(${m.p.x} ${m.p.y}) rotate(${(m.angle * 180) / Math.PI})`} />
      ))}</g>
    }
    case 'dots': {
      const r = Math.max(0.12, sw * 2.5)
      return <g>{marksAlong(pts, v.spacingM ?? 1, 0).map((m, i) => (
        <circle key={i} cx={m.p.x} cy={m.p.y} r={r} fill={stroke} stroke="#ffffff" strokeWidth={r * 0.3} />
      ))}</g>
    }
    case 'arrows':
    case 'chevrons': {
      const s = Math.max(sw * 0.9, 0.15)
      const every = Math.max(sw * 10, 2)
      return <g>{marksAlong(pts, every).map((m, i) => (
        <path key={i} transform={`translate(${m.p.x} ${m.p.y}) rotate(${(m.angle * 180) / Math.PI})`}
          d={st.pattern === 'arrows' ? `M ${s} 0 L ${-s * 0.7} ${-s * 0.8} L ${-s * 0.7} ${s * 0.8} Z` : `M ${-s * 0.5} ${-s} L ${s * 0.5} 0 L ${-s * 0.5} ${s}`}
          fill={st.pattern === 'arrows' ? '#ffffff' : 'none'} stroke="#ffffff" strokeWidth={st.pattern === 'arrows' ? 0 : s * 0.35}
          strokeLinecap="round" strokeLinejoin="round" />
      ))}</g>
    }
    default:
      return null
  }
}

/** A drawn line or area. Points are already in the element's local frame. */
function DrawnShape({ e, showLabels }: { e: PlanElement; showLabels: boolean }) {
  const c = CATALOG[e.kind]
  const st: ElementStyle = { ...c?.style, ...e.style }
  const pts = e.points!
  const closed = c?.geometry === 'polygon'
  const sw = st.strokeWidth ?? 0.1
  const stroke = st.stroke ?? e.color ?? c?.color ?? '#5b6576'
  const d = pts.map((p) => `${p.x},${p.y}`).join(' ')
  const dash = dashFor(st, sw)
  const label = showLabels && e.label

  if (closed) {
    const ct = centroid(pts)
    const summary = planSummary(e)
    const fs = Math.min(0.6, Math.max(0.3, Math.sqrt(Math.max(1, e.w * e.h)) / 14))
    return (
      <>
        <polygon points={d} fill={st.fill ?? stroke} fillOpacity={st.fillOpacity ?? 0.1} stroke={stroke} strokeWidth={sw}
          strokeDasharray={dash} strokeLinejoin="round" strokeLinecap="round" />
        {label && (
          <g transform={`rotate(${-e.rotation} ${ct.x} ${ct.y})`} pointerEvents="none">
            <text x={ct.x} y={ct.y - (summary ? fs * 0.4 : 0)} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT}
              fontSize={fs} fontWeight={600} fill="#0a1729" stroke="#ffffff" strokeWidth={fs * 0.18} paintOrder="stroke">{e.label}</text>
            {summary && (
              <text x={ct.x} y={ct.y + fs * 0.8} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT}
                fontSize={fs * 0.8} fill="#1c2638" stroke="#ffffff" strokeWidth={fs * 0.15} paintOrder="stroke">{summary}</text>
            )}
          </g>
        )}
      </>
    )
  }

  const mid = midpointAlong(pts)
  const fs = Math.min(0.5, Math.max(0.28, sw * 1.6))
  return (
    <>
      {/* a wide invisible stroke makes thin lines easy to click */}
      <polyline points={d} fill="none" stroke="transparent" strokeWidth={Math.max(sw, 0.8)} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={d} fill="none" stroke={stroke} strokeOpacity={st.pattern === 'arrows' || st.pattern === 'chevrons' ? 0.85 : 1}
        strokeWidth={sw} strokeDasharray={dash} strokeLinecap="round" strokeLinejoin="round" />
      <Marks pts={pts} st={st} e={e} />
      {label && pathLength(pts) > 1 && (
        <text transform={`translate(${mid.p.x} ${mid.p.y}) rotate(${readable(mid.angle)})`} y={-(sw / 2 + fs * 0.5)}
          textAnchor="middle" fontFamily={FONT} fontSize={fs} fill="#1c2638" stroke="#ffffff" strokeWidth={fs * 0.18}
          paintOrder="stroke" pointerEvents="none">{e.label}</text>
      )}
    </>
  )
}

export const ElementShape = memo(function ElementShape({ e, tag, used, showLabels, highlight }: Props) {
  const c = CATALOG[e.kind]
  const shape = c?.shape ?? 'rect'
  const color = e.color ?? c?.color ?? '#5b6576'

  if (e.points?.length) {
    return (
      <g transform={`translate(${e.x} ${e.y}) rotate(${e.rotation})`} data-id={e.id} style={{ cursor: e.locked ? 'default' : 'move' }}>
        {highlight && <circle r={Math.max(e.w, e.h) / 2 + 1} fill="#1ea7e8" fillOpacity={0.18} className="no-export" />}
        <DrawnShape e={e} showLabels={showLabels} />
      </g>
    )
  }

  let body: React.ReactNode
  switch (shape) {
    case 'roundTable': {
      const tc = tag?.color ?? '#1ea7e8'
      const full = used != null && e.seats != null && used >= e.seats
      body = (
        <>
          <Chairs e={e} />
          <circle r={e.w / 2} fill="#ffffff" stroke={tc} strokeWidth={0.08} />
          <circle r={e.w / 2 - 0.12} fill={tc} fillOpacity={0.12} />
          <text y={0.05} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT} fontWeight={600}
            fontSize={e.w * 0.36} fill="#0a1729" transform={`rotate(${-e.rotation})`}>{e.number ?? ''}</text>
          {used != null && used > 0 && (
            <text y={e.w * 0.3} textAnchor="middle" dominantBaseline="middle" fontFamily={FONT}
              fontSize={0.22} fill={full ? '#16a34a' : '#5b6576'} transform={`rotate(${-e.rotation})`}>{used}/{e.seats}</text>
          )}
        </>
      )
      break
    }
    case 'rectTable': {
      const tc = tag?.color ?? '#1ea7e8'
      body = (
        <>
          <Chairs e={e} />
          <rect x={-e.w / 2} y={-e.h / 2} width={e.w} height={e.h} rx={0.06} fill="#ffffff" stroke={tc} strokeWidth={0.06} />
          <text textAnchor="middle" dominantBaseline="middle" fontFamily={FONT} fontWeight={600}
            fontSize={Math.min(e.h * 0.6, 0.6)} fill="#0a1729">{e.number ?? ''}{used ? ` · ${used}/${e.seats}` : ''}</text>
        </>
      )
      break
    }
    case 'cocktail':
      body = <circle r={e.w / 2} fill="#ffffff" stroke="#5b6576" strokeWidth={0.05} />
      break
    case 'plant':
      body = (
        <g>
          <circle r={e.w / 2} fill="#16a34a" fillOpacity={0.85} />
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} r={e.w / 5} cx={Math.cos((a * Math.PI) / 180) * e.w / 4} cy={Math.sin((a * Math.PI) / 180) * e.w / 4} fill="#22c55e" />
          ))}
        </g>
      )
      break
    case 'icon': {
      const Icon = c?.icon ? ICONS[c.icon] : undefined
      const s = e.w * 0.62
      body = (
        <>
          <circle r={e.w / 2} fill={color} stroke="#ffffff" strokeWidth={0.06} />
          {Icon && <Icon x={-s / 2} y={-s / 2} width={s} height={s} color="#ffffff" strokeWidth={2.2} />}
        </>
      )
      break
    }
    case 'zone':
      body = (
        <>
          <rect x={-e.w / 2} y={-e.h / 2} width={e.w} height={e.h} fill={e.style?.fill ?? color} fillOpacity={e.style?.fillOpacity ?? 0.05}
            stroke={color} strokeWidth={0.1} strokeDasharray={e.style?.strokeStyle === 'solid' ? undefined : '0.4 0.25'} />
          <text x={-e.w / 2 + 0.3} y={-e.h / 2 + 0.6} fontFamily={FONT} fontSize={0.45} fill={color}>{e.label}</text>
        </>
      )
      break
    case 'text':
      body = <text textAnchor="middle" dominantBaseline="middle" fontFamily={FONT} fontSize={e.h * 0.7} fill={color}>{e.label}</text>
      break
    default: {
      const dark = ['#0a1729', '#1c2638', '#7c3aed', '#b45309', '#64748b', '#075e99'].includes(color)
      const vertical = e.h > e.w * 1.5
      const fs = Math.min(Math.max(Math.min(e.w, e.h) * 0.32, 0.18), 0.9)
      body = (
        <>
          <rect x={-e.w / 2} y={-e.h / 2} width={e.w} height={e.h} rx={Math.min(e.w, e.h) * 0.08}
            fill={color} fillOpacity={e.style?.fillOpacity ?? (shape === 'line' ? 1 : 0.9)} />
          {showLabels && shape !== 'line' && Math.min(e.w, e.h) > 0.35 && (
            <text textAnchor="middle" dominantBaseline="middle" fontFamily={FONT} fontSize={fs}
              fill={dark ? '#eaf1fa' : '#0a1729'} transform={vertical ? 'rotate(-90)' : undefined}>{e.label}</text>
          )}
        </>
      )
    }
  }

  const outerLabel = showLabels && (shape === 'icon' || (shape === 'rect' && Math.min(e.w, e.h) <= 0.35)) && (
    <text y={(shape === 'icon' ? e.w / 2 : e.h / 2) + 0.38} textAnchor="middle" fontFamily={FONT} fontSize={0.3}
      fill="#1c2638" stroke="#ffffff" strokeWidth={0.08} paintOrder="stroke" transform={`rotate(${-e.rotation})`}>{e.label}</text>
  )

  return (
    <g transform={`translate(${e.x} ${e.y}) rotate(${e.rotation})`} data-id={e.id}
      style={{ cursor: e.locked ? 'default' : 'move' }}>
      {highlight && <circle r={Math.max(e.w, e.h) / 2 + 1} fill="#1ea7e8" fillOpacity={0.18} className="no-export" />}
      {body}
      {outerLabel}
    </g>
  )
})
