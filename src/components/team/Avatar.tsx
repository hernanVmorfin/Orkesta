/** Initials in a circle. */
export function Avatar({ name, dark = false }: { name: string; dark?: boolean }) {
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  return (
    <span aria-hidden className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${dark ? 'bg-ink text-on-ink' : 'bg-bg-2 text-ink-2'}`}>
      {initials}
    </span>
  )
}
