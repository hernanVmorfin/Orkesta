import type { Backend } from './types'

export * from './types'

let instance: Promise<Backend> | undefined

/** The backend, initialized. Only the in-browser test backend exists until a server is connected. */
export function getBackend() {
  instance ??= (async () => {
    const b: Backend = new (await import('./mock')).MockBackend()
    await b.init()
    return b
  })()
  return instance
}
