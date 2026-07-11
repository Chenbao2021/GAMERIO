import { useEffect, useState, type JSX } from 'react'
import { Typography } from '@mui/material'
import './DrawTimer.less'

interface Props {
  deadline: number | null
}

// Countdown derived from a server-provided epoch timestamp rather than a server tick per
// second — every client stays in sync without the server needing to broadcast anything more
// than once per round.
export default function DrawTimer({ deadline }: Props): JSX.Element | null {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!deadline) return
    const interval = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(interval)
  }, [deadline])

  if (!deadline) return null
  const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000))
  return <Typography className="draw-timer">{secondsLeft}s</Typography>
}
