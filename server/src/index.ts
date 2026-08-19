import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
import { RoomManager, RECONNECT_GRACE_MS } from './rooms/RoomManager'
import { createInitialGameState, GameState } from './games/quiestlintru/types'
import { registerIntruHandlers } from './games/quiestlintru/socketHandlers'
import { createInitialGameState as createInitialDrawGameState, GameState as DrawGameState } from './games/dessine/types'
import { registerDessineHandlers } from './games/dessine/socketHandlers'
import { createInitialGameState as createInitialCompteurGameState, GameState as CompteurGameState } from './games/compteur/types'
import { registerCompteurHandlers } from './games/compteur/socketHandlers'

dotenv.config()

const PORT = process.env.PORT ?? 3001
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173'

const app = express()
app.use(cors({ origin: ALLOWED_ORIGIN }))
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

const httpServer = createServer(app)
// Tightened from the socket.io defaults (25s/20s) so a player who closes the tab/app without
// clicking "Quitter" disappears from other players' lists in a few seconds instead of up to ~45s.
// connectionStateRecovery lets a socket that reconnects within maxDisconnectionDuration keep its
// original socket.id and Socket.IO room membership, and replays any room broadcasts it missed —
// this is what makes the per-game reconnect grace period (see RECONNECT_GRACE_MS) actually work,
// instead of the player coming back as a stranger with a brand-new id.
const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGIN },
  pingInterval: 5000,
  pingTimeout: 5000,
  connectionStateRecovery: { maxDisconnectionDuration: RECONNECT_GRACE_MS },
})

const roomManager = new RoomManager<GameState>(createInitialGameState)
const drawRoomManager = new RoomManager<DrawGameState>(createInitialDrawGameState)
const compteurRoomManager = new RoomManager<CompteurGameState>(createInitialCompteurGameState)

io.on('connection', (socket) => {
  registerIntruHandlers(io, socket, roomManager)
  registerDessineHandlers(io, socket, drawRoomManager)
  registerCompteurHandlers(io, socket, compteurRoomManager)
})

httpServer.listen(PORT, () => console.log(`Server started on http://localhost:${PORT}`))
