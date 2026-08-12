export function sanitizePlayerName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim().slice(0, 20) : ''
  return name || 'Joueur'
}

export function sanitizeDelta(raw: unknown): number {
  const delta = Number(raw)
  if (!Number.isFinite(delta)) return 0
  return Math.round(delta)
}
