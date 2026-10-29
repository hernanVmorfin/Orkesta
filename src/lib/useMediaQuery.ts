import { useSyncExternalStore } from 'react'

/** True while the media query matches; re-renders on rotation or window resize. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', onChange)
      return () => m.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}

/** Phones get the read-only mobile companion; tablets and wider keep the editor. */
export const MOBILE_QUERY = '(max-width: 767px)'
export const useIsMobile = () => useMediaQuery(MOBILE_QUERY)

/** Wide enough for the library and right panel to sit beside the plan; narrower, they become drawers. */
export const WIDE_QUERY = '(min-width: 1280px)'
export const useIsWide = () => useMediaQuery(WIDE_QUERY)
