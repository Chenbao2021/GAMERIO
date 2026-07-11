import { type JSX } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { useDrawRoom } from '../../../context/DrawRoomContext'
import './DrawRoundResult.less'

interface Props {
  roomCode: string
}

export default function DrawRoundResult({ roomCode }: Props): JSX.Element {
  const { state, nextRound } = useDrawRoom()
  const result = state.lastRoundResult
  const solver = state.players.find((p) => p.id === result?.solvedById)
  const drawer = state.players.find((p) => p.id === result?.drawerId)
  const isDrawer = result?.drawerId === state.playerId

  return (
    <Box className="draw-round-result fade-in">
      {result && (
        <Box className="draw-round-result__card">
          <Typography variant="h4">Le mot était : {result.word}</Typography>
          <Typography className="draw-round-result__outcome">
            {solver ? `${solver.pseudo} a trouvé !` : "Personne n'a trouvé à temps."}
          </Typography>
        </Box>
      )}

      {isDrawer ? (
        <Button
          fullWidth
          variant="contained"
          onClick={() => nextRound(roomCode)}
          className="draw-round-result__next"
        >
          Manche suivante →
        </Button>
      ) : (
        <Typography className="draw-round-result__waiting">
          En attente que {drawer?.pseudo ?? 'le dessinateur'} continue...
        </Typography>
      )}

      {state.error && <Typography className="draw-round-result__error">{state.error}</Typography>}
    </Box>
  )
}
