import { useEffect, useMemo, useRef } from 'react'
import { useAppSelector } from '../../app/hooks'
import { useMediasoupMedia } from '../mediasoup/MediasoupMediaProvider'
import { selectParticipants } from '../videoConference/videoConferenceSlice'
import './screenShareStage.css'

function liveVideoTrack(stream: MediaStream | null | undefined) {
  return stream?.getVideoTracks().find((t) => t.kind === 'video' && t.readyState === 'live')
}

export function ScreenShareStage() {
  const { remoteScreenStreams, localScreenStream, isScreenSharing } = useMediasoupMedia()
  const participants = useAppSelector(selectParticipants)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  const active = useMemo(() => {
    const remotePeerId = Object.keys(remoteScreenStreams).find((id) => {
      const stream = remoteScreenStreams[id]
      return Boolean(liveVideoTrack(stream))
    })
    if (remotePeerId) {
      const name = participants.find((p) => p.id === remotePeerId)?.name ?? 'Participant'
      return {
        stream: remoteScreenStreams[remotePeerId],
        label: `${name} is sharing their screen`,
        muted: false,
      }
    }
    if (isScreenSharing && localScreenStream && liveVideoTrack(localScreenStream)) {
      return {
        stream: localScreenStream,
        label: 'You are sharing your screen',
        muted: true,
      }
    }
    return null
  }, [remoteScreenStreams, localScreenStream, isScreenSharing, participants])

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.srcObject = active?.stream ?? null
    if (active?.stream) {
      void el.play().catch(() => undefined)
    }
  }, [active?.stream])

  useEffect(() => {
    const el = audioRef.current
    if (!el || !active?.stream || active.muted) {
      if (el) el.srcObject = null
      return
    }
    const audioTrack = active.stream.getAudioTracks().find((t) => t.readyState === 'live')
    if (!audioTrack) {
      el.srcObject = null
      return
    }
    el.srcObject = new MediaStream([audioTrack])
    void el.play().catch(() => undefined)
  }, [active])

  if (!active) return null

  return (
    <div className="meeting-content-stage">
      <div className="screen-share-stage" role="region" aria-label={active.label}>
        <div className="screen-share-stage__header">
          <span className="screen-share-stage__badge">Screen share</span>
          <span className="screen-share-stage__label">{active.label}</span>
        </div>
        <div className="screen-share-stage__body">
          <video
            ref={videoRef}
            className="screen-share-stage__video"
            autoPlay
            playsInline
            muted={active.muted}
          />
        </div>
        {!active.muted ? (
          <audio ref={audioRef} autoPlay playsInline className="screen-share-stage__audio" />
        ) : null}
      </div>
    </div>
  )
}
