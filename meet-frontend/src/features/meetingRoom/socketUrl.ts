/**
 * Resolves the Socket.IO / API origin.
 *
 * - **Production** (built SPA behind nginx on same host): return `undefined` so the client uses
 *   same origin + `/socket.io` (proxied by nginx to Nest).
 * - **Vite dev**: default to `http(s)://<current-host>:<port>` so Socket.IO hits Nest directly.
 *   Proxying WebSockets through Vite for `/socket.io` is unreliable; bypass avoids failed upgrades.
 */
export function resolveMeetingSocketUrl(): string | undefined {
  const explicit = import.meta.env.VITE_MEETING_API_URL?.trim()
  if (explicit) {
    return explicit.replace(/\/$/, '')
  }
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const port = import.meta.env.VITE_MEETING_API_PORT?.trim() || '3000'
    return `${window.location.protocol}//${window.location.hostname}:${port}`
  }
  return undefined
}
