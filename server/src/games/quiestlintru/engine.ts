import { Player } from '../../rooms/RoomManager'
import { WordPair } from './types'
import { wordBank } from './wordBank'

export function pickWordPair(): WordPair {
  return wordBank[Math.floor(Math.random() * wordBank.length)]
}

export function assignIntruder(players: Player[]): string {
  return players[Math.floor(Math.random() * players.length)].id
}

export function buildTurnOrder(players: Player[]): string[] {
  const ids = players.map((p) => p.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  return ids
}

export function tallyVotes(votes: Record<string, string>): Record<string, number> {
  const tally: Record<string, number> = {}
  for (const targetId of Object.values(votes)) {
    tally[targetId] = (tally[targetId] ?? 0) + 1
  }
  return tally
}

/**
 * Who gets eliminated by this vote, or null if the vote is inconclusive:
 * - nobody voted for anyone (everybody passed)
 * - a tie for first place (nobody stood out enough to be singled out)
 * - at least as many people passed as voted for the top target (not enough of the
 *   group actually committed to an accusation to justify eliminating someone)
 */
export function resolveElimination(tally: Record<string, number>, passedCount: number): string | null {
  const entries = Object.entries(tally)
  if (entries.length === 0) return null
  const maxVotes = Math.max(...entries.map(([, votes]) => votes))
  if (passedCount >= maxVotes) return null
  const topCandidates = entries.filter(([, votes]) => votes === maxVotes)
  if (topCandidates.length !== 1) return null
  return topCandidates[0][0]
}

// Strips the combining diacritical marks left behind by NFD normalization,
// e.g. turns the NFD decomposition of "e-acute" back into plain "e".
const DIACRITIC = new RegExp('\\p{Diacritic}', 'gu')

export function normalize(word: string): string {
  return word.trim().toLowerCase().normalize('NFD').replace(DIACRITIC, '')
}

export function checkGuess(guess: string, majorityWord: string): boolean {
  return normalize(guess) === normalize(majorityWord)
}
