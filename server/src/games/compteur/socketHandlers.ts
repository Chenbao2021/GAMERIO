import { nanoid } from 'nanoid'
import { Server, Socket } from 'socket.io'
import { RoomManager, Room, RECONNECT_GRACE_MS } from '../../rooms/RoomManager'
import { GameState, CompteurMode } from './types'
import { sanitizePlayerName, sanitizeDelta } from './engine'

// Which room each connected socket is in, kept private to this module like the other games.
const socketRoomMap = new Map<string, string>()

// Sockets waiting out their reconnect grace period before handleLeave actually runs.
const pendingRemovals = new Map<string, ReturnType<typeof setTimeout>>()

// Upper bound on the undo stack so a long-running game doesn't grow it unbounded.
const MAX_HISTORY = 200

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

function emitRounds(io: Server, room: Room<GameState>): void {
  io.to(room.code).emit('compteur:rounds:update', { rounds: room.gameState.rounds })
}

// Drops undo history tied to a player who left/was removed, so an undo can't resurrect their score.
function forgetPlayerHistory(room: Room<GameState>, playerId: string): void {
  room.gameState.history = room.gameState.history.filter(
    (h) => h.actorId !== playerId && h.targetPlayerId !== playerId,
  )
}

// After RoomManager.reclaim() swaps a reconnecting player's id, the game state must follow: their
// score and undo-history entries were keyed by the old (now-dead) socket.id.
function rekeyPlayerId(gs: GameState, oldId: string, newId: string): void {
  if (gs.scores[oldId] !== undefined) {
    gs.scores[newId] = gs.scores[oldId]
    delete gs.scores[oldId]
  }
  for (const h of gs.history) {
    if (h.actorId === oldId) h.actorId = newId
    if (h.targetPlayerId === oldId) h.targetPlayerId = newId
  }
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
  forgetPlayerHistory(room, socket.id)
  io.to(roomCode).emit('compteur:room:playerLeft', { playerId: socket.id, pseudo })
  emitPlayers(io, room)
  emitScores(io, room)
}

export function registerCompteurHandlers(io: Server, socket: Socket, roomManager: RoomManager<GameState>): void {
  // Socket.IO restored this exact socket.id via connectionStateRecovery: the player never left
  // the room server-side, so just cancel their pending removal and resync them (harmless no-op
  // for everyone else already up to date).
  if (socket.recovered) {
    const pending = pendingRemovals.get(socket.id)
    if (pending) {
      clearTimeout(pending)
      pendingRemovals.delete(socket.id)
    }
    const roomCode = socketRoomMap.get(socket.id)
    const room = roomCode ? roomManager.getRoom(roomCode) : undefined
    if (room) {
      emitPlayers(io, room)
      emitScores(io, room)
      emitRounds(io, room)
    }
  }

  socket.on(
    'compteur:room:create',
    (payload: { pseudo?: string; mode?: string; token?: string }, ack: (res: unknown) => void) => {
      const room = roomManager.createRoom(socket.id, sanitizePseudo(payload?.pseudo), payload?.token)
      room.gameState.mode = sanitizeMode(payload?.mode)
      socket.join(room.code)
      socketRoomMap.set(socket.id, room.code)
      ack({ roomCode: room.code, playerId: socket.id, isHost: true })
      emitPlayers(io, room)
    },
  )

  socket.on(
    'compteur:room:join',
    (payload: { roomCode?: string; pseudo?: string; token?: string }, ack: (res: unknown) => void) => {
      const roomCode = (payload?.roomCode ?? '').trim().toUpperCase()
      const result = roomManager.joinRoom(roomCode, socket.id, sanitizePseudo(payload?.pseudo), payload?.token)
      if ('error' in result) {
        ack({ error: result.error })
        return
      }
      socket.join(roomCode)
      socketRoomMap.set(socket.id, roomCode)
      ack({ playerId: socket.id, isHost: false, mode: result.gameState.mode })
      emitPlayers(io, result)
      emitScores(io, result)
      emitRounds(io, result)
    },
  )

  // Sent by a client that noticed it reconnected under a brand-new socket.id (Socket.IO's own
  // connectionStateRecovery failed — see RECONNECT_GRACE_MS's doc comment) but still remembers
  // being in this room. Swaps its stale player entry over to the live socket.id instead of
  // leaving it stuck showing pre-disconnect state forever.
  socket.on(
    'compteur:room:reclaim',
    (payload: { roomCode?: string; token?: string }, ack: (res: unknown) => void) => {
      const roomCode = (payload?.roomCode ?? '').trim().toUpperCase()
      const result = roomManager.reclaim(roomCode, payload?.token ?? '', socket.id)
      if ('error' in result) {
        ack({ error: result.error })
        return
      }
      const { room, oldId } = result

      const pending = pendingRemovals.get(oldId)
      if (pending) {
        clearTimeout(pending)
        pendingRemovals.delete(oldId)
      }
      socketRoomMap.delete(oldId)
      socketRoomMap.set(socket.id, roomCode)
      socket.join(roomCode)
      rekeyPlayerId(room.gameState, oldId, socket.id)

      ack({ playerId: socket.id, isHost: room.hostId === socket.id, mode: room.gameState.mode })
      emitPlayers(io, room)
      emitScores(io, room)
      emitRounds(io, room)
    },
  )

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
      room.gameState.history.push({ actorId: socket.id, targetPlayerId, delta })
      if (room.gameState.history.length > MAX_HISTORY) room.gameState.history.shift()
      ack({})
      emitScores(io, room)
    },
  )

  socket.on('compteur:score:undo', (payload: { roomCode?: string }, ack: (res: unknown) => void) => {
    const room = roomManager.getRoom(payload?.roomCode ?? '')
    if (!room) {
      ack({ error: 'Salle introuvable.' })
      return
    }
    const history = room.gameState.history
    const index = history.map((h) => h.actorId).lastIndexOf(socket.id)
    if (index === -1) {
      ack({ error: 'Rien à annuler.' })
      return
    }
    const [entry] = history.splice(index, 1)
    room.gameState.scores[entry.targetPlayerId] = (room.gameState.scores[entry.targetPlayerId] ?? 0) - entry.delta
    ack({})
    emitScores(io, room)
  })

  socket.on('compteur:round:save', (payload: { roomCode?: string }, ack?: (res: unknown) => void) => {
    const room = roomManager.getRoom(payload?.roomCode ?? '')
    if (!room || room.hostId !== socket.id) {
      ack?.({ error: 'Action non autorisée.' })
      return
    }
    const playerNames: Record<string, string> = {}
    for (const p of room.players) playerNames[p.id] = p.pseudo
    room.gameState.rounds.push({
      id: nanoid(),
      savedAt: Date.now(),
      scores: { ...room.gameState.scores },
      playerNames,
    })
    for (const id of Object.keys(room.gameState.scores)) room.gameState.scores[id] = 0
    room.gameState.history = []
    ack?.({})
    emitScores(io, room)
    emitRounds(io, room)
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
      forgetPlayerHistory(room, targetPlayerId)

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
  socket.on('disconnect', () => {
    // A dropped connection (mobile app backgrounded, brief network loss) isn't necessarily a
    // real "leave" — give it RECONNECT_GRACE_MS to come back via connectionStateRecovery before
    // actually removing the player. An explicit 'compteur:room:leave' above bypasses this.
    const timer = setTimeout(() => {
      pendingRemovals.delete(socket.id)
      handleLeave(io, roomManager, socket)
    }, RECONNECT_GRACE_MS)
    pendingRemovals.set(socket.id, timer)
  })
}
