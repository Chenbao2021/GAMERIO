import { AppBar, Toolbar, Typography, Box } from '@mui/material'
import { Link } from 'react-router-dom'
import { type JSX } from 'react'
import './Navbar.less'

export default function Navbar(): JSX.Element {
  return (
    <AppBar position="sticky" className="navbar" elevation={0}>
      <Toolbar className="navbar-toolbar">
        <Box component={Link} to="/" className="navbar-logo">
          <Typography variant="h5" component="span">
            🎲 Gamerio
          </Typography>
        </Box>
      </Toolbar>
    </AppBar>
  )
}
