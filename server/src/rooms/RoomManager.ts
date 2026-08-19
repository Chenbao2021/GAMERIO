import { customAlphabet } from 'nanoid'

// Excludes visually ambiguous characters (0/O, 1/I) so codes are easy to read aloud/type on a phone.
const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const ROOM_CODE_LENGTH = 4
const generateCode = customAlphabet(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH)

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 8

// How long a socket that dropped (mobile app backgrounded, brief network loss, etc.) has to
// reconnect before we treat it as a real "player left". Paired with Socket.IO's connection state
// recovery (see index.ts), a reconnect within this window keeps the same socket.id and Socket.IO
// room membership, so the pending removal below is simply cancelled and the player never notices.
// 2 minutes matches Socket.IO's own connectionStateRecovery default and comfortably covers a
// phone switching apps, taking a call, etc. — but note a player who genuinely quits mid-turn also
// leaves the game "hanging" for the group until this window elapses.
export const RECONNECT_GRACE_MS = 120_000

export interface Player {
  id: string
  pseudo: string
  // Stable per-browser identity (crypto.randomUUID(), stored in localStorage), separate from `id`
  // (the current socket.id). Lets a reconnecting socket reclaim this exact player's spot even when
  // it comes back with a brand-new socket.id — see RoomManager.reclaim(). Host-added virtual
  // players (compteur's "add a player the host controls") have no token: they're never reclaimed.
  token?: string
}

export interface Room<TGameState> {
  code: string
  hostId: string
  players: Player[]
  status: 'lobby' | 'active'
  gameState: TGameState
}

export type JoinResult<TGameState> = Room<TGameState> | { error: string }

/**
 * Generic room/player registry shared by any real-time Gamerio game.
 * Game-specific state lives in `gameState`, created via the factory passed to the constructor.
 */
export class RoomManager<TGameState> {
  private rooms = new Map<string, Room<TGameState>>()

  constructor(private createInitialGameState: () => TGameState) {}

  private uniqueCode(): string {
    let code = generateCode()
    while (this.rooms.has(code)) code = generateCode()
    return code
  }

  createRoom(hostId: string, pseudo: string, token?: string): Room<TGameState> {
    const room: Room<TGameState> = {
      code: this.uniqueCode(),
      hostId,
      players: [{ id: hostId, pseudo, token }],
      status: 'lobby',
      gameState: this.createInitialGameState(),
    }
    this.rooms.set(room.code, room)
    return room
  }

  joinRoom(code: string, playerId: string, pseudo: string, token?: string): JoinResult<TGameState> {
    const room = this.rooms.get(code)
    if (!room) return { error: 'Partie introuvable.' }
    if (room.status !== 'lobby') return { error: 'La partie a déjà commencé.' }
    if (room.players.length >= MAX_PLAYERS) return { error: 'La partie est complète.' }
    room.players.push({ id: playerId, pseudo, token })
    return room
  }

  getRoom(code: string): Room<TGameState> | undefined {
    return this.rooms.get(code)
  }

  /**
   * Reassigns a known player's `id` to a new socket.id, keyed by their stable `token` rather than
   * their old (now-dead) socket.id. Used when a reconnecting client comes back with a brand-new
   * socket.id — e.g. Socket.IO's own connectionStateRecovery lost the race against the mobile
   * app's own reconnect attempt and couldn't restore the original id itself. The caller is
   * responsible for rekeying any game-state fields that reference the old id (scores, turn order,
   * roles, etc.) since RoomManager doesn't know that shape.
   */
  reclaim(code: string, token: string, newId: string): { room: Room<TGameState>; oldId: string } | { error: string } {
    const room = this.rooms.get(code)
    if (!room) return { error: 'Partie introuvable.' }
    const player = token ? room.players.find((p) => p.token === token) : undefined
    if (!player) return { error: 'Joueur introuvable.' }
    const oldId = player.id
    if (oldId !== newId) {
      player.id = newId
      if (room.hostId === oldId) room.hostId = newId
    }
    return { room, oldId }
  }

  /** Removes a player from whichever room they're in (at most one). Deletes the room if it becomes empty. */
  removePlayer(playerId: string): { room: Room<TGameState>; pseudo: string } | null {
    for (const room of this.rooms.values()) {
      const index = room.players.findIndex((p) => p.id === playerId)
      if (index === -1) continue

      const [removed] = room.players.splice(index, 1)
      if (room.players.length === 0) {
        this.rooms.delete(room.code)
      } else if (room.hostId === playerId) {
        room.hostId = room.players[0].id
      }
      return { room, pseudo: removed.pseudo }
    }
    return null
  }
}
