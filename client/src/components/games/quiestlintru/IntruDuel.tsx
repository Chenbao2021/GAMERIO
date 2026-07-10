import { type JSX } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { useIntruRoom } from '../../../context/IntruRoomContext'
import './IntruDuel.less'

interface Props {
  roomCode: string
}

export default function IntruDuel({ roomCode }: Props): JSX.Element {
  const { state, castDuelGuess } = useIntruRoom()

  return (
    <Box className="intru-duel fade-in">
      <Typography variant="h4" className="intru-duel__title">
        Discutez à voix haute
      </Typography>
      <Typography className="intru-duel__subtitle">As-tu deviné le mot de l'autre joueur ?</Typography>
      <Typography className="intru-duel__count">
        {state.duelUpdate ? `${state.duelUpdate.guessesCount}/${state.duelUpdate.totalPlayers} ont répondu` : ''}
      </Typography>

      <Box className="intru-duel__actions">
        <Button
          fullWidth
          variant="contained"
          disabled={state.hasDuelGuessed}
          onClick={() => castDuelGuess(roomCode, true)}
          className="intru-duel__yes"
        >
          Oui, j'ai trouvé
        </Button>
        <Button
          fullWidth
          variant="outlined"
          disabled={state.hasDuelGuessed}
          onClick={() => castDuelGuess(roomCode, false)}
          className="intru-duel__no"
        >
          Non, je n'ai pas trouvé
        </Button>
      </Box>

      {state.hasDuelGuessed && (
        <Typography className="intru-duel__waiting">Réponse enregistrée, en attente de l'autre joueur...</Typography>
      )}
      {state.error && <Typography className="intru-duel__error">{state.error}</Typography>}
    </Box>
  )
}
