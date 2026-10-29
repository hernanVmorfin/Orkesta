/** Short message at the bottom of the screen (shown by App). */
export const toast = (msg: string) => window.dispatchEvent(new CustomEvent('fp:toast', { detail: msg }))
