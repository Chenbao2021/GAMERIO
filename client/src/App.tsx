import { type JSX, Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom'
import { ThemeProvider, createTheme, CssBaseline, StyledEngineProvider } from '@mui/material'
import Navbar from './components/Navbar'
import PageLoader from './components/PageLoader'
import { SocketProvider } from './context/SocketContext'
import { IntruRoomProvider } from './context/IntruRoomContext'
import './App.less'

const Home = lazy(() => import('./components/Home'))
const IntruLobby = lazy(() => import('./components/games/quiestlintru/IntruLobby'))
const IntruGame = lazy(() => import('./components/games/quiestlintru/IntruGame'))

const theme = createTheme({
  palette: {
    background: { default: '#faf9f7' },
    text: { primary: '#2d2d2d' },
  },
  typography: {
    fontFamily: "'Nunito', sans-serif",
    h1: { fontFamily: "'Caveat', cursive" },
    h2: { fontFamily: "'Caveat', cursive" },
    h3: { fontFamily: "'Caveat', cursive" },
    h4: { fontFamily: "'Caveat', cursive" },
    h5: { fontFamily: "'Caveat', cursive" },
    h6: { fontFamily: "'Caveat', cursive" },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: { body: { background: '#faf9f7' } },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontFamily: "'Caveat', cursive",
          fontSize: '1.15rem',
          fontWeight: 700,
          borderRadius: '4px 9px 6px 4px',
          border: '2px solid #2d2d2d',
          boxShadow: '3px 3px 0 rgba(0,0,0,0.12)',
          transition: 'all 0.15s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '5px 5px 0 rgba(0,0,0,0.15)',
          },
        },
        contained: { background: '#fef9c3', color: '#2d2d2d', '&:hover': { background: '#fef08a' } },
        outlined: { background: '#fff' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontFamily: "'Nunito', sans-serif", fontWeight: 600, fontSize: '0.78rem' },
      },
    },
  },
})

function ScrollToTop(): null {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function Layout(): JSX.Element {
  return (
    <>
      <ScrollToTop />
      <Navbar />
      <Outlet />
    </>
  )
}

function IntruLayout(): JSX.Element {
  return (
    <IntruRoomProvider>
      <Outlet />
    </IntruRoomProvider>
  )
}

export default function App(): JSX.Element {
  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SocketProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/intru" element={<IntruLayout />}>
                    <Route index element={<IntruLobby />} />
                    <Route path=":roomCode" element={<IntruGame />} />
                  </Route>
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </SocketProvider>
      </ThemeProvider>
    </StyledEngineProvider>
  )
}
