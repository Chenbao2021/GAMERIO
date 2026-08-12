export type CompteurMode = 'host' | 'selfEntry'

export interface CompteurScoreHistoryEntry {
  actorId: string
  targetPlayerId: string
  delta: number
}

export interface CompteurRoundRecord {
  id: string
  savedAt: number
  scores: Record<string, number> // playerId -> score for that round
  playerNames: Record<string, string> // playerId -> pseudo snapshot at save time
}

export interface CompteurGameState {
  mode: CompteurMode
  scores: Record<string, number> // playerId -> score, real or host-added virtual player
  history: CompteurScoreHistoryEntry[] // undo stack, cleared when a round is saved
  rounds: CompteurRoundRecord[]
}

export type GameState = CompteurGameState

export function createInitialGameState(mode: CompteurMode = 'host'): CompteurGameState {
  return { mode, scores: {}, history: [], rounds: [] }
}
