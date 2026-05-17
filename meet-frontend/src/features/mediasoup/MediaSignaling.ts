type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void }

export class MediaSignaling {
  private nextReq = 1
  private readonly pending = new Map<number, Pending>()
  private readonly pushListeners = new Set<(msg: Record<string, unknown>) => void>()

  constructor(private readonly ws: WebSocket) {
    this.ws.addEventListener('message', this.onMessage)
  }

  dispose(): void {
    this.ws.removeEventListener('message', this.onMessage)
    this.pending.clear()
    this.pushListeners.clear()
  }

  onPush(cb: (msg: Record<string, unknown>) => void): () => void {
    this.pushListeners.add(cb)
    return () => {
      this.pushListeners.delete(cb)
    }
  }

  private readonly onMessage = (ev: MessageEvent): void => {
    let msg: Record<string, unknown>
    try {
      msg = JSON.parse(String(ev.data)) as Record<string, unknown>
    } catch {
      return
    }
    const req = msg.req as number | undefined
    if (req != null) {
      const p = this.pending.get(req)
      if (!p) return
      this.pending.delete(req)
      if (msg.ok === true) {
        p.resolve(msg.data)
      } else {
        p.reject(new Error(String(msg.error ?? 'media signaling error')))
      }
      return
    }
    // Server-initiated pushes (no req): newProducer, producerClosed, …
    this.pushListeners.forEach((l) => l(msg))
  }

  request(t: string, d?: unknown): Promise<unknown> {
    const req = this.nextReq++
    return new Promise((resolve, reject) => {
      this.pending.set(req, { resolve, reject })
      this.ws.send(JSON.stringify({ t, req, d }))
    })
  }

  static async waitReady(ws: WebSocket): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const to = window.setTimeout(() => reject(new Error('media ws ready timeout')), 15_000)
      const onMsg = (ev: MessageEvent) => {
        try {
          const msg = JSON.parse(String(ev.data)) as { t?: string }
          if (msg.t === 'ready') {
            window.clearTimeout(to)
            ws.removeEventListener('message', onMsg)
            resolve()
          }
        } catch {
          /* ignore */
        }
      }
      ws.addEventListener('message', onMsg)
    })
  }
}
