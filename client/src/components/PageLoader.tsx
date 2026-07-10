import { Box, Typography } from '@mui/material'
import { type JSX } from 'react'
import './PageLoader.less'

export default function PageLoader(): JSX.Element {
  return (
    <Box className="page-loader" role="status" aria-live="polite">
      <svg className="page-loader__spinner" width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <circle cx="24" cy="24" r="20" stroke="#d1d5db" strokeWidth="4" fill="none" />
        <path d="M24 4 A20 20 0 0 1 44 24" stroke="#ca8a04" strokeWidth="4" fill="none" strokeLinecap="round" />
      </svg>
      <Typography className="page-loader__label">Chargement...</Typography>
    </Box>
  )
}
