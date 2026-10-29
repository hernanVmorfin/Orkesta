import type { Plan } from '../types'

/** Local event storage in IndexedDB. Plans (with uploaded basemaps) are far bigger than localStorage's ~5 MB allows. */
export interface EventSummary { id: string; name: string; venue: string; date: string; updatedAt: number }

const DB_NAME = 'inbest-floorplan'
let dbp: Promise<IDBDatabase> | undefined

function open() {
  dbp ??= new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('plans')
      req.result.createObjectStore('summaries')
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

export const summarize = (p: Plan): EventSummary => ({ id: p.id, name: p.name, venue: p.venue, date: p.date, updatedAt: p.updatedAt })

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
  const tx = (await open()).transaction(['plans', 'summaries'], 'readwrite')
  tx.objectStore('plans').delete(id)
  tx.objectStore('summaries').delete(id)
  await done(tx)
}
