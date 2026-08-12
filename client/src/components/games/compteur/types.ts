export type CompteurMode = 'host' | 'selfEntry'

export interface CompteurPlayerInfo {
  id: string
  pseudo: string
  isHost: boolean
}

export interface CompteurRoomState {
  roomCode: string | null
  playerId: string | null
  isHost: boolean
  mode: CompteurMode
  players: CompteurPlayerInfo[]
  scores: Record<string, number>
  error: string | null
}

export const initialCompteurRoomState: CompteurRoomState = {
  roomCode: null,
  playerId: null,
  isHost: false,
  mode: 'host',
  players: [],
  scores: {},
  error: null,
}

export interface AckError {
  error?: string
}
