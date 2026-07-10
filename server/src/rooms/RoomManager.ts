import { customAlphabet } from 'nanoid'

// Excludes visually ambiguous characters (0/O, 1/I) so codes are easy to read aloud/type on a phone.
const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const ROOM_CODE_LENGTH = 4
const generateCode = customAlphabet(ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH)

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 8

export interface Player {
  id: string
  pseudo: string
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

  createRoom(hostId: string, pseudo: string): Room<TGameState> {
    const room: Room<TGameState> = {
      code: this.uniqueCode(),
      hostId,
      players: [{ id: hostId, pseudo }],
      status: 'lobby',
      gameState: this.createInitialGameState(),
    }
    this.rooms.set(room.code, room)
    return room
  }

  joinRoom(code: string, playerId: string, pseudo: string): JoinResult<TGameState> {
    const room = this.rooms.get(code)
    if (!room) return { error: 'Partie introuvable.' }
    if (room.status !== 'lobby') return { error: 'La partie a déjà commencé.' }
    if (room.players.length >= MAX_PLAYERS) return { error: 'La partie est complète.' }
    room.players.push({ id: playerId, pseudo })
    return room
  }

  getRoom(code: string): Room<TGameState> | undefined {
    return this.rooms.get(code)
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
