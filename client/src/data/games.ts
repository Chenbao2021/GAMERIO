export type GameStatus = 'available' | 'coming-soon'
export type ColorKey = 'yellow' | 'blue' | 'green' | 'pink' | 'orange' | 'purple'

export interface GameMeta {
  key: string
  name: string
  description: string
  emoji: string
  colorKey: ColorKey
  path: string
  status: GameStatus
}

export const games: GameMeta[] = [
  {
    key: 'qui-est-lintru',
    name: "Qui est l'intru ?",
    description:
      "3 à 8 joueurs, un mot secret partagé... sauf pour un intrus. Indices à l'oral, vote dans l'app.",
    emoji: '🕵️',
    colorKey: 'yellow',
    path: '/intru',
    status: 'available',
  },
]
