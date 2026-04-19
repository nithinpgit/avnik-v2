import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

/**
 * Lightweight request correlation for logs and future auth auditing.
 */
export function httpRequestContextMiddleware(req: Request, res: Response, next: NextFunction) {
  const fromHeader = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'].trim() : ''
  const id = fromHeader || randomUUID()
  res.setHeader('x-request-id', id)
  ;(req as Request & { requestId: string }).requestId = id
  next()
}
