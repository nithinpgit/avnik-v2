import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppSelector } from '../../app/hooks'
import { useMediasoupMedia } from '../mediasoup/MediasoupMediaProvider'
import { selectMeetingUserId } from '../meetingSession/meetingSessionSlice'
import { selectParticipants } from '../videoConference/videoConferenceSlice'
import { IconScreenShare } from '../videoConference/MeetingIcons'
import { selectVideoShareVisible } from '../videoShare/videoShareSlice'
import { selectScreenShareSync } from './selectScreenShareSync'
import './screenShareStage.css'

function clearVideoElement(el: HTMLVideoElement | null) {
  if (!el) return
  el.pause()
  el.srcObject = null
  el.removeAttribute('src')
  el.load()
}

function liveScreenVideoTrack(stream: MediaStream | null | undefined) {
  return stream?.getVideoTracks().find((t) => t.kind === 'video' && t.readyState === 'live')
}

type LocalScreenSharePanelProps = {
  screenStream: MediaStream | null
  onStop: () => void
}

function LocalScreenSharePanel({ screenStream, onStop }: LocalScreenSharePanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stopping, setStopping] = useState(false)
  const screenTrack = liveScreenVideoTrack(screenStream)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    if (screenTrack) {
      el.srcObject = new MediaStream([screenTrack])
      void el.play().catch(() => undefined)
      return () => clearVideoElement(el)
    }
    clearVideoElement(el)
    return undefined
  }, [screenTrack, screenStream])

  const handleStop = () => {
    if (stopping) return
    setStopping(true)
    onStop()
    window.setTimeout(() => setStopping(false), 600)
  }

  return (
    <div className="meeting-content-stage meeting-content-stage--local-presenter">
      <div className="screen-share-local-card" role="region" aria-label="You are sharing your screen">
        <div className="screen-share-local-card__preview" aria-hidden>
          {screenTrack ? (
            <video ref={videoRef} className="screen-share-local-card__video" autoPlay playsInline muted />
          ) : (
            <div className="screen-share-local-card__placeholder">
              <IconScreenShare size={42} />
            </div>
          )}
          <span className="screen-share-local-card__live-dot" title="Sharing" />
        </div>
        <h2 className="screen-share-local-card__title">You are sharing your screen</h2>
        <p className="screen-share-local-card__hint">Others in the meeting can see your screen.</p>
        <button
          type="button"
          className="screen-share-local-card__stop"
          onClick={handleStop}
          disabled={stopping}
        >
          {stopping ? 'Stopping…' : 'Stop screen share'}
        </button>
      </div>
    </div>
  )
}

type RemoteScreenShareStageProps = {
  stream: MediaStream
  label: string
  streamKey: string
}

function RemoteScreenShareStage({ stream, label, streamKey }: RemoteScreenShareStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.srcObject = stream
    void el.play().catch(() => undefined)
    return () => clearVideoElement(el)
  }, [stream])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const audioTrack = stream.getAudioTracks().find((t) => t.readyState === 'live')
    if (!audioTrack) {
      el.srcObject = null
      return
    }
    el.srcObject = new MediaStream([audioTrack])
    void el.play().catch(() => undefined)
    return () => {
      el.pause()
      el.srcObject = null
    }
  }, [stream])

  return (
    <div className="meeting-content-stage">
      <div className="screen-share-stage" role="region" aria-label={label}>
        <div className="screen-share-stage__header">
          <span className="screen-share-stage__badge">Screen share</span>
          <span className="screen-share-stage__label">{label}</span>
        </div>
        <div className="screen-share-stage__body">
          <video
            key={streamKey}
            ref={videoRef}
            className="screen-share-stage__video"
            autoPlay
            playsInline
          />
        </div>
        <audio ref={audioRef} autoPlay playsInline className="screen-share-stage__audio" />
      </div>
    </div>
  )
}

export function ScreenShareStage() {
  const { remoteScreenStreams, localScreenStream, isScreenSharing, stopScreenShare } =
    useMediasoupMedia()
  const videoShareActive = useAppSelector(selectVideoShareVisible)
  const screenShareSync = useAppSelector(selectScreenShareSync)
  const userId = useAppSelector(selectMeetingUserId)
  const participants = useAppSelector(selectParticipants)

  const remoteView = useMemo(() => {
    const remotePresenterId =
      screenShareSync?.active &&
      screenShareSync.presenterId &&
      screenShareSync.presenterId !== userId
        ? screenShareSync.presenterId
        : null

    if (!remotePresenterId) return null

    const stream = remoteScreenStreams[remotePresenterId]
    if (!stream) return null

    const name =
      screenShareSync?.presenterName ??
      participants.find((p) => p.id === remotePresenterId)?.name ??
      'Participant'

    return {
      stream,
      label: `${name} is sharing their screen`,
      key: `remote-${remotePresenterId}`,
    }
  }, [screenShareSync, userId, remoteScreenStreams, participants])

  const isLocalPresenter =
    isScreenSharing &&
    (screenShareSync?.active !== false || screenShareSync?.presenterId === userId)

  if (videoShareActive) {
    return null
  }

  if (isLocalPresenter) {
    return <LocalScreenSharePanel screenStream={localScreenStream} onStop={stopScreenShare} />
  }

  if (remoteView) {
    return (
      <RemoteScreenShareStage
        stream={remoteView.stream}
        label={remoteView.label}
        streamKey={remoteView.key}
      />
    )
  }

  return null
}
