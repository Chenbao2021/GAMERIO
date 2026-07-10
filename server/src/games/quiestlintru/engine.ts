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
 * True only if the intruder has strictly the most votes — a tie for first place means
 * the intruder blended in well enough and wins outright (no guess phase).
 */
export function didVoteOutCorrectly(tally: Record<string, number>, intruderId: string): boolean {
  const intruderVotes = tally[intruderId] ?? 0
  if (intruderVotes === 0) return false
  const maxVotes = Math.max(...Object.values(tally))
  const playersAtMax = Object.values(tally).filter((v) => v === maxVotes).length
  return intruderVotes === maxVotes && playersAtMax === 1
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
