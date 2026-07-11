import { useState, type JSX } from 'react'
import { Box, Typography, Button, Slider, Chip } from '@mui/material'
import { useDrawRoom } from '../../../context/DrawRoomContext'
import './DrawRoom.less'

interface Props {
  roomCode: string
  onLeave: () => void
}

export default function DrawRoom({ roomCode, onLeave }: Props): JSX.Element {
  const { state, configure, start } = useDrawRoom()
  const [copied, setCopied] = useState(false)
  const [starting, setStarting] = useState(false)

  async function handleCopy(): Promise<void> {
    const link = `${window.location.origin}/dessine/${roomCode}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — the code stays visible to copy by hand.
    }
  }

  async function handleStart(): Promise<void> {
    setStarting(true)
    await start(roomCode)
    setStarting(false)
  }

  return (
    <Box className="draw-room fade-in">
      <Typography variant="h4" className="draw-room__code">
        Code : {roomCode}
      </Typography>
      <Button variant="outlined" onClick={handleCopy} className="draw-room__copy">
        {copied ? 'Lien copié !' : 'Copier le lien'}
      </Button>

      <Box className="draw-room__players">
        {state.players.map((p) => (
          <Chip
            key={p.id}
            label={p.isHost ? `${p.pseudo} (hôte)` : p.pseudo}
            className="draw-room__player-chip"
          />
        ))}
      </Box>

      {state.isHost ? (
        <Box className="draw-room__settings">
          <Typography>Chacun dessine {state.totalRounds} fois</Typography>
          <Slider
            value={state.totalRounds}
            onChange={(_, value) => configure(roomCode, value as number)}
            step={1}
            marks
            min={1}
            max={3}
          />

          <Button
            fullWidth
            variant="contained"
            disabled={state.players.length < 2 || starting}
            onClick={handleStart}
            className="draw-room__start"
          >
            {starting ? 'Démarrage...' : 'Démarrer la partie'}
          </Button>
          {state.players.length < 2 && (
            <Typography className="draw-room__hint">Il faut au moins 2 joueurs.</Typography>
          )}
        </Box>
      ) : (
        <Typography className="draw-room__waiting">En attente que l'hôte démarre la partie...</Typography>
      )}

      {state.error && <Typography className="draw-room__error">{state.error}</Typography>}

      <Button variant="text" onClick={onLeave} className="draw-room__leave">
        Quitter
      </Button>
    </Box>
  )
}
