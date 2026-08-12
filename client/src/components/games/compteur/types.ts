export type CompteurMode = 'host' | 'selfEntry'

export interface CompteurPlayerInfo {
  id: string
  pseudo: string
  isHost: boolean
}

export interface CompteurRoundRecord {
  id: string
  savedAt: number
  scores: Record<string, number>
  playerNames: Record<string, string>
}

export interface CompteurRoomState {
  roomCode: string | null
  playerId: string | null
  isHost: boolean
  mode: CompteurMode
  players: CompteurPlayerInfo[]
  scores: Record<string, number>
  rounds: CompteurRoundRecord[]
  stepSize: number
  error: string | null
  notice: string | null
}

export const initialCompteurRoomState: CompteurRoomState = {
  roomCode: null,
  playerId: null,
  isHost: false,
  mode: 'host',
  players: [],
  scores: {},
  rounds: [],
  stepSize: 1,
  error: null,
  notice: null,
}

export interface AckError {
  error?: string
}
