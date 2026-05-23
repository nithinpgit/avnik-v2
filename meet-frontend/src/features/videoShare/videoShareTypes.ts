export const VIDEO_SHARE_CHANNEL = 'video_share'

export type VideoShareSource = 'file' | 'youtube'

export type VideoShareSyncPayload = {
  active: boolean
  source: VideoShareSource
  fileId: string
  fileUrl: string
  originalName: string
  extension: string
  youtubeVideoId?: string
  currentTimeSec: number
  isPlaying: boolean
  durationSec: number
}

export function parseVideoSharePayload(raw: unknown): VideoShareSyncPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.active === false) return null
  if (typeof o.fileId !== 'string' || typeof o.fileUrl !== 'string') return null
  const source: VideoShareSource = o.source === 'youtube' ? 'youtube' : 'file'
  return {
    active: true,
    source,
    fileId: o.fileId,
    fileUrl: o.fileUrl,
    originalName: typeof o.originalName === 'string' ? o.originalName : 'Video',
    extension: typeof o.extension === 'string' ? o.extension : '',
    youtubeVideoId: typeof o.youtubeVideoId === 'string' ? o.youtubeVideoId : undefined,
    currentTimeSec: typeof o.currentTimeSec === 'number' ? o.currentTimeSec : 0,
    isPlaying: o.isPlaying !== false,
    durationSec: typeof o.durationSec === 'number' ? o.durationSec : 0,
  }
}

export function isVideoLibraryExtension(ext: string): boolean {
  const e = ext.toLowerCase()
  return e === 'mp4' || e === 'youtube'
}

export function videoShareSourceFromFile(extension: string): VideoShareSource {
  return extension.toLowerCase() === 'youtube' ? 'youtube' : 'file'
}

export function youtubeIdFromFile(extension: string, storedName: string): string | undefined {
  return extension.toLowerCase() === 'youtube' ? storedName : undefined
}
