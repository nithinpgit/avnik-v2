/**
 * WebSocket URL for meet-mediaserver signaling (`/ws` path appended by caller).
 * Dev: ws://<host>:3001 (override with VITE_MEDIA_WS_URL, e.g. wss://media.example.com).
 * Prod: same-origin ws(s) if unset (reverse-proxy /ws to mediaserver).
 */
export function resolveMediaWsBaseUrl(): string {
  const explicit = import.meta.env.VITE_MEDIA_WS_URL?.trim()
  if (explicit) {
    return explicit.replace(/\/$/, '')
  }
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const p = (import.meta.env.VITE_MEDIA_SERVER_PORT as string | undefined)?.trim() || '3001'
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.hostname}:${p}`
  }
  const proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost'
  return `${proto}//${host}`
}
