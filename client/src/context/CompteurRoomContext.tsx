import { createContext, useCallback, useContext, useEffect, useRef, useState, type JSX, type ReactNode } from 'react'
import { useSocket } from './SocketContext'
import { getPlayerToken } from '../utils/playerToken'
import {
  type AckError,
  type CompteurMode,
  type CompteurPlayerInfo,
  type CompteurRoomState,
  type CompteurRoundRecord,
  initialCompteurRoomState,
} from '../components/games/compteur/types'

interface CreateRoomAck extends AckError {
  roomCode?: string
  playerId?: string
  isHost?: boolean
}

interface JoinRoomAck extends AckError {
  playerId?: string
  isHost?: boolean
  mode?: CompteurMode
}

interface ReclaimAck extends AckError {
  playerId?: string
  isHost?: boolean
  mode?: CompteurMode
}

interface AddPlayerAck extends AckError {
  playerId?: string
}

interface CompteurRoomContextValue {
  state: CompteurRoomState
  createRoom: (pseudo: string, mode: CompteurMode) => Promise<{ roomCode?: string; error?: string }>
  joinRoom: (roomCode: string, pseudo: string) => Promise<AckError>
  addPlayer: (roomCode: string, name: string) => Promise<AckError>
  addPoints: (roomCode: string, targetPlayerId: string, delta: number) => Promise<AckError>
  undoLastAction: (roomCode: string) => Promise<AckError>
  saveRound: (roomCode: string) => Promise<AckError>
  setStepSize: (stepSize: number) => void
  removePlayer: (roomCode: string, targetPlayerId: string) => Promise<AckError>
  leaveRoom: (roomCode: string) => void
}

const CompteurRoomContext = createContext<CompteurRoomContextValue | null>(null)

export function useCompteurRoom(): CompteurRoomContextValue {
  const ctx = useContext(CompteurRoomContext)
  if (!ctx) throw new Error('useCompteurRoom must be used within a CompteurRoomProvider')
  return ctx
}

/**
 * Holds the "Compteur de points" room state and socket listeners for the whole /compteur/*
 * subtree, so state created in the lobby (room code, isHost, mode) survives navigating to the
 * game screen — a plain per-component hook would reset to its initial state on that route change.
 */
export function CompteurRoomProvider({ children }: { children: ReactNode }): JSX.Element {
  const socket = useSocket()
  const [state, setState] = useState<CompteurRoomState>(initialCompteurRoomState)
  const roomCodeRef = useRef(state.roomCode)
  useEffect(() => {
    roomCodeRef.current = state.roomCode
  }, [state.roomCode])

  useEffect(() => {
    // Fires on every (re)connection, including the very first one. `socket.recovered` is only
    // true when Socket.IO managed to restore the exact same socket.id — the common case, already
    // handled server-side. Otherwise, if we still believe we're in a room, this socket.id is new
    // to the server: ask it to reclaim our spot via the token instead of sitting stuck on
    // whatever screen was last rendered before the connection dropped.
    function onConnect(): void {
      if (socket.recovered) return
      const roomCode = roomCodeRef.current
      if (!roomCode) return
      socket.emit('compteur:room:reclaim', { roomCode, token: getPlayerToken() }, (res: ReclaimAck) => {
        if (res.error || !res.playerId) {
          setState(initialCompteurRoomState)
          return
        }
        setState((s) => ({ ...s, playerId: res.playerId!, isHost: res.isHost ?? s.isHost, mode: res.mode ?? s.mode }))
      })
    }

    function onPlayers(payload: { players: CompteurPlayerInfo[]; mode: CompteurMode }): void {
      setState((s) => {
        const me = payload.players.find((p) => p.id === socket.id)
        return { ...s, players: payload.players, mode: payload.mode, isHost: me?.isHost ?? s.isHost }
      })
    }

    function onScores(payload: { scores: Record<string, number> }): void {
      setState((s) => ({ ...s, scores: payload.scores }))
    }

    function onRounds(payload: { rounds: CompteurRoundRecord[] }): void {
      setState((s) => ({ ...s, rounds: payload.rounds }))
    }

    function onRemoved(): void {
      setState(initialCompteurRoomState)
    }

    function onPlayerLeft(payload: { playerId: string; pseudo: string }): void {
      const notice = `${payload.pseudo} a quitté la partie.`
      setState((s) => ({ ...s, notice }))
      setTimeout(() => setState((s) => (s.notice === notice ? { ...s, notice: null } : s)), 4000)
    }

    socket.on('connect', onConnect)
    socket.on('compteur:room:players', onPlayers)
    socket.on('compteur:score:update', onScores)
    socket.on('compteur:rounds:update', onRounds)
    socket.on('compteur:room:removed', onRemoved)
    socket.on('compteur:room:playerLeft', onPlayerLeft)

    return () => {
      socket.off('connect', onConnect)
      socket.off('compteur:room:players', onPlayers)
      socket.off('compteur:score:update', onScores)
      socket.off('compteur:rounds:update', onRounds)
      socket.off('compteur:room:removed', onRemoved)
      socket.off('compteur:room:playerLeft', onPlayerLeft)
    }
  }, [socket])

  const createRoom = useCallback(
    (pseudo: string, mode: CompteurMode): Promise<{ roomCode?: string; error?: string }> =>
      new Promise((resolve) => {
        socket.emit('compteur:room:create', { pseudo, mode, token: getPlayerToken() }, (res: CreateRoomAck) => {
          if (res.error || !res.roomCode || !res.playerId) {
            setState((s) => ({ ...s, error: res.error ?? 'Erreur inconnue.' }))
            resolve({ error: res.error })
            return
          }
          setState(() => ({
            ...initialCompteurRoomState,
            roomCode: res.roomCode!,
            playerId: res.playerId!,
            isHost: true,
            mode,
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
        socket.emit('compteur:room:join', { roomCode, pseudo, token: getPlayerToken() }, (res: JoinRoomAck) => {
          if (res.error || !res.playerId) {
            setState((s) => ({ ...s, error: res.error ?? 'Erreur inconnue.' }))
            resolve({ error: res.error })
            return
          }
          setState(() => ({
            ...initialCompteurRoomState,
            roomCode,
            playerId: res.playerId!,
            isHost: false,
            mode: res.mode ?? 'host',
            error: null,
          }))
          resolve({})
        })
      }),
    [socket],
  )

  const addPlayer = useCallback(
    (roomCode: string, name: string): Promise<AckError> =>
      new Promise((resolve) => {
        socket.emit('compteur:player:add', { roomCode, name }, (res: AddPlayerAck) => {
          if (res.error) setState((s) => ({ ...s, error: res.error ?? null }))
          resolve(res)
        })
      }),
    [socket],
  )

  const addPoints = useCallback(
    (roomCode: string, targetPlayerId: string, delta: number): Promise<AckError> =>
      new Promise((resolve) => {
        socket.emit('compteur:score:add', { roomCode, targetPlayerId, delta }, (res: AckError) => {
          if (res.error) setState((s) => ({ ...s, error: res.error ?? null }))
          resolve(res)
        })
      }),
    [socket],
  )

  const undoLastAction = useCallback(
    (roomCode: string): Promise<AckError> =>
      new Promise((resolve) => {
        socket.emit('compteur:score:undo', { roomCode }, (res: AckError) => {
          if (res.error) setState((s) => ({ ...s, error: res.error ?? null }))
          resolve(res)
        })
      }),
    [socket],
  )

  const saveRound = useCallback(
    (roomCode: string): Promise<AckError> =>
      new Promise((resolve) => {
        socket.emit('compteur:round:save', { roomCode }, (res: AckError) => {
          if (res.error) setState((s) => ({ ...s, error: res.error ?? null }))
          resolve(res)
        })
      }),
    [socket],
  )

  const setStepSize = useCallback((stepSize: number): void => {
    setState((s) => ({ ...s, stepSize }))
  }, [])

  const removePlayer = useCallback(
    (roomCode: string, targetPlayerId: string): Promise<AckError> =>
      new Promise((resolve) => {
        socket.emit('compteur:player:remove', { roomCode, targetPlayerId }, (res: AckError) => {
          if (res.error) setState((s) => ({ ...s, error: res.error ?? null }))
          resolve(res)
        })
      }),
    [socket],
  )

  const leaveRoom = useCallback(
    (roomCode: string): void => {
      socket.emit('compteur:room:leave', { roomCode })
      setState(initialCompteurRoomState)
    },
    [socket],
  )

  const value: CompteurRoomContextValue = {
    state,
    createRoom,
    joinRoom,
    addPlayer,
    addPoints,
    undoLastAction,
    saveRound,
    setStepSize,
    removePlayer,
    leaveRoom,
  }

  return <CompteurRoomContext.Provider value={value}>{children}</CompteurRoomContext.Provider>
}
