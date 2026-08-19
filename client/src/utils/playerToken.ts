const STORAGE_KEY = 'gamerio:playerToken'

// Stable per-browser identity, independent of socket.id. Sent on room create/join and used to
// reclaim a player's spot after a reconnect that couldn't preserve the original socket.id (e.g.
// the mobile app backgrounding long enough that Socket.IO's own connection state recovery loses
// the race against the client's reconnect attempt). Survives page reloads since it lives in
// localStorage, not just JS memory.
export function getPlayerToken(): string {
  const existing = localStorage.getItem(STORAGE_KEY)
  if (existing) return existing
  const token = crypto.randomUUID()
  localStorage.setItem(STORAGE_KEY, token)
  return token
}
