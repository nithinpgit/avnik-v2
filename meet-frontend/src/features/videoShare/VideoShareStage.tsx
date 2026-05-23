import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppSelector } from '../../app/hooks'
import { resolveFileAssetUrl } from '../documents/documentsApi'
import { useIsMeetingHost } from '../meeting/useIsMeetingHost'
import { selectActiveVideoShare } from './videoShareSlice'
import type { VideoShareSyncPayload } from './videoShareTypes'
import { youtubeEmbedUrl } from './youtubeUtils'
import { useVideoShareSync } from './useVideoShareSync'
import './videoShareStage.css'

const SYNC_INTERVAL_MS = 2000
const DRIFT_THRESHOLD_SEC = 0.75

type Mp4PlayerProps = {
  src: string
  sync: VideoShareSyncPayload
  isHost: boolean
  onSync: (patch: Partial<VideoShareSyncPayload>) => void
}

function Mp4Player({ src, sync, isHost, onSync }: Mp4PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastEmitRef = useRef(0)
  const applyingRemoteRef = useRef(false)

  useEffect(() => {
    if (isHost) return
    const el = videoRef.current
    if (!el) return

    applyingRemoteRef.current = true
    const drift = Math.abs(el.currentTime - sync.currentTimeSec)
    if (drift > DRIFT_THRESHOLD_SEC) {
      el.currentTime = sync.currentTimeSec
    }
    if (sync.isPlaying && el.paused) {
      void el.play().catch(() => undefined)
    } else if (!sync.isPlaying && !el.paused) {
      el.pause()
    }
    window.setTimeout(() => {
      applyingRemoteRef.current = false
    }, 100)
  }, [isHost, sync.currentTimeSec, sync.isPlaying])

  const emitState = useCallback(() => {
    const el = videoRef.current
    if (!el || !isHost || applyingRemoteRef.current) return
    const now = Date.now()
    if (now - lastEmitRef.current < SYNC_INTERVAL_MS) return
    lastEmitRef.current = now
    onSync({
      currentTimeSec: el.currentTime,
      isPlaying: !el.paused,
      durationSec: Number.isFinite(el.duration) ? el.duration : sync.durationSec,
    })
  }, [isHost, onSync, sync.durationSec])

  const onPlay = () => {
    if (!isHost) return
    onSync({ isPlaying: true, currentTimeSec: videoRef.current?.currentTime ?? 0 })
  }

  const onPause = () => {
    if (!isHost) return
    onSync({ isPlaying: false, currentTimeSec: videoRef.current?.currentTime ?? 0 })
  }

  const onSeeked = () => {
    if (!isHost) return
    const el = videoRef.current
    if (!el) return
    onSync({
      currentTimeSec: el.currentTime,
      isPlaying: !el.paused,
      durationSec: Number.isFinite(el.duration) ? el.duration : sync.durationSec,
    })
  }

  return (
    <div className="video-share-media-host">
      <video
        ref={videoRef}
        className="video-share-stage__media"
        src={resolveFileAssetUrl(src)}
        playsInline
        controls={isHost}
        autoPlay={sync.isPlaying}
        onPlay={onPlay}
        onPause={onPause}
        onSeeked={onSeeked}
        onTimeUpdate={emitState}
      />
    </div>
  )
}

type YoutubePlayerProps = {
  videoId: string
  sync: VideoShareSyncPayload
  isHost: boolean
}

function YoutubePlayer({ videoId, sync, isHost }: YoutubePlayerProps) {
  const [embedSrc, setEmbedSrc] = useState(() =>
    youtubeEmbedUrl(videoId, sync.currentTimeSec, sync.isPlaying),
  )
  const lastKeyRef = useRef('')

  useEffect(() => {
    if (isHost) return
    const key = `${Math.floor(sync.currentTimeSec)}-${sync.isPlaying ? 1 : 0}`
    if (key === lastKeyRef.current) return
    lastKeyRef.current = key
    setEmbedSrc(youtubeEmbedUrl(videoId, sync.currentTimeSec, sync.isPlaying))
  }, [isHost, sync.currentTimeSec, sync.isPlaying, videoId])

  return (
    <div className="video-share-youtube-host">
      <iframe
        className="video-share-stage__youtube"
        title={sync.originalName}
        src={embedSrc}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}

export function VideoShareStage() {
  const video = useAppSelector(selectActiveVideoShare)
  const isHost = useIsMeetingHost()
  const { closeVideoShare, patchVideoShare } = useVideoShareSync()

  if (!video?.active) return null

  const resolvedYoutubeId =
    video.source === 'youtube' && video.youtubeVideoId && /^[a-zA-Z0-9_-]{11}$/.test(video.youtubeVideoId)
      ? video.youtubeVideoId
      : null

  return (
    <div
      className="meeting-content-stage video-share-stage"
      role="region"
      aria-label={`Shared video: ${video.originalName}`}
    >
      {isHost ? (
        <button
          type="button"
          className="video-share-close-btn meeting-tooltip meeting-tooltip--bottom"
          data-tooltip="Close video"
          aria-label="Close shared video"
          onClick={closeVideoShare}
        >
          ×
        </button>
      ) : null}
      <div className="video-share-layer">
        <div className="video-share-slide-wrap">
          {video.source === 'youtube' && resolvedYoutubeId ? (
            <YoutubePlayer videoId={resolvedYoutubeId} sync={video} isHost={isHost} />
          ) : (
            <Mp4Player
              src={video.fileUrl}
              sync={video}
              isHost={isHost}
              onSync={patchVideoShare}
            />
          )}
        </div>
      </div>
    </div>
  )
}
