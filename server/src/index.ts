import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
import { RoomManager } from './rooms/RoomManager'
import { createInitialGameState, GameState } from './games/quiestlintru/types'
import { registerIntruHandlers } from './games/quiestlintru/socketHandlers'

dotenv.config()

const PORT = process.env.PORT ?? 3001
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173'

const app = express()
app.use(cors({ origin: ALLOWED_ORIGIN }))
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

const httpServer = createServer(app)
const io = new Server(httpServer, { cors: { origin: ALLOWED_ORIGIN } })

const roomManager = new RoomManager<GameState>(createInitialGameState)

io.on('connection', (socket) => {
  registerIntruHandlers(io, socket, roomManager)
})

httpServer.listen(PORT, () => console.log(`Server started on http://localhost:${PORT}`))
