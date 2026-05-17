import type { PresentationSyncPayload } from '../documents/presentationTypes'

/** Base whiteboard when no document is shared. */
export const WHITEBOARD_PAGE_KEY_BASE = '0'

const LEGACY_WHITEBOARD_CHANNEL = 'whiteboard'

export function getWhiteboardPageKey(presentation: PresentationSyncPayload | null | undefined): string {
  if (!presentation?.active) {
    return WHITEBOARD_PAGE_KEY_BASE
  }
  return `${presentation.fileId}_p_${presentation.currentPage}`
}

/** Room sync channels must match backend: /^[a-z][a-z0-9_]*$/ (no hyphens). */
function toSyncChannelSegment(value: string): string {
  return value.replace(/[^a-z0-9_]/gi, '_').toLowerCase()
}

export function getWhiteboardSyncChannel(pageKey: string): string {
  if (pageKey === WHITEBOARD_PAGE_KEY_BASE) {
    return 'whiteboard_p_0'
  }
  return `whiteboard_p_${toSyncChannelSegment(pageKey)}`
}

export function resolveWhiteboardChannelPayload(
  channels: Record<string, unknown>,
  pageKey: string,
): unknown {
  const channel = getWhiteboardSyncChannel(pageKey)
  if (channels[channel] !== undefined && channels[channel] !== null) {
    return channels[channel]
  }
  if (pageKey === WHITEBOARD_PAGE_KEY_BASE && channels[LEGACY_WHITEBOARD_CHANNEL] != null) {
    return channels[LEGACY_WHITEBOARD_CHANNEL]
  }
  return null
}
