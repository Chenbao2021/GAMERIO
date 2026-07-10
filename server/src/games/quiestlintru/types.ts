export type Phase = 'lobby' | 'clues' | 'voting' | 'duel' | 'reveal' | 'guessing' | 'result'

export interface WordPair {
  category: string
  majority: string
  intruder: string
}

export interface ClueEntry {
  playerId: string
  text: string
}

export interface GameState {
  phase: Phase
  wordPair: WordPair | null
  intruderId: string
  turnOrder: string[]
  currentTurnIndex: number
  round: number
  totalRounds: number
  clues: ClueEntry[] // optional written recap of the clues given aloud this manche, oldest first
  votes: Record<string, string> // voterId -> targetPlayerId
  passed: string[] // voterIds who chose not to vote for anyone
  voteTally: Record<string, number>
  eliminated: string[] // playerIds wrongly voted out in an earlier round of this manche, they now spectate
  duelGuesses: Record<string, boolean> // playerId -> self-reported "did I guess the other's word?" (oral, 2-player mode only)
  votedOutCorrectly: boolean
  wins: Record<string, number> // playerId -> win count, persists across playAgain within the room
  spectatorId: string | null // host sitting out this round because they picked the words themselves
}

export function createInitialGameState(): GameState {
  return {
    phase: 'lobby',
    wordPair: null,
    intruderId: '',
    turnOrder: [],
    currentTurnIndex: 0,
    round: 0,
    totalRounds: 1,
    clues: [],
    votes: {},
    passed: [],
    voteTally: {},
    eliminated: [],
    duelGuesses: {},
    votedOutCorrectly: false,
    wins: {},
    spectatorId: null,
  }
}
