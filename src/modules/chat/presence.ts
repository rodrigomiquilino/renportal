import { useSyncExternalStore } from 'react'

const empty = new Set<string>()
let online = empty
const listeners = new Set<() => void>()

export function setOnlineIds(next: Set<string>) {
  online = next
  listeners.forEach((listener) => listener())
}

/** Quem está com o portal aberto. A inscrição mora no layout. */
export function useOnlineIds() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => online,
    () => empty,
  )
}
