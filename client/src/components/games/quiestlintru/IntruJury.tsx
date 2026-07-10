import { type JSX } from 'react'
import { Box, Typography } from '@mui/material'
import { useIntruRoom } from '../../../context/IntruRoomContext'
import IntruClueList from './IntruClueList'
import IntruEliminationBanner from './IntruEliminationBanner'
import './IntruJury.less'

export default function IntruJury(): JSX.Element {
  const { state } = useIntruRoom()
  const currentPlayer = state.players.find((p) => p.id === state.turnOrder[state.currentTurnIndex])
  const wasEliminated = state.playerId !== null && state.eliminated.includes(state.playerId)

  function statusText(): string {
    if (state.phase === 'clues') {
      return `Tour ${state.round}/${state.totalRounds} — ${currentPlayer?.pseudo ?? '...'} donne un indice.`
    }
    if (state.phase === 'voting') {
      return state.voteUpdate ? `${state.voteUpdate.votesCastCount}/${state.voteUpdate.totalPlayers} ont voté.` : ''
    }
    if (state.phase === 'duel') {
      return state.duelUpdate ? `${state.duelUpdate.guessesCount}/${state.duelUpdate.totalPlayers} ont répondu.` : ''
    }
    return ''
  }

  return (
    <Box className="intru-jury fade-in">
      <Typography variant="h4" className="intru-jury__title">
        Tu es le jury de cette manche
      </Typography>
      <Typography className="intru-jury__subtitle">
        {wasEliminated
          ? "Tu as été éliminé(e) par erreur — tu observes la fin de la partie sans intervenir."
          : 'Comme tu as choisi les mots, tu ne joues pas — observe la partie sans intervenir.'}
      </Typography>
      <IntruEliminationBanner />
      <Typography className="intru-jury__status">{statusText()}</Typography>
      <IntruClueList />
    </Box>
  )
}
