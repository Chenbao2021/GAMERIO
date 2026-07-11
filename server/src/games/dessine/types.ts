export type Phase = 'lobby' | 'drawing' | 'roundResult' | 'result'

export interface RoundResult {
  word: string
  drawerId: string
  solvedById: string | null // null = nobody found it (passed or timed out)
}

export interface GameState {
  phase: Phase
  usedWords: string[] // avoids repeating a word within the same game
  word: string | null
  turnOrder: string[]
  currentDrawerIndex: number
  round: number // which pass we're on — each pass has every player draw once
  totalRounds: number // how many passes, configured by the host (1-3)
  roundDeadline: number | null // epoch ms, so clients can render a synced countdown
  lastRoundResult: RoundResult | null
  wins: Record<string, number> // playerId -> points, persists across playAgain within the room
}

export function createInitialGameState(): GameState {
  return {
    phase: 'lobby',
    usedWords: [],
    word: null,
    turnOrder: [],
    currentDrawerIndex: 0,
    round: 1,
    totalRounds: 1,
    roundDeadline: null,
    lastRoundResult: null,
    wins: {},
  }
}
