import { useEffect, useRef, useState, type JSX } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Container,
  TextField,
  Button,
  Typography,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogActions,
} from '@mui/material'
import { useCompteurRoom } from '../../../context/CompteurRoomContext'
import type { CompteurPlayerInfo } from './types'
import './CompteurGame.less'

export default function CompteurGame(): JSX.Element {
  const { roomCode: rawRoomCode = '' } = useParams<{ roomCode: string }>()
  const roomCode = rawRoomCode.toUpperCase()
  const navigate = useNavigate()
  const { state, joinRoom, addPlayer, addPoints, resetScores, removePlayer, leaveRoom } = useCompteurRoom()

  const [pseudo, setPseudo] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [playerToRemove, setPlayerToRemove] = useState<CompteurPlayerInfo | null>(null)

  const alreadyInRoom = state.roomCode === roomCode
  const wasInRoom = useRef(false)

  useEffect(() => {
    if (alreadyInRoom) wasInRoom.current = true
    else if (wasInRoom.current) {
      wasInRoom.current = false
      navigate('/compteur')
    }
  }, [alreadyInRoom, navigate])

  function handleLeave(): void {
    leaveRoom(roomCode)
    navigate('/compteur')
  }

  async function handleCopy(): Promise<void> {
    const link = `${window.location.origin}/compteur/${roomCode}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — the code stays visible to copy by hand.
    }
  }

  async function handleAddPlayer(): Promise<void> {
    if (!newPlayerName.trim()) return
    await addPlayer(roomCode, newPlayerName.trim())
    setNewPlayerName('')
  }

  function handleStep(targetPlayerId: string, delta: number): void {
    addPoints(roomCode, targetPlayerId, delta)
  }

  function handleAddAmount(targetPlayerId: string): void {
    const raw = amounts[targetPlayerId]
    const delta = Number(raw)
    if (!raw || !Number.isFinite(delta) || delta === 0) return
    addPoints(roomCode, targetPlayerId, delta)
    setAmounts((a) => ({ ...a, [targetPlayerId]: '' }))
  }

  function handleConfirmRemove(): void {
    if (!playerToRemove) return
    removePlayer(roomCode, playerToRemove.id)
    setPlayerToRemove(null)
  }

  if (!alreadyInRoom) {
    async function handleJoin(): Promise<void> {
      if (!pseudo.trim()) {
        setJoinError('Choisis un pseudo.')
        return
      }
      setJoinError(null)
      setJoining(true)
      const res = await joinRoom(roomCode, pseudo.trim())
      setJoining(false)
      if (res.error) setJoinError(res.error)
    }

    return (
      <Box component="section" className="app-page compteur-join-gate fade-in">
        <Container maxWidth="xs">
          <Typography variant="h4" className="compteur-join-gate__title">
            Rejoindre la partie {roomCode}
          </Typography>
          <TextField
            fullWidth
            label="Ton pseudo"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            inputProps={{ maxLength: 20 }}
            className="compteur-join-gate__field"
          />
          {joinError && <Typography className="compteur-join-gate__error">{joinError}</Typography>}
          <Button fullWidth variant="contained" onClick={handleJoin} disabled={joining}>
            {joining ? 'Connexion...' : 'Rejoindre'}
          </Button>
        </Container>
      </Box>
    )
  }

  const ranked = [...state.players].sort((a, b) => (state.scores[b.id] ?? 0) - (state.scores[a.id] ?? 0))

  return (
    <Box component="section" className="app-page compteur-game fade-in">
      <Container maxWidth="sm">
        <Typography variant="h4" className="compteur-game__code">
          Code : {roomCode}
        </Typography>
        <Box className="compteur-game__header">
          <Button variant="outlined" onClick={handleCopy} className="compteur-game__copy">
            {copied ? 'Lien copié !' : 'Copier le lien'}
          </Button>
          <Chip
            label={state.mode === 'host' ? 'Mode animateur' : 'Mode temps réel'}
            className="compteur-game__mode-chip"
          />
        </Box>

        <Box className="compteur-game__scoreboard">
          {ranked.map((p) => {
            const score = state.scores[p.id] ?? 0
            const canEdit = state.isHost || (state.mode === 'selfEntry' && p.id === state.playerId)
            return (
              <Box key={p.id} className="compteur-game__row">
                <Box className="compteur-game__row-main">
                  <Box className="compteur-game__row-name-group">
                    <Typography className="compteur-game__row-name">
                      {p.isHost ? `${p.pseudo} (hôte)` : p.pseudo}
                    </Typography>
                    {state.isHost && p.id !== state.playerId && (
                      <IconButton
                        size="small"
                        aria-label={`Retirer ${p.pseudo}`}
                        className="compteur-game__row-remove"
                        onClick={() => setPlayerToRemove(p)}
                      >
                        ✕
                      </IconButton>
                    )}
                  </Box>
                  <Typography className="compteur-game__row-score">{score}</Typography>
                </Box>

                {canEdit && (
                  <Box className="compteur-game__row-controls">
                    <Button size="small" variant="outlined" onClick={() => handleStep(p.id, -1)}>
                      −1
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => handleStep(p.id, 1)}>
                      +1
                    </Button>
                    <TextField
                      size="small"
                      type="number"
                      placeholder="Points"
                      value={amounts[p.id] ?? ''}
                      onChange={(e) => setAmounts((a) => ({ ...a, [p.id]: e.target.value }))}
                      className="compteur-game__row-amount"
                    />
                    <Button size="small" variant="contained" onClick={() => handleAddAmount(p.id)}>
                      Ajouter
                    </Button>
                  </Box>
                )}
              </Box>
            )
          })}
          {ranked.length === 0 && <Typography className="compteur-game__empty">Aucun joueur pour l'instant.</Typography>}
        </Box>

        {state.isHost && (
          <Box className="compteur-game__host-tools">
            <Box className="compteur-game__add-player">
              <TextField
                size="small"
                fullWidth
                label="Nom du joueur"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                inputProps={{ maxLength: 20 }}
              />
              <IconButton
                aria-label="Ajouter le joueur"
                className="compteur-game__add-player-btn"
                onClick={handleAddPlayer}
              >
                +
              </IconButton>
            </Box>
          </Box>
        )}

        {state.notice && <Typography className="compteur-game__notice">{state.notice}</Typography>}
        {state.error && <Typography className="compteur-game__error">{state.error}</Typography>}

        <Box className="compteur-game__bottom-actions">
          {state.isHost && (
            <Button variant="text" onClick={() => resetScores(roomCode)} className="compteur-game__reset">
              Réinitialiser les scores
            </Button>
          )}
          <Button variant="text" onClick={handleLeave} className="compteur-game__leave">
            Quitter
          </Button>
        </Box>
      </Container>

      <Dialog open={playerToRemove !== null} onClose={() => setPlayerToRemove(null)}>
        <DialogTitle>Retirer {playerToRemove?.pseudo} de la partie ?</DialogTitle>
        <DialogActions>
          <Button onClick={() => setPlayerToRemove(null)}>Annuler</Button>
          <Button color="error" onClick={handleConfirmRemove}>
            Retirer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
