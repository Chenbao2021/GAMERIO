export type Phase = 'lobby' | 'drawing' | 'roundResult' | 'result'

export interface PlayerInfo {
  id: string
  pseudo: string
  isHost: boolean
}

export interface PhasePayload {
  phase: Phase
  drawerId?: string
  turnOrder?: string[]
  round?: number
  totalRounds?: number
  roundDeadline?: number | null
}

export interface PrivateWord {
  word: string
}

export interface RoundResultInfo {
  word: string
  drawerId: string
  solvedById: string | null
  wins: Record<string, number>
}

export interface GameResultInfo {
  wins: Record<string, number>
}

export interface AckError {
  error?: string
}

export interface DrawRoomState {
  roomCode: string | null
  playerId: string | null
  isHost: boolean
  players: PlayerInfo[]
  phase: Phase
  totalRounds: number
  round: number
  turnOrder: string[]
  drawerId: string | null
  roundDeadline: number | null
  privateWord: string | null
  lastRoundResult: RoundResultInfo | null
  wins: Record<string, number>
  interrupted: boolean
  error: string | null
}

export const initialDrawRoomState: DrawRoomState = {
  roomCode: null,
  playerId: null,
  isHost: false,
  players: [],
  phase: 'lobby',
  totalRounds: 1,
  round: 1,
  turnOrder: [],
  drawerId: null,
  roundDeadline: null,
  privateWord: null,
  lastRoundResult: null,
  wins: {},
  interrupted: false,
  error: null,
}
