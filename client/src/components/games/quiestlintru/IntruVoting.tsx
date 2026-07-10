import { type JSX } from 'react'
import { Box, Typography, Button } from '@mui/material'
import { useIntruRoom } from '../../../context/IntruRoomContext'
import './IntruVoting.less'

interface Props {
  roomCode: string
}

export default function IntruVoting({ roomCode }: Props): JSX.Element {
  const { state, castVote, castPass } = useIntruRoom()
  const votable = state.players.filter((p) => p.id !== state.playerId)

  return (
    <Box className="intru-voting fade-in">
      <Typography variant="h4" className="intru-voting__title">
        Qui est l'intrus ?
      </Typography>
      <Typography className="intru-voting__count">
        {state.voteUpdate ? `${state.voteUpdate.votesCastCount}/${state.voteUpdate.totalPlayers} ont voté` : ''}
      </Typography>

      <Box className="intru-voting__grid">
        {votable.map((p) => (
          <Button
            key={p.id}
            variant="outlined"
            disabled={state.hasVoted}
            onClick={() => castVote(roomCode, p.id)}
            className="intru-voting__option"
          >
            {p.pseudo}
          </Button>
        ))}
      </Box>

      <Button
        variant="text"
        disabled={state.hasVoted}
        onClick={() => castPass(roomCode)}
        className="intru-voting__pass"
      >
        Ne pas voter
      </Button>

      {state.hasVoted && (
        <Typography className="intru-voting__waiting">Vote enregistré, en attente des autres...</Typography>
      )}
      {state.error && <Typography className="intru-voting__error">{state.error}</Typography>}
    </Box>
  )
}
