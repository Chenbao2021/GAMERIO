import { useState, type JSX } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Container, TextField, Button, Typography, Divider } from '@mui/material'
import { useDrawRoom } from '../../../context/DrawRoomContext'
import './DrawLobby.less'

export default function DrawLobby(): JSX.Element {
  const navigate = useNavigate()
  const { createRoom, joinRoom, state } = useDrawRoom()
  const [pseudo, setPseudo] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState<'create' | 'join' | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  async function handleCreate(): Promise<void> {
    if (!pseudo.trim()) {
      setLocalError('Choisis un pseudo.')
      return
    }
    setLocalError(null)
    setLoading('create')
    const res = await createRoom(pseudo.trim())
    setLoading(null)
    if (res.roomCode) navigate(`/dessine/${res.roomCode}`)
    else setLocalError(res.error ?? 'Erreur inconnue.')
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
    if (!res.error) navigate(`/dessine/${code}`)
    else setLocalError(res.error ?? 'Erreur inconnue.')
  }

  return (
    <Box component="section" className="app-page draw-lobby fade-in">
      <Container maxWidth="xs">
        <Typography variant="h3" className="draw-lobby__title">
          Dessine-moi un mot
        </Typography>
        <Typography className="draw-lobby__subtitle">
          2 à 8 joueurs, un dessinateur par manche, les autres devinent à voix haute.
        </Typography>

        <TextField
          fullWidth
          label="Ton pseudo"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          inputProps={{ maxLength: 20 }}
          className="draw-lobby__field"
        />

        {(localError ?? state.error) && (
          <Typography className="draw-lobby__error">{localError ?? state.error}</Typography>
        )}

        <Button
          fullWidth
          variant="contained"
          onClick={handleCreate}
          disabled={loading !== null}
          className="draw-lobby__cta"
        >
          {loading === 'create' ? 'Création...' : 'Créer une partie'}
        </Button>

        <Divider className="draw-lobby__divider">ou</Divider>

        <Box className="draw-lobby__join">
          <TextField
            fullWidth
            label="Code de partie"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            inputProps={{ maxLength: 4, style: { textTransform: 'uppercase' } }}
            className="draw-lobby__field"
          />
          <Button
            fullWidth
            variant="outlined"
            onClick={handleJoin}
            disabled={loading !== null}
            className="draw-lobby__cta"
          >
            {loading === 'join' ? 'Connexion...' : 'Rejoindre'}
          </Button>
        </Box>
      </Container>
    </Box>
  )
}
