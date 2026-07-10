import { useState, type JSX } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Container, TextField, Button, Typography } from '@mui/material'
import { useIntruRoom } from '../../../context/IntruRoomContext'
import IntruRoom from './IntruRoom'
import IntruCluePhase from './IntruCluePhase'
import IntruVoting from './IntruVoting'
import IntruDuel from './IntruDuel'
import IntruJury from './IntruJury'
import IntruReveal from './IntruReveal'
import './IntruGame.less'

export default function IntruGame(): JSX.Element {
  const { roomCode: rawRoomCode = '' } = useParams<{ roomCode: string }>()
  const roomCode = rawRoomCode.toUpperCase()
  const navigate = useNavigate()
  const { state, joinRoom, leaveRoom } = useIntruRoom()
  const [pseudo, setPseudo] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const alreadyInRoom = state.roomCode === roomCode
  const isSpectator =
    (state.spectatorId !== null && state.spectatorId === state.playerId) ||
    (state.playerId !== null && state.eliminated.includes(state.playerId))

  function handleLeave(): void {
    leaveRoom(roomCode)
    navigate('/intru')
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
      <Box component="section" className="app-page intru-join-gate fade-in">
        <Container maxWidth="xs">
          <Typography variant="h4" className="intru-join-gate__title">
            Rejoindre la partie {roomCode}
          </Typography>
          <TextField
            fullWidth
            label="Ton pseudo"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            inputProps={{ maxLength: 20 }}
            className="intru-join-gate__field"
          />
          {joinError && <Typography className="intru-join-gate__error">{joinError}</Typography>}
          <Button fullWidth variant="contained" onClick={handleJoin} disabled={joining}>
            {joining ? 'Connexion...' : 'Rejoindre'}
          </Button>
        </Container>
      </Box>
    )
  }

  return (
    <Box component="section" className="app-page intru-game">
      <Container maxWidth="sm">
        {state.interrupted && (
          <Typography className="intru-game__interrupted">
            Un joueur est parti, la manche a été interrompue.
          </Typography>
        )}
        {state.phase === 'lobby' && <IntruRoom roomCode={roomCode} onLeave={handleLeave} />}
        {state.phase === 'clues' && (isSpectator ? <IntruJury /> : <IntruCluePhase roomCode={roomCode} />)}
        {state.phase === 'voting' && (isSpectator ? <IntruJury /> : <IntruVoting roomCode={roomCode} />)}
        {state.phase === 'duel' && (isSpectator ? <IntruJury /> : <IntruDuel roomCode={roomCode} />)}
        {(state.phase === 'reveal' || state.phase === 'guessing' || state.phase === 'result') && (
          <IntruReveal roomCode={roomCode} onLeave={handleLeave} />
        )}
      </Container>
    </Box>
  )
}
