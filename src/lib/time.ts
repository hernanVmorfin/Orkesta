/** "just now", "5 min ago", "3 h ago", "2 d ago", then the date. */
export function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  if (m < 60 * 24) return `${Math.round(m / 60)} h ago`
  if (m < 60 * 24 * 7) return `${Math.round(m / 1440)} d ago`
  return new Date(t).toLocaleDateString()
}
