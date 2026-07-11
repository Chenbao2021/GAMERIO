import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useSocket } from '../../../context/SocketContext'
import './DrawCanvas.less'

interface Props {
  roomCode: string
  interactive: boolean
}

export interface DrawCanvasHandle {
  clear: () => void
}

interface Point {
  x: number
  y: number
}

const STROKE_COLOR = '#2d2d2d'
const STROKE_WIDTH = 4
const EMIT_INTERVAL_MS = 30 // caps how often points hit the network, local drawing stays smooth

// Freehand canvas shared between the drawer (captures pointer input, emits normalized 0-1
// coordinates so it works across any phone screen size) and everyone else (read-only, just
// renders whatever the drawer emits). No React state is involved in the hot path — every point
// would otherwise trigger a re-render, which is the kind of jank this component exists to avoid.
const DrawCanvas = forwardRef<DrawCanvasHandle, Props>(function DrawCanvas({ roomCode, interactive }, ref) {
  const socket = useSocket()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const isDrawingRef = useRef(false)
  const lastPointRef = useRef<Point | null>(null)
  const lastEmitRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = STROKE_COLOR
    ctx.lineWidth = STROKE_WIDTH
    ctxRef.current = ctx
  }, [])

  function normalizedPoint(clientX: number, clientY: number): Point {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height }
  }

  function drawSegment(from: Point | null, to: Point): void {
    const ctx = ctxRef.current
    const canvas = canvasRef.current
    if (!ctx || !canvas) return
    const rect = canvas.getBoundingClientRect()
    const origin = from ?? to
    ctx.beginPath()
    ctx.moveTo(origin.x * rect.width, origin.y * rect.height)
    ctx.lineTo(to.x * rect.width, to.y * rect.height)
    ctx.stroke()
  }

  function clearCanvas(): void {
    const ctx = ctxRef.current
    const canvas = canvasRef.current
    if (!ctx || !canvas) return
    const rect = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width, rect.height)
  }

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        clearCanvas()
        socket.emit('draw:clear', { roomCode })
      },
    }),
    [socket, roomCode],
  )

  // Read-only mode: render whatever the drawer streams in.
  useEffect(() => {
    if (interactive) return

    function onStart(payload: Point): void {
      lastPointRef.current = payload
      drawSegment(null, payload)
    }
    function onPoint(payload: Point): void {
      drawSegment(lastPointRef.current, payload)
      lastPointRef.current = payload
    }
    function onEnd(): void {
      lastPointRef.current = null
    }
    function onClear(): void {
      clearCanvas()
      lastPointRef.current = null
    }

    socket.on('draw:stroke:start', onStart)
    socket.on('draw:stroke:point', onPoint)
    socket.on('draw:stroke:end', onEnd)
    socket.on('draw:clear', onClear)
    return () => {
      socket.off('draw:stroke:start', onStart)
      socket.off('draw:stroke:point', onPoint)
      socket.off('draw:stroke:end', onEnd)
      socket.off('draw:clear', onClear)
    }
  }, [socket, interactive])

  function handlePointerDown(e: ReactPointerEvent<HTMLCanvasElement>): void {
    if (!interactive) return
    e.preventDefault()
    isDrawingRef.current = true
    const point = normalizedPoint(e.clientX, e.clientY)
    lastPointRef.current = point
    lastEmitRef.current = performance.now()
    drawSegment(null, point)
    socket.emit('draw:stroke:start', { roomCode, x: point.x, y: point.y })
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLCanvasElement>): void {
    if (!interactive || !isDrawingRef.current) return
    e.preventDefault()
    const point = normalizedPoint(e.clientX, e.clientY)
    drawSegment(lastPointRef.current, point)
    lastPointRef.current = point

    const now = performance.now()
    if (now - lastEmitRef.current < EMIT_INTERVAL_MS) return
    lastEmitRef.current = now
    socket.emit('draw:stroke:point', { roomCode, x: point.x, y: point.y })
  }

  function handlePointerUp(): void {
    if (!interactive || !isDrawingRef.current) return
    isDrawingRef.current = false
    lastPointRef.current = null
    socket.emit('draw:stroke:end', { roomCode })
  }

  return (
    <canvas
      ref={canvasRef}
      className={`draw-canvas${interactive ? ' draw-canvas--interactive' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  )
})

export default DrawCanvas
