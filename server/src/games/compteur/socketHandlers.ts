import { nanoid } from 'nanoid'
import { Server, Socket } from 'socket.io'
import { RoomManager, Room } from '../../rooms/RoomManager'
import { GameState, CompteurMode } from './types'
import { sanitizePlayerName, sanitizeDelta } from './engine'

// Which room each connected socket is in, kept private to this module like the other games.
const socketRoomMap = new Map<string, string>()

function sanitizePseudo(raw: unknown): string {
  const pseudo = typeof raw === 'string' ? raw.trim().slice(0, 20) : ''
  return pseudo || 'Joueur'
}

function sanitizeMode(raw: unknown): CompteurMode {
  return raw === 'selfEntry' ? 'selfEntry' : 'host'
}

function emitPlayers(io: Server, room: Room<GameState>): void {
  io.to(room.code).emit('compteur:room:players', {
    players: room.players.map((p) => ({ id: p.id, pseudo: p.pseudo, isHost: p.id === room.hostId })),
    mode: room.gameState.mode,
  })
}

function emitScores(io: Server, room: Room<GameState>): void {
  io.to(room.code).emit('compteur:score:update', { scores: room.gameState.scores })
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

  delete room.gameState.scores[socket.id]
  io.to(roomCode).emit('compteur:room:playerLeft', { playerId: socket.id, pseudo })
  emitPlayers(io, room)
  emitScores(io, room)
}

export function registerCompteurHandlers(io: Server, socket: Socket, roomManager: RoomManager<GameState>): void {
  socket.on('compteur:room:create', (payload: { pseudo?: string; mode?: string }, ack: (res: unknown) => void) => {
    const room = roomManager.createRoom(socket.id, sanitizePseudo(payload?.pseudo))
    room.gameState.mode = sanitizeMode(payload?.mode)
    socket.join(room.code)
    socketRoomMap.set(socket.id, room.code)
    ack({ roomCode: room.code, playerId: socket.id, isHost: true })
    emitPlayers(io, room)
  })

  socket.on('compteur:room:join', (payload: { roomCode?: string; pseudo?: string }, ack: (res: unknown) => void) => {
    const roomCode = (payload?.roomCode ?? '').trim().toUpperCase()
    const result = roomManager.joinRoom(roomCode, socket.id, sanitizePseudo(payload?.pseudo))
    if ('error' in result) {
      ack({ error: result.error })
      return
    }
    socket.join(roomCode)
    socketRoomMap.set(socket.id, roomCode)
    ack({ playerId: socket.id, isHost: false, mode: result.gameState.mode })
    emitPlayers(io, result)
    emitScores(io, result)
  })

  socket.on('compteur:player:add', (payload: { roomCode?: string; name?: string }, ack: (res: unknown) => void) => {
    const room = roomManager.getRoom(payload?.roomCode ?? '')
    if (!room || room.hostId !== socket.id) {
      ack({ error: 'Action non autorisée.' })
      return
    }
    const player = { id: nanoid(), pseudo: sanitizePlayerName(payload?.name) }
    room.players.push(player)
    room.gameState.scores[player.id] = 0
    ack({ playerId: player.id })
    emitPlayers(io, room)
    emitScores(io, room)
  })

  socket.on(
    'compteur:score:add',
    (payload: { roomCode?: string; targetPlayerId?: string; delta?: number }, ack: (res: unknown) => void) => {
      const room = roomManager.getRoom(payload?.roomCode ?? '')
      const targetPlayerId = payload?.targetPlayerId ?? ''
      if (!room || !room.players.some((p) => p.id === targetPlayerId)) {
        ack({ error: 'Joueur introuvable.' })
        return
      }
      const isHost = room.hostId === socket.id
      const canEditSelf = room.gameState.mode === 'selfEntry' && targetPlayerId === socket.id
      if (!isHost && !canEditSelf) {
        ack({ error: 'Action non autorisée.' })
        return
      }
      const delta = sanitizeDelta(payload?.delta)
      room.gameState.scores[targetPlayerId] = (room.gameState.scores[targetPlayerId] ?? 0) + delta
      ack({})
      emitScores(io, room)
    },
  )

  socket.on('compteur:score:reset', (payload: { roomCode?: string }, ack: (res: unknown) => void) => {
    const room = roomManager.getRoom(payload?.roomCode ?? '')
    if (!room || room.hostId !== socket.id) {
      ack({ error: 'Action non autorisée.' })
      return
    }
    for (const id of Object.keys(room.gameState.scores)) room.gameState.scores[id] = 0
    ack({})
    emitScores(io, room)
  })

  socket.on(
    'compteur:player:remove',
    (payload: { roomCode?: string; targetPlayerId?: string }, ack: (res: unknown) => void) => {
      const room = roomManager.getRoom(payload?.roomCode ?? '')
      if (!room || room.hostId !== socket.id) {
        ack({ error: 'Action non autorisée.' })
        return
      }
      const targetPlayerId = payload?.targetPlayerId ?? ''
      if (targetPlayerId === socket.id) {
        ack({ error: "Impossible de se retirer soi-même, utilise Quitter." })
        return
      }
      const result = roomManager.removePlayer(targetPlayerId)
      if (!result) {
        ack({ error: 'Joueur introuvable.' })
        return
      }
      delete room.gameState.scores[targetPlayerId]

      // Only real connected players (id === their own socket id) are in a Socket.IO room to notify —
      // a host-added virtual player has no socket, so this is a harmless no-op for them.
      socketRoomMap.delete(targetPlayerId)
      io.to(targetPlayerId).emit('compteur:room:removed')
      io.sockets.sockets.get(targetPlayerId)?.leave(room.code)

      ack({})
      emitPlayers(io, room)
      emitScores(io, room)
    },
  )

  socket.on('compteur:room:leave', () => handleLeave(io, roomManager, socket))
  socket.on('disconnect', () => handleLeave(io, roomManager, socket))
}
