import { colorFor, initials } from '../../lib/profile'

const SIZES = { sm: 'h-8 w-8 text-[11px]', md: 'h-10 w-10 text-sm', lg: 'h-20 w-20 text-2xl' } as const

/** A person's photo, or their initials on their colour. Without an id or colour it falls back to a neutral circle. */
export function Avatar({ name, id, color, photo, dark = false, size = 'sm' }: {
  name: string; id?: string; color?: string; photo?: string; dark?: boolean; size?: keyof typeof SIZES
}) {
  if (photo) return <img src={photo} alt="" aria-hidden className={`${SIZES[size]} shrink-0 rounded-full object-cover`} />
  const bg = color ?? (id ? colorFor(id) : undefined)
  return (
    <span aria-hidden style={bg ? { background: bg } : undefined}
      className={`grid ${SIZES[size]} shrink-0 place-items-center rounded-full font-semibold ${bg || dark ? 'text-white' : 'bg-bg-2 text-ink-2'} ${!bg && dark ? 'bg-ink' : ''}`}>
      {initials(name)}
    </span>
  )
}
