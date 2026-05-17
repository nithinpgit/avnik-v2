import { useEffect, useMemo, useRef } from 'react'
import { useAppSelector } from '../../app/hooks'
import { useMediasoupMedia } from '../mediasoup/MediasoupMediaProvider'
import { selectMeetingUserId } from '../meetingSession/meetingSessionSlice'
import { selectParticipants } from '../videoConference/videoConferenceSlice'
import { selectScreenShareSync } from './selectScreenShareSync'
import './screenShareStage.css'

function clearVideoElement(el: HTMLVideoElement | null) {
  if (!el) return
  el.pause()
  el.srcObject = null
  el.removeAttribute('src')
  el.load()
}

export function ScreenShareStage() {
  const { remoteScreenStreams, localScreenStream, isScreenSharing } = useMediasoupMedia()
  const screenShareSync = useAppSelector(selectScreenShareSync)
  const userId = useAppSelector(selectMeetingUserId)
  const participants = useAppSelector(selectParticipants)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  const active = useMemo(() => {
    const remotePresenterId =
      screenShareSync?.active &&
      screenShareSync.presenterId &&
      screenShareSync.presenterId !== userId
        ? screenShareSync.presenterId
        : null

    if (remotePresenterId) {
      const stream = remoteScreenStreams[remotePresenterId]
      if (!stream) return null
      const name =
        screenShareSync?.presenterName ??
        participants.find((p) => p.id === remotePresenterId)?.name ??
        'Participant'
      return {
        key: `remote-${remotePresenterId}`,
        stream,
        label: `${name} is sharing their screen`,
        muted: false,
      }
    }

    const localSharing =
      isScreenSharing &&
      localScreenStream &&
      (screenShareSync?.active !== false || screenShareSync?.presenterId === userId)

    if (localSharing) {
      return {
        key: 'local-screen',
        stream: localScreenStream,
        label: 'You are sharing your screen',
        muted: true,
      }
    }

    return null
  }, [
    screenShareSync,
    userId,
    remoteScreenStreams,
    localScreenStream,
    isScreenSharing,
    participants,
  ])

  useEffect(() => {
    const el = videoRef.current
    if (!active?.stream) {
      clearVideoElement(el)
      return
    }
    el.srcObject = active.stream
    void el.play().catch(() => undefined)
    return () => clearVideoElement(el)
  }, [active])

  useEffect(() => {
    const el = audioRef.current
    if (!el || !active?.stream || active.muted) {
      if (el) {
        el.pause()
        el.srcObject = null
      }
      return
    }
    const audioTrack = active.stream.getAudioTracks().find((t) => t.readyState === 'live')
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
            key={active.key}
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
