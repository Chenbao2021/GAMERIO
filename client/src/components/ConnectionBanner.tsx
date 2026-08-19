import { useEffect, useState, type JSX } from 'react'
import { Box, Typography } from '@mui/material'
import { useSocket } from '../context/SocketContext'
import './ConnectionBanner.less'

// Delayed so a sub-second network blip doesn't flash the banner. The server tolerates a much
// longer gap before actually dropping a player from a room (see RECONNECT_GRACE_MS server-side) —
// this is purely a "hang on, we're working on it" hint while that grace period runs.
const SHOW_DELAY_MS = 600

export default function ConnectionBanner(): JSX.Element | null {
  const socket = useSocket()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | undefined

    function onDisconnect(): void {
      showTimer = setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    }

    function onConnect(): void {
      if (showTimer) clearTimeout(showTimer)
      setVisible(false)
    }

    socket.on('disconnect', onDisconnect)
    socket.on('connect', onConnect)

    return () => {
      if (showTimer) clearTimeout(showTimer)
      socket.off('disconnect', onDisconnect)
      socket.off('connect', onConnect)
    }
  }, [socket])

  if (!visible) return null

  return (
    <Box className="connection-banner" role="status" aria-live="polite">
      <svg
        className="connection-banner__spinner"
        width="18"
        height="18"
        viewBox="0 0 48 48"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="24" cy="24" r="20" stroke="#d1d5db" strokeWidth="4" fill="none" />
        <path d="M24 4 A20 20 0 0 1 44 24" stroke="#ca8a04" strokeWidth="4" fill="none" strokeLinecap="round" />
      </svg>
      <Typography className="connection-banner__label">Reconnexion...</Typography>
    </Box>
  )
}
