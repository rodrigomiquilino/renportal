const xpFormat = new Intl.NumberFormat('pt-BR')
const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' })
const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export function formatXp(xp: number): string {
  return xpFormat.format(Math.max(0, Math.floor(xp)))
}

export function formatPlayTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}min`
  if (minutes > 0) return `${minutes}min`
  return `${seconds}s`
}

export function formatSize(mb: number | null | undefined): string | null {
  if (mb == null || Number.isNaN(Number(mb))) return null
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(Number(mb))} MB`
}

export function formatRelative(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const minutes = Math.round((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.round(hours / 24)
  return `há ${days} d`
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return dateFormat.format(date)
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return dateTimeFormat.format(date)
}

export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase()
}
