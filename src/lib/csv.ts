import Papa from 'papaparse'
import { nanoid } from 'nanoid'
import type { Guest, Plan } from '../types'

export function download(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Matches a tag by id or name ("vip", "VIP", "Staff" for "Staff / reserved"). */
function findTag(plan: Plan, value: string) {
  const v = value.trim().toLowerCase()
  if (!v) return undefined
  return plan.tags.find((t) => t.id === v || t.name.toLowerCase() === v || t.name.toLowerCase().split(/\s*\/\s*/)[0] === v)?.id
}

/** CSV columns: name, company, group, email, dietary, table (number or label), tag (VIP, Sponsor…). */
export function parseGuestsCsv(text: string, plan: Plan): Guest[] {
  const res = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase() })
  const byKey = new Map<string, string>()
  plan.elements.forEach((e) => {
    if (e.number != null) byKey.set(String(e.number), e.id)
    byKey.set(e.label.toLowerCase(), e.id)
  })
  return res.data
    .filter((r) => (r.name || r.nombre || '').trim())
    .map((r) => {
      const t = (r.table || r.mesa || '').trim().toLowerCase()
      const group = (r.group || r.grupo || '').trim() || undefined
      // Without a tag column, a group named like a tag ("VIP", "Sponsor") counts as the tag
      const tag = findTag(plan, r.tag || r.etiqueta || r.tipo || '') ?? (group ? findTag(plan, group) : undefined)
      return {
        id: nanoid(8),
        name: (r.name || r.nombre).trim(),
        company: (r.company || r.empresa || '').trim() || undefined,
        group,
        email: (r.email || '').trim() || undefined,
        dietary: (r.dietary || r.dieta || '').trim() || undefined,
        tableId: t ? byKey.get(t) ?? byKey.get(`mesa ${t}`) ?? null : null,
        tag: tag === 'general' ? undefined : tag,
      }
    })
}

export function guestsToCsv(plan: Plan) {
  const byId = new Map(plan.elements.map((e) => [e.id, e]))
  const tagName = new Map(plan.tags.map((t) => [t.id, t.name]))
  return Papa.unparse(
    plan.guests.map((g) => {
      const t = g.tableId ? byId.get(g.tableId) : undefined
      return {
        name: g.name, company: g.company ?? '', group: g.group ?? '', email: g.email ?? '',
        dietary: g.dietary ?? '', table: t?.number ?? t?.label ?? '', tag: g.tag ? tagName.get(g.tag) ?? '' : '',
        checked_in: g.checkedIn ? 'yes' : '',
      }
    }),
  )
}

export const CSV_TEMPLATE = 'name,company,group,email,dietary,table,tag\nAna López,Acme,Acme team,ana@acme.com,vegetarian,1,Sponsor\nLuis Pérez,Beta Labs,,,,,\n'
