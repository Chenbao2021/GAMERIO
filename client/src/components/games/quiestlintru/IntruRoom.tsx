import { useState, type JSX } from 'react'
import { Box, Typography, Button, Slider, Chip } from '@mui/material'
import { useIntruRoom } from '../../../context/IntruRoomContext'
import IntruWordCustomizer from './IntruWordCustomizer'
import type { CustomWords } from './types'
import './IntruRoom.less'

interface Props {
  roomCode: string
  onLeave: () => void
}

export default function IntruRoom({ roomCode, onLeave }: Props): JSX.Element {
  const { state, configure, start } = useIntruRoom()
  const [copied, setCopied] = useState(false)
  const [starting, setStarting] = useState(false)
  const [customWords, setCustomWords] = useState<CustomWords | null>(null)

  async function handleCopy(): Promise<void> {
    const link = `${window.location.origin}/intru/${roomCode}`
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
    await start(roomCode, customWords ?? undefined)
    setStarting(false)
    setCustomWords(null)
  }

  return (
    <Box className="intru-room fade-in">
      <Typography variant="h4" className="intru-room__code">
        Code : {roomCode}
      </Typography>
      <Button variant="outlined" onClick={handleCopy} className="intru-room__copy">
        {copied ? 'Lien copié !' : 'Copier le lien'}
      </Button>

      <Box className="intru-room__players">
        {state.players.map((p) => (
          <Chip
            key={p.id}
            label={p.isHost ? `${p.pseudo} (hôte)` : p.pseudo}
            className="intru-room__player-chip"
          />
        ))}
      </Box>

      {state.isHost ? (
        <Box className="intru-room__settings">
          <Typography>Tours d'indices : {state.totalRounds}</Typography>
          <Slider
            value={state.totalRounds}
            onChange={(_, value) => configure(roomCode, value as number)}
            step={1}
            marks
            min={1}
            max={3}
          />
          <IntruWordCustomizer onChange={setCustomWords} />
          {customWords && state.players.length > 2 && (
            <Typography className="intru-room__hint">
              Tu ne joueras pas cette manche : tu connais déjà les mots.
              {state.players.length === 3 && ' Les 2 autres joueurs feront un duel, sans vote.'}
            </Typography>
          )}

          <Button
            fullWidth
            variant="contained"
            disabled={state.players.length < 2 || starting}
            onClick={handleStart}
            className="intru-room__start"
          >
            {starting ? 'Démarrage...' : 'Démarrer la partie'}
          </Button>
          {state.players.length < 2 && (
            <Typography className="intru-room__hint">Il faut au moins 2 joueurs.</Typography>
          )}
          {state.players.length === 2 && (
            <Typography className="intru-room__hint">À 2 joueurs : pas de vote, chacun devine le mot de l'autre.</Typography>
          )}
        </Box>
      ) : (
        <Typography className="intru-room__waiting">En attente que l'hôte démarre la partie...</Typography>
      )}

      {state.error && <Typography className="intru-room__error">{state.error}</Typography>}

      <Button variant="text" onClick={onLeave} className="intru-room__leave">
        Quitter
      </Button>
    </Box>
  )
}
