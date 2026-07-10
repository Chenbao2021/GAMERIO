import { type JSX } from 'react'
import { Box, Typography } from '@mui/material'
import { useIntruRoom } from '../../../context/IntruRoomContext'
import './IntruClueList.less'

export default function IntruClueList(): JSX.Element | null {
  const { state } = useIntruRoom()
  if (state.clues.length === 0) return null

  return (
    <Box className="intru-clue-list">
      <Typography className="intru-clue-list__title">Indices donnés</Typography>
      {state.clues.map((clue, index) => {
        const pseudo = state.players.find((p) => p.id === clue.playerId)?.pseudo ?? '?'
        return (
          <Typography key={index} className="intru-clue-list__item">
            <strong>{pseudo}</strong> : {clue.text}
          </Typography>
        )
      })}
    </Box>
  )
}
