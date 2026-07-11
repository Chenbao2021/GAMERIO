import { useRef, type JSX } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { useDrawRoom } from '../../../context/DrawRoomContext'
import DrawCanvas, { type DrawCanvasHandle } from './DrawCanvas'
import DrawTimer from './DrawTimer'
import './DrawDrawerView.less'

interface Props {
  roomCode: string
}

export default function DrawDrawerView({ roomCode }: Props): JSX.Element {
  const { state, solveRound } = useDrawRoom()
  const canvasRef = useRef<DrawCanvasHandle | null>(null)
  const guessers = state.players.filter((p) => p.id !== state.playerId)

  return (
    <Box className="draw-drawer fade-in">
      <Box className="draw-drawer__header">
        <Typography className="draw-drawer__round">
          Manche {state.round}/{state.totalRounds}
        </Typography>
        <DrawTimer deadline={state.roundDeadline} />
      </Box>

      {state.privateWord && (
        <Box className="draw-drawer__word-card">
          <Typography variant="h3" className="draw-drawer__word">
            {state.privateWord}
          </Typography>
        </Box>
      )}

      <Typography className="draw-drawer__hint">
        Dessine ce mot, les autres devinent à voix haute ou en tapant leur réponse.
      </Typography>

      <DrawCanvas ref={canvasRef} roomCode={roomCode} interactive />

      <Button variant="outlined" onClick={() => canvasRef.current?.clear()} className="draw-drawer__erase">
        Gommer le dessin
      </Button>

      <Typography className="draw-drawer__prompt">Qui a trouvé ?</Typography>
      <Box className="draw-drawer__grid">
        {guessers.map((p) => (
          <Button
            key={p.id}
            variant="outlined"
            onClick={() => solveRound(roomCode, p.id)}
            className="draw-drawer__option"
          >
            {p.pseudo}
          </Button>
        ))}
      </Box>
      <Button variant="text" onClick={() => solveRound(roomCode, null)} className="draw-drawer__pass">
        Personne n'a trouvé
      </Button>

      {state.error && <Typography className="draw-drawer__error">{state.error}</Typography>}
    </Box>
  )
}
