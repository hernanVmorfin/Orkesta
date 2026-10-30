import type { Plan } from '../types'

/** Local event storage in IndexedDB. Plans (with uploaded basemaps) are far bigger than localStorage's ~5 MB allows. */
export interface EventSummary { id: string; name: string; venue: string; date: string; updatedAt: number; shared?: boolean }

const DB_NAME = 'inbest-floorplan'
let dbp: Promise<IDBDatabase> | undefined

function open() {
  dbp ??= new Promise((res, rej) => {
    // v2 adds version history: small metadata kept apart from the full snapshots
    const req = indexedDB.open(DB_NAME, 2)
    req.onupgradeneeded = () => {
      for (const name of ['plans', 'summaries', 'versions', 'versionPlans']) {
        if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name)
      }
    }
    req.onsuccess = () => res(req.result)
    req.onerror = () => { dbp = undefined; rej(req.error) }
  })
  return dbp
}

const done = (tx: IDBTransaction) =>
  new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = tx.onabort = () => rej(tx.error) })

const result = <T>(req: IDBRequest<T>) =>
  new Promise<T>((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })

export const summarize = (p: Plan): EventSummary => ({ id: p.id, name: p.name, venue: p.venue, date: p.date, updatedAt: p.updatedAt, shared: p.shared })

export async function savePlan(p: Plan) {
  const tx = (await open()).transaction(['plans', 'summaries'], 'readwrite')
  tx.objectStore('plans').put(p, p.id)
  tx.objectStore('summaries').put(summarize(p), p.id)
  await done(tx)
}

export async function getPlan(id: string) {
  const tx = (await open()).transaction('plans')
  return (await result(tx.objectStore('plans').get(id))) as Plan | undefined
}

/** Summaries only, newest first, so the events menu never loads basemap images. */
export async function listEvents() {
  const tx = (await open()).transaction('summaries')
  const all = (await result(tx.objectStore('summaries').getAll())) as EventSummary[]
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function deletePlan(id: string) {
  const tx = (await open()).transaction(['plans', 'summaries', 'versions', 'versionPlans'], 'readwrite')
  tx.objectStore('plans').delete(id)
  tx.objectStore('summaries').delete(id)
  // Versions go with their event
  const metas = (await result(tx.objectStore('versions').getAll())) as VersionMeta[]
  metas.filter((v) => v.planId === id).forEach((v) => { tx.objectStore('versions').delete(v.id); tx.objectStore('versionPlans').delete(v.id) })
  await done(tx)
}

// ---- Version history (this device only) -------------------------------------

export interface VersionMeta { id: string; planId: string; name: string; auto: boolean; createdAt: number; objects: number }

/** Saved automatically; older ones are pruned past this count. Named versions are kept. */
const AUTO_KEEP = 30

export async function saveVersion(plan: Plan, name: string, auto: boolean) {
  const meta: VersionMeta = { id: `${plan.id}:${Date.now()}`, planId: plan.id, name, auto, createdAt: Date.now(), objects: plan.elements.length }
  const tx = (await open()).transaction(['versions', 'versionPlans'], 'readwrite')
  tx.objectStore('versions').put(meta, meta.id)
  tx.objectStore('versionPlans').put(plan, meta.id)
  if (auto) {
    const all = ((await result(tx.objectStore('versions').getAll())) as VersionMeta[])
      .filter((v) => v.planId === plan.id && v.auto).sort((a, b) => b.createdAt - a.createdAt)
    all.slice(AUTO_KEEP).forEach((v) => { tx.objectStore('versions').delete(v.id); tx.objectStore('versionPlans').delete(v.id) })
  }
  await done(tx)
  return meta
}

/** Newest first. */
export async function listVersions(planId: string) {
  const tx = (await open()).transaction('versions')
  const all = (await result(tx.objectStore('versions').getAll())) as VersionMeta[]
  return all.filter((v) => v.planId === planId).sort((a, b) => b.createdAt - a.createdAt)
}

export async function getVersion(id: string) {
  const tx = (await open()).transaction('versionPlans')
  return (await result(tx.objectStore('versionPlans').get(id))) as Plan | undefined
}

export async function deleteVersion(id: string) {
  const tx = (await open()).transaction(['versions', 'versionPlans'], 'readwrite')
  tx.objectStore('versions').delete(id)
  tx.objectStore('versionPlans').delete(id)
  await done(tx)
}
