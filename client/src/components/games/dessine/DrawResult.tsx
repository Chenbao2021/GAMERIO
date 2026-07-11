import { useState, type JSX } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { useDrawRoom } from '../../../context/DrawRoomContext'
import './DrawResult.less'

interface Props {
  roomCode: string
  onLeave: () => void
}

export default function DrawResult({ roomCode, onLeave }: Props): JSX.Element {
  const { state, playAgain } = useDrawRoom()
  const [replaying, setReplaying] = useState(false)

  const ranked = [...state.players].sort((a, b) => (state.wins[b.id] ?? 0) - (state.wins[a.id] ?? 0))

  async function handlePlayAgain(): Promise<void> {
    setReplaying(true)
    await playAgain(roomCode)
    setReplaying(false)
  }

  return (
    <Box className="draw-result fade-in">
      <Typography variant="h3" className="draw-result__title">
        Partie terminée !
      </Typography>

      <Box className="draw-result__scores">
        {ranked.map((p) => (
          <Typography key={p.id} className="draw-result__score-row">
            {p.pseudo} : {state.wins[p.id] ?? 0} point(s)
          </Typography>
        ))}
      </Box>

      <Box className="draw-result__actions">
        {state.isHost && (
          <Button fullWidth variant="contained" onClick={handlePlayAgain} disabled={replaying}>
            {replaying ? 'Nouvelle partie...' : 'Rejouer'}
          </Button>
        )}
        <Button fullWidth variant="text" onClick={onLeave}>
          Quitter
        </Button>
      </Box>
    </Box>
  )
}
