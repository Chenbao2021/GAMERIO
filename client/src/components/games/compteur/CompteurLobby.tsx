import { useState, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Container, TextField, Button, Typography, Divider, ToggleButtonGroup, ToggleButton } from '@mui/material'
import { useCompteurRoom } from '../../../context/CompteurRoomContext'
import type { CompteurMode } from './types'
import './CompteurLobby.less'

export default function CompteurLobby(): JSX.Element {
  const navigate = useNavigate()
  const { createRoom, joinRoom, setStepSize, state } = useCompteurRoom()
  const [pseudo, setPseudo] = useState('')
  const [mode, setMode] = useState<CompteurMode>('host')
  const [roomCode, setRoomCode] = useState('')
  const [stepSize, setLocalStepSize] = useState(1)
  const [loading, setLoading] = useState<'create' | 'join' | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  async function handleCreate(): Promise<void> {
    if (!pseudo.trim()) {
      setLocalError('Choisis un pseudo.')
      return
    }
    setLocalError(null)
    setLoading('create')
    const res = await createRoom(pseudo.trim(), mode)
    setLoading(null)
    if (res.roomCode) {
      setStepSize(stepSize)
      navigate(`/compteur/${res.roomCode}`)
    } else setLocalError(res.error ?? 'Erreur inconnue.')
  }

  async function handleJoin(): Promise<void> {
    if (!pseudo.trim()) {
      setLocalError('Choisis un pseudo.')
      return
    }
    if (!roomCode.trim()) {
      setLocalError('Entre un code de partie.')
      return
    }
    setLocalError(null)
    setLoading('join')
    const code = roomCode.trim().toUpperCase()
    const res = await joinRoom(code, pseudo.trim())
    setLoading(null)
    if (!res.error) {
      setStepSize(stepSize)
      navigate(`/compteur/${code}`)
    } else setLocalError(res.error ?? 'Erreur inconnue.')
  }

  return (
    <Box component="section" className="app-page compteur-lobby fade-in">
      <Container maxWidth="xs">
        <Typography variant="h3" className="compteur-lobby__title">
          Compteur de points
        </Typography>
        <Typography className="compteur-lobby__subtitle">
          Ajoute les joueurs et note les scores. En solo à l'animateur, ou en temps réel avec tout le monde.
        </Typography>

        <TextField
          fullWidth
          label="Ton pseudo"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          inputProps={{ maxLength: 20 }}
          className="compteur-lobby__field"
        />

        <Typography className="compteur-lobby__mode-label">Mode de partie</Typography>
        <ToggleButtonGroup
          fullWidth
          exclusive
          value={mode}
          onChange={(_e, value: CompteurMode | null) => value && setMode(value)}
          className="compteur-lobby__mode"
        >
          <ToggleButton value="host">Animateur</ToggleButton>
          <ToggleButton value="selfEntry">Temps réel</ToggleButton>
        </ToggleButtonGroup>
        <Typography className="compteur-lobby__mode-hint">
          {mode === 'host'
            ? "Toi seul ajoutes les joueurs et notes les points."
            : 'Chacun rejoint depuis son appareil et note son propre score.'}
        </Typography>

        <Typography className="compteur-lobby__step-label">Pas des boutons rapides</Typography>
        <ToggleButtonGroup
          fullWidth
          exclusive
          value={stepSize}
          onChange={(_e, value: number | null) => value && setLocalStepSize(value)}
          className="compteur-lobby__step"
        >
          <ToggleButton value={1}>+1</ToggleButton>
          <ToggleButton value={5}>+5</ToggleButton>
          <ToggleButton value={10}>+10</ToggleButton>
        </ToggleButtonGroup>

        {(localError ?? state.error) && (
          <Typography className="compteur-lobby__error">{localError ?? state.error}</Typography>
        )}

        <Button
          fullWidth
          variant="contained"
          onClick={handleCreate}
          disabled={loading !== null}
          className="compteur-lobby__cta"
        >
          {loading === 'create' ? 'Création...' : 'Créer une partie'}
        </Button>

        <Divider className="compteur-lobby__divider">ou</Divider>

        <Box className="compteur-lobby__join">
          <TextField
            fullWidth
            label="Code de partie"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            inputProps={{ maxLength: 4, style: { textTransform: 'uppercase' } }}
            className="compteur-lobby__field"
          />
          <Button
            fullWidth
            variant="outlined"
            onClick={handleJoin}
            disabled={loading !== null}
            className="compteur-lobby__cta"
          >
            {loading === 'join' ? 'Connexion...' : 'Rejoindre'}
          </Button>
        </Box>
      </Container>
    </Box>
  )
}
