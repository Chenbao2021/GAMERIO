export type CompteurMode = 'host' | 'selfEntry'

export interface CompteurGameState {
  mode: CompteurMode
  scores: Record<string, number> // playerId -> score, real or host-added virtual player
}

export type GameState = CompteurGameState

export function createInitialGameState(mode: CompteurMode = 'host'): CompteurGameState {
  return { mode, scores: {} }
}
