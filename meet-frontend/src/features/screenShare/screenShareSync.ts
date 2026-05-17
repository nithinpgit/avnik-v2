export const SCREEN_SHARE_SYNC_CHANNEL = 'screen_share'

export type ScreenShareSyncPayload = {
  active: boolean
  presenterId: string | null
  presenterName?: string
}

export function parseScreenShareSync(payload: unknown): ScreenShareSyncPayload | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  if (typeof p.active !== 'boolean') return null
  const presenterId =
    p.active && typeof p.presenterId === 'string' && p.presenterId.length > 0
      ? p.presenterId
      : null
  return {
    active: p.active,
    presenterId,
    presenterName: typeof p.presenterName === 'string' ? p.presenterName : undefined,
  }
}
