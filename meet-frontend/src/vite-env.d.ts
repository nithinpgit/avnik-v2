/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Optional absolute origin for Socket.IO / API (e.g. `http://localhost:3000`).
   * In **production** leave unset so the browser uses the same origin (nginx proxies `/socket.io`).
   * In **Vite dev**, if unset, the client connects to `http://<host>:VITE_MEETING_API_PORT` (default `3000`)
   * to avoid WebSocket issues when proxying through Vite.
   */
  readonly VITE_MEETING_API_URL?: string
  /** API port on the same hostname as the page (dev only; default `3000`). Ignored if `VITE_MEETING_API_URL` is set. */
  readonly VITE_MEETING_API_PORT?: string
  /**
   * WebSocket base URL for meet-mediaserver (no path; `/ws` is appended).
   * Example: `ws://localhost:3001` or `wss://media.example.com`.
   */
  readonly VITE_MEDIA_WS_URL?: string
  /** Dev-only: mediaserver port on same hostname when `VITE_MEDIA_WS_URL` is unset (default `3001`). */
  readonly VITE_MEDIA_SERVER_PORT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
