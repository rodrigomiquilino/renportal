/**
 * Mesma fórmula de `recalculate_level` no Postgres:
 * level = max(1, floor(sqrt(xp / 40)) + 1)
 * XP para alcançar o nível L: 40 * (L - 1)^2
 */
export function levelProgress(xp: number) {
  const safe = Number.isFinite(xp) ? Math.max(0, xp) : 0
  const level = Math.max(1, Math.floor(Math.sqrt(safe / 40)) + 1)
  const currentFloor = 40 * (level - 1) ** 2
  const nextFloor = 40 * level ** 2
  const span = nextFloor - currentFloor
  const into = safe - currentFloor
  const ratio = span === 0 ? 0 : Math.min(1, Math.max(0, into / span))
  return { level, currentFloor, nextFloor, span, into, ratio }
}
