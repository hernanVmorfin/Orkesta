/**
 * App addresses: `/` is the hub and `/events/<id>` an event. Share links (`#plan=…`) and invites
 * (`#invite=…`) live in the hash, so they work on any address.
 */
export type View = 'hub' | 'editor'
export type Route = { view: 'hub' } | { view: 'editor'; id: string }

export function parseRoute(path: string = window.location.pathname): Route {
  const m = /^\/events\/([\w-]+)\/?$/.exec(path)
  return m ? { view: 'editor', id: m[1] } : { view: 'hub' }
}

export const pathFor = (view: View, id: string) => (view === 'hub' ? '/' : `/events/${id}`)
