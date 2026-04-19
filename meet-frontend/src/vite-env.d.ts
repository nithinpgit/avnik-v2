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
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
