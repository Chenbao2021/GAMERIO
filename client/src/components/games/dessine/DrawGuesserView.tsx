import { type JSX } from 'react'
import { Box, Typography } from '@mui/material'
import { useDrawRoom } from '../../../context/DrawRoomContext'
import DrawCanvas from './DrawCanvas'
import DrawTimer from './DrawTimer'
import './DrawGuesserView.less'

interface Props {
  roomCode: string
}

export default function DrawGuesserView({ roomCode }: Props): JSX.Element {
  const { state } = useDrawRoom()
  const drawer = state.players.find((p) => p.id === state.drawerId)

  return (
    <Box className="draw-guesser fade-in">
      <Box className="draw-guesser__header">
        <Typography className="draw-guesser__round">
          Manche {state.round}/{state.totalRounds}
        </Typography>
        <DrawTimer deadline={state.roundDeadline} />
      </Box>

      <Typography className="draw-guesser__turn">
        {drawer?.pseudo ?? '...'} dessine, devine à voix haute !
      </Typography>

      <DrawCanvas roomCode={roomCode} interactive={false} />
    </Box>
  )
}
