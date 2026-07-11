import { Server, Socket } from 'socket.io'
import { RoomManager, Room, MIN_PLAYERS } from '../../rooms/RoomManager'
import { GameState, createInitialGameState } from './types'
import { buildTurnOrder, checkGuess, pickWord } from './engine'

const DRAW_DURATION_MS = 75_000

// Per-room pending "time's up" timers, and which room each connected socket is in. Neither
// belongs in GameState since they're not broadcast-safe data. Kept private to this module so
// this game's disconnect handling never touches sockets that belong to a different game.
const roundTimers = new Map<string, ReturnType<typeof setTimeout>>()
const socketRoomMap = new Map<string, string>()

function sanitizePseudo(raw: unknown): string {
  const pseudo = typeof raw === 'string' ? raw.trim().slice(0, 20) : ''
  return pseudo || 'Joueur'
}

function emitPlayers(io: Server, room: Room<GameState>): void {
  io.to(room.code).emit('draw:room:players', {
    players: room.players.map((p) => ({ id: p.id, pseudo: p.pseudo, isHost: p.id === room.hostId })),
  })
}

function clearRoundTimer(roomCode: string): void {
  const timer = roundTimers.get(roomCode)
  if (timer) {
    clearTimeout(timer)
    roundTimers.delete(roomCode)
  }
}

function startDrawingRound(io: Server, room: Room<GameState>): void {
  const gs = room.gameState
  const word = pickWord(gs.usedWords)
  const drawerId = gs.turnOrder[gs.currentDrawerIndex]
  const deadline = Date.now() + DRAW_DURATION_MS

  gs.phase = 'drawing'
  gs.word = word
  gs.roundDeadline = deadline
  gs.lastRoundResult = null
  room.status = 'active'

  io.to(drawerId).emit('draw:privateWord', { word })
  io.to(room.code).emit('draw:game:phase', {
    phase: 'drawing',
    drawerId,
    turnOrder: gs.turnOrder,
    round: gs.round,
    totalRounds: gs.totalRounds,
    roundDeadline: deadline,
  })

  clearRoundTimer(room.code)
  roundTimers.set(
    room.code,
    setTimeout(() => resolveRound(io, room, null), DRAW_DURATION_MS),
  )
}

function beginGame(io: Server, room: Room<GameState>): void {
  const gs = room.gameState
  gs.turnOrder = buildTurnOrder(room.players)
  gs.currentDrawerIndex = 0
  gs.round = 1
  gs.usedWords = []
  startDrawingRound(io, room)
}

function resolveRound(io: Server, room: Room<GameState>, solvedById: string | null): void {
  const gs = room.gameState
  clearRoundTimer(room.code)

  const drawerId = gs.turnOrder[gs.currentDrawerIndex]
  if (solvedById) {
    gs.wins[solvedById] = (gs.wins[solvedById] ?? 0) + 1
    gs.wins[drawerId] = (gs.wins[drawerId] ?? 0) + 1
  }
  gs.usedWords.push(gs.word!)
  gs.lastRoundResult = { word: gs.word!, drawerId, solvedById }
  gs.phase = 'roundResult'

  io.to(room.code).emit('draw:round:result', {
    word: gs.word,
    drawerId,
    solvedById,
    wins: gs.wins,
  })
}

function advanceDrawer(io: Server, room: Room<GameState>): void {
  const gs = room.gameState
  const nextIndex = gs.currentDrawerIndex + 1

  if (nextIndex < gs.turnOrder.length) {
    gs.currentDrawerIndex = nextIndex
    startDrawingRound(io, room)
    return
  }

  if (gs.round < gs.totalRounds) {
    gs.round += 1
    gs.currentDrawerIndex = 0
    startDrawingRound(io, room)
    return
  }

  gs.phase = 'result'
  io.to(room.code).emit('draw:game:result', { wins: gs.wins })
}

function handleLeave(io: Server, roomManager: RoomManager<GameState>, socket: Socket): void {
  const roomCode = socketRoomMap.get(socket.id)
  socketRoomMap.delete(socket.id)
  if (!roomCode) return

  const result = roomManager.removePlayer(socket.id)
  socket.leave(roomCode)
  if (!result) return
  const { room, pseudo } = result

  if (room.players.length === 0) return // room was deleted, nobody left to notify

  const wasActive = room.gameState.phase !== 'lobby' && room.gameState.phase !== 'result'
  if (wasActive) {
    clearRoundTimer(roomCode)
    room.gameState = createInitialGameState()
    room.status = 'lobby'
    io.to(roomCode).emit('draw:interrupted')
  }

  io.to(roomCode).emit('draw:room:playerLeft', { playerId: socket.id, pseudo })
  emitPlayers(io, room)
}

export function registerDessineHandlers(io: Server, socket: Socket, roomManager: RoomManager<GameState>): void {
  socket.on('draw:room:create', (payload: { pseudo?: string }, ack: (res: unknown) => void) => {
    const room = roomManager.createRoom(socket.id, sanitizePseudo(payload?.pseudo))
    socket.join(room.code)
    socketRoomMap.set(socket.id, room.code)
    ack({ roomCode: room.code, playerId: socket.id, isHost: true })
    emitPlayers(io, room)
  })

  socket.on('draw:room:join', (payload: { roomCode?: string; pseudo?: string }, ack: (res: unknown) => void) => {
    const roomCode = (payload?.roomCode ?? '').trim().toUpperCase()
    const result = roomManager.joinRoom(roomCode, socket.id, sanitizePseudo(payload?.pseudo))
    if ('error' in result) {
      ack({ error: result.error })
      return
    }
    socket.join(roomCode)
    socketRoomMap.set(socket.id, roomCode)
    ack({ playerId: socket.id, isHost: false })
    emitPlayers(io, result)
  })

  socket.on('draw:game:configure', (payload: { roomCode: string; totalRounds: number }) => {
    const room = roomManager.getRoom(payload?.roomCode)
    if (!room || room.hostId !== socket.id || room.gameState.phase !== 'lobby') return
    const rounds = Number(payload.totalRounds)
    room.gameState.totalRounds = Number.isFinite(rounds) ? Math.min(3, Math.max(1, Math.round(rounds))) : 1
    io.to(room.code).emit('draw:game:settings', { totalRounds: room.gameState.totalRounds })
  })

  socket.on('draw:game:start', (payload: { roomCode: string }, ack: (res: unknown) => void) => {
    const room = roomManager.getRoom(payload?.roomCode)
    if (!room || room.hostId !== socket.id) {
      ack({ error: 'Action non autorisée.' })
      return
    }
    if (room.gameState.phase !== 'lobby') {
      ack({ error: 'La partie a déjà commencé.' })
      return
    }
    if (room.players.length < MIN_PLAYERS) {
      ack({ error: `Il faut au moins ${MIN_PLAYERS} joueurs.` })
      return
    }
    beginGame(io, room)
    ack({})
  })

  // Stroke events are a pure low-latency relay: no game-state to validate against besides phase
  // and "is this socket the current drawer", and nothing ever needs the point history server-side
  // (there's no reconnection/replay support in v1 — see README known limitations).
  socket.on('draw:stroke:start', (payload: { roomCode: string; x: number; y: number }) => {
    const room = roomManager.getRoom(payload?.roomCode)
    if (!room || room.gameState.phase !== 'drawing') return
    if (room.gameState.turnOrder[room.gameState.currentDrawerIndex] !== socket.id) return

    socket.to(room.code).emit('draw:stroke:start', { x: payload.x, y: payload.y })
  })

  socket.on('draw:stroke:point', (payload: { roomCode: string; x: number; y: number }) => {
    const room = roomManager.getRoom(payload?.roomCode)
    if (!room || room.gameState.phase !== 'drawing') return
    if (room.gameState.turnOrder[room.gameState.currentDrawerIndex] !== socket.id) return

    socket.to(room.code).emit('draw:stroke:point', { x: payload.x, y: payload.y })
  })

  socket.on('draw:stroke:end', (payload: { roomCode: string }) => {
    const room = roomManager.getRoom(payload?.roomCode)
    if (!room || room.gameState.phase !== 'drawing') return
    if (room.gameState.turnOrder[room.gameState.currentDrawerIndex] !== socket.id) return

    socket.to(room.code).emit('draw:stroke:end', {})
  })

  socket.on(
    'draw:round:solve',
    (payload: { roomCode: string; targetPlayerId: string | null }, ack: (res: unknown) => void) => {
      const room = roomManager.getRoom(payload?.roomCode)
      if (!room || room.gameState.phase !== 'drawing') {
        ack({ error: 'Action impossible pour le moment.' })
        return
      }
      if (room.gameState.turnOrder[room.gameState.currentDrawerIndex] !== socket.id) {
        ack({ error: 'Seul le dessinateur peut valider.' })
        return
      }
      const targetPlayerId = payload.targetPlayerId ?? null
      if (targetPlayerId && !room.gameState.turnOrder.includes(targetPlayerId)) {
        ack({ error: 'Joueur introuvable.' })
        return
      }
      if (targetPlayerId === socket.id) {
        ack({ error: 'Impossible de se désigner soi-même.' })
        return
      }

      resolveRound(io, room, targetPlayerId)
      ack({})
    },
  )

  // Typed alternative to the oral "quelqu'un a trouvé" flow, for groups not sitting side by side.
  // The first guesser to type the exact word resolves the round immediately, same as the drawer
  // manually picking them — no double-scoring risk since a single Node event loop processes these
  // one at a time, and the phase !== 'drawing' check rejects anything after the first hit.
  socket.on('draw:round:guess', (payload: { roomCode: string; guess?: string }, ack: (res: unknown) => void) => {
    const room = roomManager.getRoom(payload?.roomCode)
    if (!room || room.gameState.phase !== 'drawing') {
      ack({ error: 'Action impossible pour le moment.' })
      return
    }
    const gs = room.gameState
    const drawerId = gs.turnOrder[gs.currentDrawerIndex]
    if (!gs.turnOrder.includes(socket.id) || socket.id === drawerId) {
      ack({ error: 'Seuls les devineurs peuvent taper une réponse.' })
      return
    }

    if (!checkGuess(payload.guess ?? '', gs.word ?? '')) {
      ack({ correct: false })
      return
    }

    resolveRound(io, room, socket.id)
    ack({ correct: true })
  })

  socket.on('draw:round:next', (payload: { roomCode: string }, ack: (res: unknown) => void) => {
    const room = roomManager.getRoom(payload?.roomCode)
    if (!room || room.gameState.phase !== 'roundResult') {
      ack({ error: 'Action impossible pour le moment.' })
      return
    }
    if (room.gameState.lastRoundResult?.drawerId !== socket.id) {
      ack({ error: "Seul le dessinateur qui vient de jouer peut passer à la manche suivante." })
      return
    }

    advanceDrawer(io, room)
    ack({})
  })

  socket.on('draw:playAgain', (payload: { roomCode: string }, ack: (res: unknown) => void) => {
    const room = roomManager.getRoom(payload?.roomCode)
    if (!room || room.hostId !== socket.id) {
      ack({ error: 'Action non autorisée.' })
      return
    }
    if (room.gameState.phase !== 'result') {
      ack({ error: 'La partie est en cours.' })
      return
    }
    beginGame(io, room)
    ack({})
  })

  socket.on('draw:room:leave', () => handleLeave(io, roomManager, socket))
  socket.on('disconnect', () => handleLeave(io, roomManager, socket))
}
