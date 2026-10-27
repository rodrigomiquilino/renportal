/** Toast leve, compartilhado entre islands via evento no window. */
export function toast(message: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('renportal:toast', { detail: message }))
}
