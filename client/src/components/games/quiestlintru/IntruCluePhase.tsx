import { useState, type JSX } from 'react'
import { Box, Typography, Button, TextField } from '@mui/material'
import { useIntruRoom } from '../../../context/IntruRoomContext'
import IntruClueList from './IntruClueList'
import IntruEliminationBanner from './IntruEliminationBanner'
import './IntruCluePhase.less'

interface Props {
  roomCode: string
}

export default function IntruCluePhase({ roomCode }: Props): JSX.Element {
  const { state, clueDone } = useIntruRoom()
  const [hint, setHint] = useState('')
  const currentPlayerId = state.turnOrder[state.currentTurnIndex]
  const currentPlayer = state.players.find((p) => p.id === currentPlayerId)
  const isMyTurn = currentPlayerId === state.playerId

  function handleDone(): void {
    clueDone(roomCode, hint.trim() || undefined)
    setHint('')
  }

  return (
    <Box className="intru-clue fade-in">
      <IntruEliminationBanner />
      <Typography className="intru-clue__round">
        Tour {state.round}/{state.totalRounds}
      </Typography>

      {state.privateWord && (
        <Box className="intru-clue__word-card">
          <Typography className="intru-clue__category">{state.privateWord.category}</Typography>
          <Typography variant="h3" className="intru-clue__word">
            {state.privateWord.word}
          </Typography>
        </Box>
      )}

      <Typography className="intru-clue__turn">
        {isMyTurn ? "C'est ton tour de donner un indice à voix haute" : `Au tour de ${currentPlayer?.pseudo ?? '...'}`}
      </Typography>

      {isMyTurn && (
        <TextField
          fullWidth
          size="small"
          label="Noter ton indice (optionnel)"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          inputProps={{ maxLength: 60 }}
          className="intru-clue__hint-field"
        />
      )}

      <Button fullWidth variant="contained" disabled={!isMyTurn} onClick={handleDone} className="intru-clue__done">
        J'ai donné mon indice ✓
      </Button>

      <IntruClueList />
    </Box>
  )
}
