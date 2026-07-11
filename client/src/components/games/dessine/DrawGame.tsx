import { useState, type JSX } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Container, TextField, Button, Typography } from '@mui/material'
import { useDrawRoom } from '../../../context/DrawRoomContext'
import DrawRoom from './DrawRoom'
import DrawDrawerView from './DrawDrawerView'
import DrawGuesserView from './DrawGuesserView'
import DrawRoundResult from './DrawRoundResult'
import DrawResult from './DrawResult'
import './DrawGame.less'

export default function DrawGame(): JSX.Element {
  const { roomCode: rawRoomCode = '' } = useParams<{ roomCode: string }>()
  const roomCode = rawRoomCode.toUpperCase()
  const navigate = useNavigate()
  const { state, joinRoom, leaveRoom } = useDrawRoom()
  const [pseudo, setPseudo] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const alreadyInRoom = state.roomCode === roomCode
  const isDrawer = state.drawerId !== null && state.drawerId === state.playerId

  function handleLeave(): void {
    leaveRoom(roomCode)
    navigate('/dessine')
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
      <Box component="section" className="app-page draw-join-gate fade-in">
        <Container maxWidth="xs">
          <Typography variant="h4" className="draw-join-gate__title">
            Rejoindre la partie {roomCode}
          </Typography>
          <TextField
            fullWidth
            label="Ton pseudo"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            inputProps={{ maxLength: 20 }}
            className="draw-join-gate__field"
          />
          {joinError && <Typography className="draw-join-gate__error">{joinError}</Typography>}
          <Button fullWidth variant="contained" onClick={handleJoin} disabled={joining}>
            {joining ? 'Connexion...' : 'Rejoindre'}
          </Button>
        </Container>
      </Box>
    )
  }

  return (
    <Box component="section" className="app-page draw-game">
      <Container maxWidth="sm">
        {state.interrupted && (
          <Typography className="draw-game__interrupted">
            Un joueur est parti, la partie a été interrompue.
          </Typography>
        )}
        {state.phase === 'lobby' && <DrawRoom roomCode={roomCode} onLeave={handleLeave} />}
        {state.phase === 'drawing' &&
          (isDrawer ? <DrawDrawerView roomCode={roomCode} /> : <DrawGuesserView roomCode={roomCode} />)}
        {state.phase === 'roundResult' && <DrawRoundResult roomCode={roomCode} />}
        {state.phase === 'result' && <DrawResult roomCode={roomCode} onLeave={handleLeave} />}
      </Container>
    </Box>
  )
}
