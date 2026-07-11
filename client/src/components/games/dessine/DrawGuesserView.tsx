import { useState, type JSX } from 'react'
import { Box, Typography, TextField, Button } from '@mui/material'
import { useDrawRoom } from '../../../context/DrawRoomContext'
import DrawCanvas from './DrawCanvas'
import DrawTimer from './DrawTimer'
import './DrawGuesserView.less'

interface Props {
  roomCode: string
}

export default function DrawGuesserView({ roomCode }: Props): JSX.Element {
  const { state, submitGuess } = useDrawRoom()
  const drawer = state.players.find((p) => p.id === state.drawerId)
  const [guess, setGuess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [wasWrong, setWasWrong] = useState(false)

  async function handleSubmit(): Promise<void> {
    if (!guess.trim() || submitting) return
    setSubmitting(true)
    const res = await submitGuess(roomCode, guess.trim())
    setSubmitting(false)
    setGuess('')
    setWasWrong(!res.error && !res.correct)
  }

  return (
    <Box className="draw-guesser fade-in">
      <Box className="draw-guesser__header">
        <Typography className="draw-guesser__round">
          Manche {state.round}/{state.totalRounds}
        </Typography>
        <DrawTimer deadline={state.roundDeadline} />
      </Box>

      <Typography className="draw-guesser__turn">
        {drawer?.pseudo ?? '...'} dessine, devine à voix haute ou tape ta réponse ci-dessous !
      </Typography>

      <DrawCanvas roomCode={roomCode} interactive={false} />

      <Box className="draw-guesser__guess">
        <TextField
          fullWidth
          size="small"
          label="Ta réponse"
          value={guess}
          onChange={(e) => {
            setGuess(e.target.value)
            setWasWrong(false)
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          disabled={submitting}
          className="draw-guesser__guess-field"
        />
        <Button variant="contained" onClick={handleSubmit} disabled={submitting || !guess.trim()}>
          Valider
        </Button>
      </Box>
      {wasWrong && <Typography className="draw-guesser__wrong">Pas encore, réessaie !</Typography>}
    </Box>
  )
}
