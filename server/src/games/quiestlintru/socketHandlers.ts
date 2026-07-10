import { Server, Socket } from 'socket.io'
import { RoomManager, Room, Player, MIN_PLAYERS } from '../../rooms/RoomManager'
import { GameState, WordPair, createInitialGameState } from './types'
import {
  pickWordPair,
  assignIntruder,
  buildTurnOrder,
  tallyVotes,
  resolveElimination,
  checkGuess,
  normalize,
} from './engine'

interface CustomWordsPayload {
  category?: string
  majority?: string
  intruder?: string
}

// Trims/caps host-supplied words and falls back to the random word bank when incomplete.
function buildCustomWordPair(raw?: CustomWordsPayload): WordPair | null {
  if (!raw) return null
  const majority = (raw.majority ?? '').trim().slice(0, 30)
  const intruder = (raw.intruder ?? '').trim().slice(0, 30)
  if (!majority || !intruder) return null
  const category = (raw.category ?? '').trim().slice(0, 30) || 'Personnalisé'
  return { category, majority, intruder }
}

interface RoundSetup {
  customWordPair: WordPair | null
  spectatorId: string | null
}

// The host already knows any words they typed themselves, so they sit out that round as a
// non-playing "jury" — as long as at least MIN_PLAYERS remain without them (2 remaining
// naturally falls back to duel mode instead of voting, handled by startAccusationPhase).
function resolveRoundSetup(room: Room<GameState>, raw?: CustomWordsPayload): RoundSetup | { error: string } {
  const customWordPair = buildCustomWordPair(raw)
  if (customWordPair && normalize(customWordPair.majority) === normalize(customWordPair.intruder)) {
    return { error: 'Les deux mots doivent être différents.' }
  }
  const spectatorId = customWordPair && room.players.length - 1 >= MIN_PLAYERS ? room.hostId : null
  return { customWordPair, spectatorId }
}

const GUESS_TIMEOUT_MS = 20_000

// Per-room pending "intruder is guessing" timers, and which room each connected socket is in.
// Neither belongs in GameState since they're not broadcast-safe data.
const guessTimers = new Map<string, ReturnType<typeof setTimeout>>()
const socketRoomMap = new Map<string, string>()

function sanitizePseudo(raw: unknown): string {
  const pseudo = typeof raw === 'string' ? raw.trim().slice(0, 20) : ''
  return pseudo || 'Joueur'
}

function emitPlayers(io: Server, room: Room<GameState>): void {
  io.to(room.code).emit('room:players', {
    players: room.players.map((p) => ({ id: p.id, pseudo: p.pseudo, isHost: p.id === room.hostId })),
  })
}

function startRound(
  io: Server,
  room: Room<GameState>,
  customWordPair: WordPair | null = null,
  spectatorId: string | null = null,
): void {
  const wordPair = customWordPair ?? pickWordPair()
  const playing = spectatorId ? room.players.filter((p) => p.id !== spectatorId) : room.players
  const intruderId = assignIntruder(playing)
  const turnOrder = buildTurnOrder(playing)

  const gs = room.gameState
  gs.phase = 'clues'
  gs.wordPair = wordPair
  gs.intruderId = intruderId
  gs.turnOrder = turnOrder
  gs.currentTurnIndex = 0
  gs.round = 1
  gs.clues = []
  gs.votes = {}
  gs.passed = []
  gs.voteTally = {}
  gs.eliminated = []
  gs.duelGuesses = {}
  gs.votedOutCorrectly = false
  gs.spectatorId = spectatorId
  room.status = 'active'

  for (const player of playing) {
    const isIntruder = player.id === intruderId
    // Deliberately omits any "you're the intruder" flag — the intruder must not
    // be able to tell their word apart from everyone else's during the clue phase.
    io.to(player.id).emit('game:privateWord', {
      word: isIntruder ? wordPair.intruder : wordPair.majority,
      category: wordPair.category,
    })
  }

  io.to(room.code).emit('game:phase', {
    phase: 'clues',
    turnOrder,
    currentTurnIndex: 0,
    round: 1,
    totalRounds: gs.totalRounds,
    spectatorId,
    clues: [],
    eliminated: [],
  })
}

function advanceTurn(io: Server, room: Room<GameState>): void {
  const gs = room.gameState
  gs.currentTurnIndex += 1

  if (gs.currentTurnIndex < gs.turnOrder.length) {
    io.to(room.code).emit('game:phase', {
      phase: 'clues',
      turnOrder: gs.turnOrder,
      currentTurnIndex: gs.currentTurnIndex,
      round: gs.round,
      totalRounds: gs.totalRounds,
    })
    return
  }

  // Everyone has given a clue this round — time for an accusation, every round, not just the last.
  startAccusationPhase(io, room)
}

// This only ever sees a fresh (never-eliminated-from) turnOrder: reaching exactly 2 players via a
// wrongful mid-manche elimination ends the manche outright instead (see resolveVotes), so a duel
// here always means the manche started with 2 players (or 3 with a spectating host).
function startAccusationPhase(io: Server, room: Room<GameState>): void {
  const gs = room.gameState

  // With only 2 playing, a vote is always a 1-1 tie — both players simultaneously try to guess
  // the OTHER player's word instead.
  if (gs.turnOrder.length === 2) {
    gs.phase = 'duel'
    gs.duelGuesses = {}
    io.to(room.code).emit('game:phase', { phase: 'duel' })
    return
  }

  gs.phase = 'voting'
  gs.votes = {}
  gs.passed = []
  io.to(room.code).emit('game:phase', { phase: 'voting' })
  io.to(room.code).emit('game:voteUpdate', { votesCastCount: 0, totalPlayers: gs.turnOrder.length })
}

// A player has "responded" once they've either cast a vote or explicitly passed —
// voting is optional, so the round advances on responses, not on votes-for-someone.
function voteResponseCount(gs: GameState): number {
  return Object.keys(gs.votes).length + gs.passed.length
}

function finishRound(io: Server, room: Room<GameState>, intruderWins: boolean, guessedWord?: string): void {
  const gs = room.gameState
  const timer = guessTimers.get(room.code)
  if (timer) {
    clearTimeout(timer)
    guessTimers.delete(room.code)
  }

  const winner: 'civils' | 'intrus' = intruderWins ? 'intrus' : 'civils'
  for (const player of room.players) {
    if (player.id === gs.spectatorId) continue // the jury doesn't play, so doesn't win or lose
    const isIntruder = player.id === gs.intruderId
    const onWinningSide = intruderWins ? isIntruder : !isIntruder
    if (onWinningSide) gs.wins[player.id] = (gs.wins[player.id] ?? 0) + 1
  }
  gs.phase = 'result'
  io.to(room.code).emit('game:result', { winner, guessedWord, wins: gs.wins })
}

// Reveals the intruder and settles the manche given whether they were correctly singled out
// (by vote, in 3+ player games, or by word-guess, in 2-player duels). `wronglyEliminatedId` is set
// when the manche ends on a vote that instead voted out an innocent player.
function settleAccusation(
  io: Server,
  room: Room<GameState>,
  votedOutCorrectly: boolean,
  voteTally: Record<string, number>,
  wronglyEliminatedId: string | null = null,
): void {
  const gs = room.gameState
  gs.voteTally = voteTally
  gs.votedOutCorrectly = votedOutCorrectly
  gs.phase = 'reveal'

  io.to(room.code).emit('game:reveal', {
    intruderId: gs.intruderId,
    majorityWord: gs.wordPair!.majority,
    intruderWord: gs.wordPair!.intruder,
    voteTally,
    votedOutCorrectly,
    wronglyEliminatedId,
  })

  if (!votedOutCorrectly) {
    // The manche is over without the intruder being caught — intruder wins outright.
    finishRound(io, room, true)
    return
  }

  gs.phase = 'guessing'
  io.to(room.code).emit('game:phase', { phase: 'guessing' })
  guessTimers.set(
    room.code,
    setTimeout(() => finishRound(io, room, false), GUESS_TIMEOUT_MS),
  )
}

// Resolves one round's vote. Three outcomes:
// - the intruder is singled out -> reveal + guessing phase, as before.
// - the vote is inconclusive (tie, or as many passes as votes for the top target) -> nobody is
//   eliminated, the manche just continues.
// - an innocent player is voted out by mistake -> they're removed from play and start spectating;
//   if that leaves 2 or fewer players, or this was the last round, the intruder wins outright
//   (having survived this long without being unmasked); otherwise the manche continues.
function resolveVotes(io: Server, room: Room<GameState>): void {
  const gs = room.gameState
  const tally = tallyVotes(gs.votes)
  const eliminatedId = resolveElimination(tally, gs.passed.length)

  if (eliminatedId === gs.intruderId) {
    settleAccusation(io, room, true, tally)
    return
  }

  if (eliminatedId) {
    gs.turnOrder = gs.turnOrder.filter((id) => id !== eliminatedId)
    gs.eliminated.push(eliminatedId)
  }

  const mancheOver = gs.round >= gs.totalRounds || gs.turnOrder.length <= 2
  if (mancheOver) {
    settleAccusation(io, room, false, tally, eliminatedId)
    return
  }

  gs.round += 1
  gs.currentTurnIndex = 0
  io.to(room.code).emit('game:elimination', { eliminatedId })
  io.to(room.code).emit('game:phase', {
    phase: 'clues',
    turnOrder: gs.turnOrder,
    currentTurnIndex: 0,
    round: gs.round,
    totalRounds: gs.totalRounds,
    eliminated: gs.eliminated,
  })
}

// 2-player duel: the actual guessing happens out loud between the two players (typing an exact
// word is too error-prone for a 1v1), so each side just self-reports whether they got it right.
// Both reports arrive at once, so there's no separate reveal-then-guess pause, unlike the vote flow.
function resolveDuel(io: Server, room: Room<GameState>): void {
  const gs = room.gameState
  const majorityId = gs.turnOrder.find((id) => id !== gs.intruderId)!
  const caughtIntruder = gs.duelGuesses[majorityId] === true
  const intruderSelfSaved = gs.duelGuesses[gs.intruderId] === true

  gs.voteTally = {}
  gs.votedOutCorrectly = caughtIntruder
  gs.phase = 'reveal'
  io.to(room.code).emit('game:reveal', {
    intruderId: gs.intruderId,
    majorityWord: gs.wordPair!.majority,
    intruderWord: gs.wordPair!.intruder,
    voteTally: {},
    votedOutCorrectly: caughtIntruder,
  })

  if (!caughtIntruder) {
    finishRound(io, room, true)
    return
  }

  finishRound(io, room, intruderSelfSaved)
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
    const timer = guessTimers.get(roomCode)
    if (timer) {
      clearTimeout(timer)
      guessTimers.delete(roomCode)
    }
    room.gameState = createInitialGameState()
    room.status = 'lobby'
    io.to(roomCode).emit('game:interrupted')
  }

  io.to(roomCode).emit('room:playerLeft', { playerId: socket.id, pseudo })
  emitPlayers(io, room)
}

export function registerIntruHandlers(io: Server, socket: Socket, roomManager: RoomManager<GameState>): void {
  socket.on('room:create', (payload: { pseudo?: string }, ack: (res: unknown) => void) => {
    const room = roomManager.createRoom(socket.id, sanitizePseudo(payload?.pseudo))
    socket.join(room.code)
    socketRoomMap.set(socket.id, room.code)
    ack({ roomCode: room.code, playerId: socket.id, isHost: true })
    emitPlayers(io, room)
  })

  socket.on('room:join', (payload: { roomCode?: string; pseudo?: string }, ack: (res: unknown) => void) => {
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

  socket.on('game:configure', (payload: { roomCode: string; clueRounds: number }) => {
    const room = roomManager.getRoom(payload?.roomCode)
    if (!room || room.hostId !== socket.id || room.gameState.phase !== 'lobby') return
    const rounds = Number(payload.clueRounds)
    room.gameState.totalRounds = Number.isFinite(rounds) ? Math.min(3, Math.max(1, Math.round(rounds))) : 1
    io.to(room.code).emit('game:settings', { totalRounds: room.gameState.totalRounds })
  })

  socket.on(
    'game:start',
    (payload: { roomCode: string; customWords?: CustomWordsPayload }, ack: (res: unknown) => void) => {
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
      const setup = resolveRoundSetup(room, payload.customWords)
      if ('error' in setup) {
        ack({ error: setup.error })
        return
      }
      startRound(io, room, setup.customWordPair, setup.spectatorId)
      ack({})
    },
  )

  socket.on('clue:done', (payload: { roomCode: string; hint?: string }) => {
    const room = roomManager.getRoom(payload?.roomCode)
    if (!room || room.gameState.phase !== 'clues') return
    if (room.gameState.turnOrder[room.gameState.currentTurnIndex] !== socket.id) return

    const hint = (payload.hint ?? '').trim().slice(0, 60)
    if (hint) {
      room.gameState.clues.push({ playerId: socket.id, text: hint })
      io.to(room.code).emit('game:clues', { clues: room.gameState.clues })
    }
    advanceTurn(io, room)
  })

  socket.on('vote:cast', (payload: { roomCode: string; targetPlayerId: string }, ack: (res: unknown) => void) => {
    const room = roomManager.getRoom(payload?.roomCode)
    if (!room || room.gameState.phase !== 'voting') {
      ack({ error: 'Vote impossible pour le moment.' })
      return
    }
    if (!room.gameState.turnOrder.includes(socket.id)) {
      ack({ error: 'Le jury ne joue pas cette manche.' })
      return
    }
    if (payload.targetPlayerId === socket.id) {
      ack({ error: 'Impossible de voter pour soi-même.' })
      return
    }
    if (room.gameState.votes[socket.id] || room.gameState.passed.includes(socket.id)) {
      ack({ error: 'Vote déjà enregistré.' })
      return
    }
    if (!room.gameState.turnOrder.includes(payload.targetPlayerId)) {
      ack({ error: 'Joueur introuvable.' })
      return
    }

    room.gameState.votes[socket.id] = payload.targetPlayerId
    ack({})
    io.to(room.code).emit('game:voteUpdate', {
      votesCastCount: voteResponseCount(room.gameState),
      totalPlayers: room.gameState.turnOrder.length,
    })
    if (voteResponseCount(room.gameState) === room.gameState.turnOrder.length) {
      resolveVotes(io, room)
    }
  })

  socket.on('vote:pass', (payload: { roomCode: string }, ack: (res: unknown) => void) => {
    const room = roomManager.getRoom(payload?.roomCode)
    if (!room || room.gameState.phase !== 'voting') {
      ack({ error: 'Vote impossible pour le moment.' })
      return
    }
    if (!room.gameState.turnOrder.includes(socket.id)) {
      ack({ error: 'Le jury ne joue pas cette manche.' })
      return
    }
    if (room.gameState.votes[socket.id] || room.gameState.passed.includes(socket.id)) {
      ack({ error: 'Vote déjà enregistré.' })
      return
    }

    room.gameState.passed.push(socket.id)
    ack({})
    io.to(room.code).emit('game:voteUpdate', {
      votesCastCount: voteResponseCount(room.gameState),
      totalPlayers: room.gameState.turnOrder.length,
    })
    if (voteResponseCount(room.gameState) === room.gameState.turnOrder.length) {
      resolveVotes(io, room)
    }
  })

  socket.on('duel:guess', (payload: { roomCode: string; correct: boolean }, ack: (res: unknown) => void) => {
    const room = roomManager.getRoom(payload?.roomCode)
    if (!room || room.gameState.phase !== 'duel') {
      ack({ error: 'Action impossible pour le moment.' })
      return
    }
    if (!room.gameState.turnOrder.includes(socket.id)) {
      ack({ error: 'Le jury ne joue pas cette manche.' })
      return
    }
    if (socket.id in room.gameState.duelGuesses) {
      ack({ error: 'Réponse déjà enregistrée.' })
      return
    }

    room.gameState.duelGuesses[socket.id] = payload.correct === true
    ack({})
    io.to(room.code).emit('game:duelUpdate', {
      guessesCount: Object.keys(room.gameState.duelGuesses).length,
      totalPlayers: room.gameState.turnOrder.length,
    })
    if (Object.keys(room.gameState.duelGuesses).length === room.gameState.turnOrder.length) {
      resolveDuel(io, room)
    }
  })

  socket.on('intruder:guess', (payload: { roomCode: string; guess: string }) => {
    const room = roomManager.getRoom(payload?.roomCode)
    if (!room || room.gameState.phase !== 'guessing' || room.gameState.intruderId !== socket.id) return
    const correct = checkGuess(payload.guess ?? '', room.gameState.wordPair!.majority)
    finishRound(io, room, correct, payload.guess)
  })

  socket.on(
    'game:playAgain',
    (payload: { roomCode: string; customWords?: CustomWordsPayload }, ack: (res: unknown) => void) => {
      const room = roomManager.getRoom(payload?.roomCode)
      if (!room || room.hostId !== socket.id) {
        ack({ error: 'Action non autorisée.' })
        return
      }
      if (room.gameState.phase !== 'result') {
        ack({ error: 'La manche est en cours.' })
        return
      }
      const setup = resolveRoundSetup(room, payload.customWords)
      if ('error' in setup) {
        ack({ error: setup.error })
        return
      }
      startRound(io, room, setup.customWordPair, setup.spectatorId)
      ack({})
    },
  )

  socket.on('room:leave', () => handleLeave(io, roomManager, socket))
  socket.on('disconnect', () => handleLeave(io, roomManager, socket))
}
