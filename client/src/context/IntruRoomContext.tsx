import { createContext, useCallback, useContext, useEffect, useState, type JSX, type ReactNode } from 'react'
import { useSocket } from './SocketContext'
import {
  type AckError,
  type ClueEntry,
  type CustomWords,
  type DuelUpdateInfo,
  type EliminationInfo,
  type IntruRoomState,
  type PhasePayload,
  type PlayerInfo,
  type PrivateWord,
  type ResultInfo,
  type RevealInfo,
  type VoteUpdateInfo,
  initialIntruRoomState,
} from '../components/games/quiestlintru/types'

interface CreateRoomAck extends AckError {
  roomCode?: string
  playerId?: string
  isHost?: boolean
}

interface JoinRoomAck extends AckError {
  playerId?: string
  isHost?: boolean
}

interface IntruRoomContextValue {
  state: IntruRoomState
  createRoom: (pseudo: string) => Promise<{ roomCode?: string; error?: string }>
  joinRoom: (roomCode: string, pseudo: string) => Promise<AckError>
  configure: (roomCode: string, clueRounds: number) => void
  start: (roomCode: string, customWords?: CustomWords) => Promise<AckError>
  clueDone: (roomCode: string, hint?: string) => void
  castVote: (roomCode: string, targetPlayerId: string) => Promise<AckError>
  castPass: (roomCode: string) => Promise<AckError>
  castDuelGuess: (roomCode: string, correct: boolean) => Promise<AckError>
  submitGuess: (roomCode: string, guess: string) => void
  playAgain: (roomCode: string, customWords?: CustomWords) => Promise<AckError>
  leaveRoom: (roomCode: string) => void
}

const IntruRoomContext = createContext<IntruRoomContextValue | null>(null)

export function useIntruRoom(): IntruRoomContextValue {
  const ctx = useContext(IntruRoomContext)
  if (!ctx) throw new Error('useIntruRoom must be used within an IntruRoomProvider')
  return ctx
}

/**
 * Holds the "Qui est l'intru" room state and socket listeners for the whole /intru/* subtree,
 * so state created in the lobby (room code, isHost) survives navigating to the game screen —
 * a plain per-component hook would reset to its initial state on that route change.
 */
export function IntruRoomProvider({ children }: { children: ReactNode }): JSX.Element {
  const socket = useSocket()
  const [state, setState] = useState<IntruRoomState>(initialIntruRoomState)

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
      setState((s) => ({ ...s, privateWord: payload }))
    }

    function onPhase(payload: PhasePayload): void {
      setState((s) => {
        if (payload.phase === 'clues') {
          return {
            ...s,
            phase: 'clues',
            turnOrder: payload.turnOrder ?? s.turnOrder,
            currentTurnIndex: payload.currentTurnIndex ?? 0,
            round: payload.round ?? s.round,
            totalRounds: payload.totalRounds ?? s.totalRounds,
            hasVoted: false,
            spectatorId: payload.spectatorId ?? null,
            clues: payload.clues ?? s.clues,
            eliminated: payload.eliminated ?? s.eliminated,
            // A brand-new manche (round 1) starts with a clean slate — any elimination banner
            // left over belongs to whichever manche just ended.
            lastElimination: payload.round === 1 ? null : s.lastElimination,
            reveal: null,
            result: null,
            interrupted: false,
          }
        }
        if (payload.phase === 'voting') {
          // A fresh vote is starting, so the previous round's elimination recap no longer applies.
          return { ...s, phase: 'voting', hasVoted: false, lastElimination: null }
        }
        if (payload.phase === 'duel') {
          return { ...s, phase: 'duel', hasDuelGuessed: false, duelUpdate: null }
        }
        if (payload.phase === 'guessing') {
          return { ...s, phase: 'guessing' }
        }
        return s
      })
    }

    function onVoteUpdate(payload: VoteUpdateInfo): void {
      setState((s) => ({ ...s, voteUpdate: payload }))
    }

    function onElimination(payload: EliminationInfo): void {
      setState((s) => ({
        ...s,
        lastElimination: payload,
        eliminated: payload.eliminatedId ? [...s.eliminated, payload.eliminatedId] : s.eliminated,
      }))
    }

    function onDuelUpdate(payload: DuelUpdateInfo): void {
      setState((s) => ({ ...s, duelUpdate: payload }))
    }

    function onClues(payload: { clues: ClueEntry[] }): void {
      setState((s) => ({ ...s, clues: payload.clues }))
    }

    function onReveal(payload: RevealInfo): void {
      setState((s) => ({ ...s, phase: 'reveal', reveal: payload }))
    }

    function onResult(payload: ResultInfo): void {
      setState((s) => ({ ...s, phase: 'result', result: payload }))
    }

    function onInterrupted(): void {
      setState((s) => ({
        ...s,
        interrupted: true,
        phase: 'lobby',
        privateWord: null,
        spectatorId: null,
        eliminated: [],
        lastElimination: null,
        clues: [],
        reveal: null,
        result: null,
      }))
    }

    socket.on('room:players', onPlayers)
    socket.on('game:settings', onSettings)
    socket.on('game:privateWord', onPrivateWord)
    socket.on('game:phase', onPhase)
    socket.on('game:voteUpdate', onVoteUpdate)
    socket.on('game:duelUpdate', onDuelUpdate)
    socket.on('game:elimination', onElimination)
    socket.on('game:clues', onClues)
    socket.on('game:reveal', onReveal)
    socket.on('game:result', onResult)
    socket.on('game:interrupted', onInterrupted)

    return () => {
      socket.off('room:players', onPlayers)
      socket.off('game:settings', onSettings)
      socket.off('game:privateWord', onPrivateWord)
      socket.off('game:phase', onPhase)
      socket.off('game:voteUpdate', onVoteUpdate)
      socket.off('game:duelUpdate', onDuelUpdate)
      socket.off('game:elimination', onElimination)
      socket.off('game:clues', onClues)
      socket.off('game:reveal', onReveal)
      socket.off('game:result', onResult)
      socket.off('game:interrupted', onInterrupted)
    }
  }, [socket])

  const createRoom = useCallback(
    (pseudo: string): Promise<{ roomCode?: string; error?: string }> =>
      new Promise((resolve) => {
        socket.emit('room:create', { pseudo }, (res: CreateRoomAck) => {
          if (res.error || !res.roomCode || !res.playerId) {
            setState((s) => ({ ...s, error: res.error ?? 'Erreur inconnue.' }))
            resolve({ error: res.error })
            return
          }
          setState((s) => ({ ...s, roomCode: res.roomCode!, playerId: res.playerId!, isHost: true, error: null }))
          resolve({ roomCode: res.roomCode })
        })
      }),
    [socket],
  )

  const joinRoom = useCallback(
    (roomCode: string, pseudo: string): Promise<AckError> =>
      new Promise((resolve) => {
        socket.emit('room:join', { roomCode, pseudo }, (res: JoinRoomAck) => {
          if (res.error || !res.playerId) {
            setState((s) => ({ ...s, error: res.error ?? 'Erreur inconnue.' }))
            resolve({ error: res.error })
            return
          }
          setState((s) => ({ ...s, roomCode, playerId: res.playerId!, isHost: false, error: null }))
          resolve({})
        })
      }),
    [socket],
  )

  const configure = useCallback(
    (roomCode: string, clueRounds: number): void => {
      socket.emit('game:configure', { roomCode, clueRounds })
    },
    [socket],
  )

  const start = useCallback(
    (roomCode: string, customWords?: CustomWords): Promise<AckError> =>
      new Promise((resolve) => {
        socket.emit('game:start', { roomCode, customWords }, (res: AckError) => {
          if (res.error) setState((s) => ({ ...s, error: res.error ?? null }))
          resolve(res)
        })
      }),
    [socket],
  )

  const clueDone = useCallback(
    (roomCode: string, hint?: string): void => {
      socket.emit('clue:done', { roomCode, hint })
    },
    [socket],
  )

  const castVote = useCallback(
    (roomCode: string, targetPlayerId: string): Promise<AckError> =>
      new Promise((resolve) => {
        socket.emit('vote:cast', { roomCode, targetPlayerId }, (res: AckError) => {
          setState((s) => (res.error ? { ...s, error: res.error ?? null } : { ...s, hasVoted: true }))
          resolve(res)
        })
      }),
    [socket],
  )

  const castPass = useCallback(
    (roomCode: string): Promise<AckError> =>
      new Promise((resolve) => {
        socket.emit('vote:pass', { roomCode }, (res: AckError) => {
          setState((s) => (res.error ? { ...s, error: res.error ?? null } : { ...s, hasVoted: true }))
          resolve(res)
        })
      }),
    [socket],
  )

  const castDuelGuess = useCallback(
    (roomCode: string, correct: boolean): Promise<AckError> =>
      new Promise((resolve) => {
        socket.emit('duel:guess', { roomCode, correct }, (res: AckError) => {
          setState((s) => (res.error ? { ...s, error: res.error ?? null } : { ...s, hasDuelGuessed: true }))
          resolve(res)
        })
      }),
    [socket],
  )

  const submitGuess = useCallback(
    (roomCode: string, guess: string): void => {
      socket.emit('intruder:guess', { roomCode, guess })
    },
    [socket],
  )

  const playAgain = useCallback(
    (roomCode: string, customWords?: CustomWords): Promise<AckError> =>
      new Promise((resolve) => {
        socket.emit('game:playAgain', { roomCode, customWords }, (res: AckError) => {
          if (res.error) setState((s) => ({ ...s, error: res.error ?? null }))
          resolve(res)
        })
      }),
    [socket],
  )

  const leaveRoom = useCallback(
    (roomCode: string): void => {
      socket.emit('room:leave', { roomCode })
      setState(initialIntruRoomState)
    },
    [socket],
  )

  const value: IntruRoomContextValue = {
    state,
    createRoom,
    joinRoom,
    configure,
    start,
    clueDone,
    castVote,
    castPass,
    castDuelGuess,
    submitGuess,
    playAgain,
    leaveRoom,
  }

  return <IntruRoomContext.Provider value={value}>{children}</IntruRoomContext.Provider>
}
