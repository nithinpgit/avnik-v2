import jwt from 'jsonwebtoken'
import type { IncomingMessage } from 'node:http'
import { config } from './config.js'

export type MediaTokenPayload = {
  roomId: string
  peerId: string
  name?: string
}

export function parseTokenFromRequest(req: IncomingMessage): string | null {
  try {
    const host = req.headers.host ?? '127.0.0.1'
    const u = new URL(req.url ?? '/', `http://${host}`)
    return u.searchParams.get('token')
  } catch {
    return null
  }
}

export function verifyMediaToken(token: string): MediaTokenPayload {
  const decoded = jwt.verify(token, config.mediaJwtSecret)
  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('invalid token payload')
  }
  const { roomId, peerId, name } = decoded as Record<string, unknown>
  if (typeof roomId !== 'string' || typeof peerId !== 'string') {
    throw new Error('invalid token fields')
  }
  return { roomId, peerId, name: typeof name === 'string' ? name : undefined }
}
