import { createContext, useCallback, useContext, useEffect, useState, type JSX, type ReactNode } from 'react'
import { useSocket } from './SocketContext'
import {
  type AckError,
  type DrawRoomState,
  type GameResultInfo,
  type GuessAck,
  type PhasePayload,
  type PlayerInfo,
  type PrivateWord,
  type RoundResultInfo,
  initialDrawRoomState,
} from '../components/games/dessine/types'

interface CreateRoomAck extends AckError {
  roomCode?: string
  playerId?: string
  isHost?: boolean
}

interface JoinRoomAck extends AckError {
  playerId?: string
  isHost?: boolean
}

interface DrawRoomContextValue {
  state: DrawRoomState
  createRoom: (pseudo: string) => Promise<{ roomCode?: string; error?: string }>
  joinRoom: (roomCode: string, pseudo: string) => Promise<AckError>
  configure: (roomCode: string, totalRounds: number) => void
  start: (roomCode: string) => Promise<AckError>
  solveRound: (roomCode: string, targetPlayerId: string | null) => Promise<AckError>
  submitGuess: (roomCode: string, guess: string) => Promise<GuessAck>
  nextRound: (roomCode: string) => Promise<AckError>
  playAgain: (roomCode: string) => Promise<AckError>
  leaveRoom: (roomCode: string) => void
}

const DrawRoomContext = createContext<DrawRoomContextValue | null>(null)

export function useDrawRoom(): DrawRoomContextValue {
  const ctx = useContext(DrawRoomContext)
  if (!ctx) throw new Error('useDrawRoom must be used within a DrawRoomProvider')
  return ctx
}

/**
 * Holds the "Dessine-moi un mot" room state and socket listeners for the whole /dessine/*
 * subtree, so state created in the lobby (room code, isHost) survives navigating to the game
 * screen — a plain per-component hook would reset to its initial state on that route change.
 *
 * Stroke data (draw:stroke:*) deliberately isn't handled here: it's high-frequency and consumed
 * directly by the canvas component via imperative drawing, not through React state.
 */
export function DrawRoomProvider({ children }: { children: ReactNode }): JSX.Element {
  const socket = useSocket()
  const [state, setState] = useState<DrawRoomState>(initialDrawRoomState)

  useEffect(() => {
    function onPlayers(payload: { players: PlayerInfo[] }): void {
      setState((s) => {
        const me = payload.players.find((p) => p.id === socket.id)
        return { ...s, players: payload.players, isHost: me?.isHost ?? s.isHost }
      })
    }

    function onSettings(payload: { totalRounds: number }): void {
      setState((s) => ({ ...s, totalRounds: payload.totalRounds }))
    }

    function onPrivateWord(payload: PrivateWord): void {
      setState((s) => ({ ...s, privateWord: payload.word }))
    }

    function onPhase(payload: PhasePayload): void {
      setState((s) => {
        if (payload.phase === 'drawing') {
          return {
            ...s,
            phase: 'drawing',
            drawerId: payload.drawerId ?? null,
            turnOrder: payload.turnOrder ?? s.turnOrder,
            round: payload.round ?? s.round,
            totalRounds: payload.totalRounds ?? s.totalRounds,
            roundDeadline: payload.roundDeadline ?? null,
            // The privateWord event for the drawer arrives just before this one on the same
            // socket, so it's already in state by the time this runs — don't wipe it out.
            privateWord: payload.drawerId === s.playerId ? s.privateWord : null,
            lastRoundResult: null,
            interrupted: false,
          }
        }
        return s
      })
    }

    function onRoundResult(payload: RoundResultInfo): void {
      setState((s) => ({ ...s, phase: 'roundResult', lastRoundResult: payload, wins: payload.wins }))
    }

    function onGameResult(payload: GameResultInfo): void {
      setState((s) => ({ ...s, phase: 'result', wins: payload.wins }))
    }

    function onInterrupted(): void {
      setState((s) => ({
        ...s,
        interrupted: true,
        phase: 'lobby',
        privateWord: null,
        lastRoundResult: null,
      }))
    }

    socket.on('draw:room:players', onPlayers)
    socket.on('draw:game:settings', onSettings)
    socket.on('draw:privateWord', onPrivateWord)
    socket.on('draw:game:phase', onPhase)
    socket.on('draw:round:result', onRoundResult)
    socket.on('draw:game:result', onGameResult)
    socket.on('draw:interrupted', onInterrupted)

    return () => {
      socket.off('draw:room:players', onPlayers)
      socket.off('draw:game:settings', onSettings)
      socket.off('draw:privateWord', onPrivateWord)
      socket.off('draw:game:phase', onPhase)
      socket.off('draw:round:result', onRoundResult)
      socket.off('draw:game:result', onGameResult)
      socket.off('draw:interrupted', onInterrupted)
    }
  }, [socket])

  const createRoom = useCallback(
    (pseudo: string): Promise<{ roomCode?: string; error?: string }> =>
      new Promise((resolve) => {
        socket.emit('draw:room:create', { pseudo }, (res: CreateRoomAck) => {
          if (res.error || !res.roomCode || !res.playerId) {
            setState((s) => ({ ...s, error: res.error ?? 'Erreur inconnue.' }))
            resolve({ error: res.error })
            return
          }
          // Reset to a clean slate rather than spreading previous state: this socket may still be
          // carrying leftover phase/result/interrupted flags from a room it never properly left
          // (e.g. browser back/forward instead of the "Quitter" button), and a stale phase here
          // would make the new room briefly render the old game's last screen.
          setState(() => ({
            ...initialDrawRoomState,
            roomCode: res.roomCode!,
            playerId: res.playerId!,
            isHost: true,
            error: null,
          }))
          resolve({ roomCode: res.roomCode })
        })
      }),
    [socket],
  )

  const joinRoom = useCallback(
    (roomCode: string, pseudo: string): Promise<AckError> =>
      new Promise((resolve) => {
        socket.emit('draw:room:join', { roomCode, pseudo }, (res: JoinRoomAck) => {
          if (res.error || !res.playerId) {
            setState((s) => ({ ...s, error: res.error ?? 'Erreur inconnue.' }))
            resolve({ error: res.error })
            return
          }
          setState(() => ({
            ...initialDrawRoomState,
            roomCode,
            playerId: res.playerId!,
            isHost: false,
            error: null,
          }))
          resolve({})
        })
      }),
    [socket],
  )

  const configure = useCallback(
    (roomCode: string, totalRounds: number): void => {
      socket.emit('draw:game:configure', { roomCode, totalRounds })
    },
    [socket],
  )

  const start = useCallback(
    (roomCode: string): Promise<AckError> =>
      new Promise((resolve) => {
        socket.emit('draw:game:start', { roomCode }, (res: AckError) => {
          if (res.error) setState((s) => ({ ...s, error: res.error ?? null }))
          resolve(res)
        })
      }),
    [socket],
  )

  const solveRound = useCallback(
    (roomCode: string, targetPlayerId: string | null): Promise<AckError> =>
      new Promise((resolve) => {
        socket.emit('draw:round:solve', { roomCode, targetPlayerId }, (res: AckError) => {
          if (res.error) setState((s) => ({ ...s, error: res.error ?? null }))
          resolve(res)
        })
      }),
    [socket],
  )

  const submitGuess = useCallback(
    (roomCode: string, guess: string): Promise<GuessAck> =>
      new Promise((resolve) => {
        socket.emit('draw:round:guess', { roomCode, guess }, (res: GuessAck) => {
          // A wrong guess isn't an app error worth surfacing globally — only real failures are.
          if (res.error) setState((s) => ({ ...s, error: res.error ?? null }))
          resolve(res)
        })
      }),
    [socket],
  )

  const nextRound = useCallback(
    (roomCode: string): Promise<AckError> =>
      new Promise((resolve) => {
        socket.emit('draw:round:next', { roomCode }, (res: AckError) => {
          if (res.error) setState((s) => ({ ...s, error: res.error ?? null }))
          resolve(res)
        })
      }),
    [socket],
  )

  const playAgain = useCallback(
    (roomCode: string): Promise<AckError> =>
      new Promise((resolve) => {
        socket.emit('draw:playAgain', { roomCode }, (res: AckError) => {
          if (res.error) setState((s) => ({ ...s, error: res.error ?? null }))
          resolve(res)
        })
      }),
    [socket],
  )

  const leaveRoom = useCallback(
    (roomCode: string): void => {
      socket.emit('draw:room:leave', { roomCode })
      setState(initialDrawRoomState)
    },
    [socket],
  )

  const value: DrawRoomContextValue = {
    state,
    createRoom,
    joinRoom,
    configure,
    start,
    solveRound,
    submitGuess,
    nextRound,
    playAgain,
    leaveRoom,
  }

  return <DrawRoomContext.Provider value={value}>{children}</DrawRoomContext.Provider>
}
