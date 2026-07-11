import { Player } from '../../rooms/RoomManager'
import { wordBank } from './wordBank'

export function buildTurnOrder(players: Player[]): string[] {
  const ids = players.map((p) => p.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
  }
  return ids
}

// Picks a word not already drawn this game, falling back to any word once the bank runs dry
// (unlikely in practice — the bank is much bigger than totalRounds * players ever gets).
export function pickWord(usedWords: string[]): string {
  const remaining = wordBank.filter((w) => !usedWords.includes(w))
  const pool = remaining.length > 0 ? remaining : wordBank
  return pool[Math.floor(Math.random() * pool.length)]
}

// Strips the combining diacritical marks left behind by NFD normalization,
// e.g. turns the NFD decomposition of "e-acute" back into plain "e".
const DIACRITIC = new RegExp('\\p{Diacritic}', 'gu')

export function normalize(word: string): string {
  return word.trim().toLowerCase().normalize('NFD').replace(DIACRITIC, '')
}

export function checkGuess(guess: string, word: string): boolean {
  return normalize(guess) === normalize(word)
}
