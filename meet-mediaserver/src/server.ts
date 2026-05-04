import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { createServer } from 'node:http'
import type { RawData, WebSocket } from 'ws'
import { WebSocketServer } from 'ws'
import { parseTokenFromRequest, verifyMediaToken } from './auth.js'
import { config } from './config.js'
import { logger } from './logger.js'
import { RoomManager } from './roomManager.js'
import { handleClientMessage } from './signaling.js'

export async function startServer(): Promise<void> {
  const roomManager = new RoomManager()

  const app = express()
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(cors({ origin: true, credentials: true }))
  app.use(express.json({ limit: '512kb' }))

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'meet-mediaserver', ts: new Date().toISOString() })
  })

  const httpServer = createServer(app)

  const wss = new WebSocketServer({
    noServer: true,
    verifyClient: (info, cb) => {
      const token = parseTokenFromRequest(info.req)
      if (!token) {
        cb(false, 401, 'Unauthorized')
        return
      }
      try {
        verifyMediaToken(token)
        cb(true)
      } catch {
        cb(false, 401, 'Unauthorized')
      }
    },
  })

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const host = request.headers.host ?? '127.0.0.1'
      const pathname = new URL(request.url ?? '/', `http://${host}`).pathname
      if (pathname !== '/ws') {
        socket.destroy()
        return
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request)
      })
    } catch {
      socket.destroy()
    }
  })

  wss.on('connection', async (ws: WebSocket, req) => {
    const token = parseTokenFromRequest(req)
    if (!token) {
      ws.close(4001, 'missing token')
      return
    }
    let payload: { roomId: string; peerId: string; name?: string }
    try {
      payload = verifyMediaToken(token)
    } catch {
      ws.close(4002, 'invalid token')
      return
    }

    const { roomId, peerId, name } = payload
    const room = await roomManager.getOrCreateRoom(roomId)

    const send = (o: Record<string, unknown>) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(o))
      }
    }

    room.addPeer(peerId, name ?? peerId, send)

    const onMessage = async (data: RawData) => {
      try {
        const raw = JSON.parse(String(data)) as unknown
        await handleClientMessage(room, peerId, raw, send)
      } catch (e) {
        logger.warn({ err: String(e), peerId }, 'invalid ws message')
        send({ t: 'error', ok: false, error: 'invalid json' })
      }
    }

    ws.on('message', (d) => {
      void onMessage(d)
    })

    ws.on('close', () => {
      room.removePeer(peerId)
    })

    ws.on('error', (err) => {
      logger.warn({ err: String(err), peerId }, 'ws error')
    })

    send({ t: 'ready', ok: true, data: { roomId, peerId } })
  })

  await new Promise<void>((resolve, reject) => {
    httpServer.listen(config.httpPort, '0.0.0.0', () => resolve())
    httpServer.on('error', reject)
  })

  logger.info({ port: config.httpPort }, 'meet-mediaserver listening (HTTP + WS /ws)')
}
