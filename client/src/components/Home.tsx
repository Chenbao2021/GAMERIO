import { Box, Container, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { type JSX } from 'react'
import { games } from '../data/games'
import './Home.less'

export default function Home(): JSX.Element {
  return (
    <Box component="section" className="home-section fade-in">
      <Container maxWidth="md">
        <Typography variant="h2" className="home-title">
          Gamerio
        </Typography>
        <Typography className="home-subtitle">
          Des petits jeux à plusieurs, à jouer ensemble en temps réel.
        </Typography>

        <Box className="home-grid">
          {games.map((game) => {
            const cardClass = [
              'home-card',
              `home-card--${game.colorKey}`,
              game.status === 'coming-soon' ? 'home-card--disabled' : '',
            ]
              .filter(Boolean)
              .join(' ')

            const content = (
              <>
                <span className="home-card__emoji" aria-hidden="true">
                  {game.emoji}
                </span>
                <Typography variant="h4" className="home-card__title">
                  {game.name}
                </Typography>
                <Typography className="home-card__description">{game.description}</Typography>
                {game.status === 'coming-soon' && <span className="home-card__badge">Bientôt</span>}
              </>
            )

            return game.status === 'available' ? (
              <Box key={game.key} component={Link} to={game.path} className={cardClass}>
                {content}
              </Box>
            ) : (
              <Box key={game.key} className={cardClass}>
                {content}
              </Box>
            )
          })}
        </Box>
      </Container>
    </Box>
  )
}
