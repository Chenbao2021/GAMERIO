import { createContext, useContext, useMemo, type JSX, type ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'

const SocketContext = createContext<Socket | null>(null)

export function useSocket(): Socket {
  const socket = useContext(SocketContext)
  if (!socket) throw new Error('useSocket must be used within a SocketProvider')
  return socket
}

// Module-level singleton so React StrictMode's double-invoke of effects/renders
// never opens a second connection, and any future game reuses the same socket.
let socketSingleton: Socket | null = null

function getSocket(): Socket {
  if (!socketSingleton) {
    socketSingleton = io(import.meta.env.VITE_SOCKET_URL as string)
  }
  return socketSingleton
}

export function SocketProvider({ children }: { children: ReactNode }): JSX.Element {
  const socket = useMemo(getSocket, [])
  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
}
