import { useState, type JSX } from 'react'
import { Box, Typography, Button, TextField } from '@mui/material'
import { useIntruRoom } from '../../../context/IntruRoomContext'
import IntruWordCustomizer from './IntruWordCustomizer'
import type { CustomWords } from './types'
import './IntruReveal.less'

interface Props {
  roomCode: string
  onLeave: () => void
}

export default function IntruReveal({ roomCode, onLeave }: Props): JSX.Element {
  const { state, submitGuess, playAgain } = useIntruRoom()
  const [guess, setGuess] = useState('')
  const [guessSubmitted, setGuessSubmitted] = useState(false)
  const [replaying, setReplaying] = useState(false)
  const [customWords, setCustomWords] = useState<CustomWords | null>(null)

  const intruder = state.players.find((p) => p.id === state.reveal?.intruderId)
  const isIntruder = state.playerId === state.reveal?.intruderId
  const resultClass = `intru-reveal__result intru-reveal__result--${state.result?.winner === 'civils' ? 'green' : 'orange'}`

  function handleGuess(): void {
    if (!guess.trim()) return
    submitGuess(roomCode, guess.trim())
    setGuessSubmitted(true)
  }

  async function handlePlayAgain(): Promise<void> {
    setReplaying(true)
    await playAgain(roomCode, customWords ?? undefined)
    setReplaying(false)
    setGuess('')
    setGuessSubmitted(false)
    setCustomWords(null)
  }

  return (
    <Box className="intru-reveal fade-in">
      {state.reveal && (
        <Box className="intru-reveal__card">
          <Typography variant="h4">L'intrus était : {intruder?.pseudo ?? '?'}</Typography>
          <Typography>
            Mot majoritaire : <strong>{state.reveal.majorityWord}</strong>
          </Typography>
          <Typography>
            Mot de l'intrus : <strong>{state.reveal.intruderWord}</strong>
          </Typography>
          <Typography className="intru-reveal__vote-result">
            {state.reveal.votedOutCorrectly
              ? "L'intrus a été démasqué par le vote !"
              : "Le groupe ne l'a pas identifié clairement."}
          </Typography>
        </Box>
      )}

      {state.phase === 'guessing' &&
        (isIntruder ? (
          <Box className="intru-reveal__guess">
            <Typography>Dernière chance : devine le mot majoritaire !</Typography>
            <TextField
              fullWidth
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              disabled={guessSubmitted}
              className="intru-reveal__guess-field"
            />
            <Button fullWidth variant="contained" onClick={handleGuess} disabled={guessSubmitted}>
              {guessSubmitted ? 'Réponse envoyée...' : 'Valider'}
            </Button>
          </Box>
        ) : (
          <Typography className="intru-reveal__waiting">En attente de la tentative de l'intrus...</Typography>
        ))}

      {state.phase === 'result' && state.result && (
        <Box className={resultClass}>
          <Typography variant="h3">{state.result.winner === 'civils' ? 'Les civils gagnent !' : "L'intrus gagne !"}</Typography>
          {state.result.guessedWord && <Typography>Réponse de l'intrus : "{state.result.guessedWord}"</Typography>}

          <Box className="intru-reveal__wins">
            {state.players.map((p) => (
              <Typography key={p.id} className="intru-reveal__win-row">
                {p.pseudo} : {state.result?.wins[p.id] ?? 0} victoire(s)
              </Typography>
            ))}
          </Box>

          <Box className="intru-reveal__actions">
            {state.isHost && <IntruWordCustomizer onChange={setCustomWords} />}
            {state.isHost && customWords && state.players.length > 2 && (
              <Typography className="intru-reveal__hint">
                Tu ne joueras pas cette manche : tu connais déjà les mots.
                {state.players.length === 3 && ' Les 2 autres joueurs feront un duel, sans vote.'}
              </Typography>
            )}
            {state.isHost && (
              <Button fullWidth variant="contained" onClick={handlePlayAgain} disabled={replaying}>
                {replaying ? 'Nouvelle manche...' : 'Rejouer'}
              </Button>
            )}
            <Button fullWidth variant="text" onClick={onLeave}>
              Quitter
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  )
}
