import { type JSX } from 'react'
import { Typography } from '@mui/material'
import { useIntruRoom } from '../../../context/IntruRoomContext'
import './IntruEliminationBanner.less'

// Recaps the previous round's vote outcome at the top of the next clue round —
// cleared as soon as a new vote starts (see IntruRoomContext).
export default function IntruEliminationBanner(): JSX.Element | null {
  const { state } = useIntruRoom()
  if (!state.lastElimination) return null

  const { eliminatedId } = state.lastElimination
  if (!eliminatedId) {
    return (
      <Typography className="intru-elimination-banner">
        Vote non concluant au tour précédent : personne n'a été éliminé, la partie continue.
      </Typography>
    )
  }

  const pseudo = state.players.find((p) => p.id === eliminatedId)?.pseudo ?? '?'
  return (
    <Typography className="intru-elimination-banner">
      {pseudo} a été éliminé(e) par erreur au tour précédent — ce n'était pas l'intrus, la partie continue.
    </Typography>
  )
}
