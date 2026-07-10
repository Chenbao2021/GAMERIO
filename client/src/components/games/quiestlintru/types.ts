export type Phase = 'lobby' | 'clues' | 'voting' | 'duel' | 'reveal' | 'guessing' | 'result'

export interface PlayerInfo {
  id: string
  pseudo: string
  isHost: boolean
}

export interface PrivateWord {
  word: string
  category: string
}

export interface ClueEntry {
  playerId: string
  text: string
}

export interface PhasePayload {
  phase: Phase
  turnOrder?: string[]
  currentTurnIndex?: number
  round?: number
  totalRounds?: number
  spectatorId?: string | null
  clues?: ClueEntry[]
}

export interface VoteUpdateInfo {
  votesCastCount: number
  totalPlayers: number
}

export interface DuelUpdateInfo {
  guessesCount: number
  totalPlayers: number
}

export interface CustomWords {
  category: string
  majority: string
  intruder: string
}

export interface RevealInfo {
  intruderId: string
  majorityWord: string
  intruderWord: string
  voteTally: Record<string, number>
  votedOutCorrectly: boolean
}

export interface ResultInfo {
  winner: 'civils' | 'intrus'
  guessedWord?: string
  wins: Record<string, number>
}

export interface AckError {
  error?: string
}

export interface IntruRoomState {
  roomCode: string | null
  playerId: string | null
  isHost: boolean
  players: PlayerInfo[]
  phase: Phase
  totalRounds: number
  turnOrder: string[]
  currentTurnIndex: number
  round: number
  privateWord: PrivateWord | null
  clues: ClueEntry[]
  voteUpdate: VoteUpdateInfo | null
  hasVoted: boolean
  duelUpdate: DuelUpdateInfo | null
  hasDuelGuessed: boolean
  spectatorId: string | null
  reveal: RevealInfo | null
  result: ResultInfo | null
  interrupted: boolean
  error: string | null
}

export const initialIntruRoomState: IntruRoomState = {
  roomCode: null,
  playerId: null,
  isHost: false,
  players: [],
  phase: 'lobby',
  totalRounds: 1,
  turnOrder: [],
  currentTurnIndex: 0,
  round: 0,
  privateWord: null,
  clues: [],
  voteUpdate: null,
  hasVoted: false,
  duelUpdate: null,
  hasDuelGuessed: false,
  spectatorId: null,
  reveal: null,
  result: null,
  interrupted: false,
  error: null,
}
