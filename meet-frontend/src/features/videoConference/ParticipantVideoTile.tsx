import { useEffect, useMemo, useRef } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { selectIsMeetingLive } from '../meeting/meetingLifecycleSlice'
import { useIsMeetingHost } from '../meeting/useIsMeetingHost'
import { useMediasoupMedia } from '../mediasoup/MediasoupMediaProvider'
import {
  useParticipantModeration,
  useParticipantModerationState,
} from '../participantControls/useParticipantModeration'
import {
  closeParticipantMenu,
  selectCameraStatus,
  selectLocalParticipantId,
  selectLocalStream,
  selectOpenParticipantMenuId,
  toggleParticipantMenu,
  type Participant,
} from './videoConferenceSlice'
import { IconMoreVertical } from './MeetingIcons'

type ParticipantVideoTileProps = {
  participant: Participant
  tileIndex?: number
}

function liveTrack(stream: MediaStream | null | undefined, kind: 'audio' | 'video') {
  return stream?.getTracks().find((t) => t.kind === kind && t.readyState === 'live')
}

export function ParticipantVideoTile({ participant, tileIndex = 0 }: ParticipantVideoTileProps) {
  const dispatch = useAppDispatch()
  const { remoteStreams } = useMediasoupMedia()
  const meetingLive = useAppSelector(selectIsMeetingLive)
  const localParticipantId = useAppSelector(selectLocalParticipantId)
  const localStream = useAppSelector(selectLocalStream)
  const cameraStatus = useAppSelector(selectCameraStatus)
  const openMenuId = useAppSelector(selectOpenParticipantMenuId)
  const isHost = useIsMeetingHost()
  const { emitControl, requestKick } = useParticipantModeration()
  const moderation = useParticipantModerationState(participant.id)

  const isLocal = participant.id === localParticipantId
  const menuOpen = openMenuId === participant.id
  const showHostMenu = isHost && !isLocal && participant.role !== 'host'
  const remoteStream = !isLocal ? remoteStreams[participant.id] : undefined

  const menuItems = useMemo(() => {
    const items: { id: string; label: string; action: () => void }[] = [
      {
        id: 'mic',
        label: moderation.micAllowed ? 'Mute Mic' : 'Unmute Mic',
        action: () =>
          emitControl(participant.id, moderation.micAllowed ? 'mute_mic' : 'unmute_mic'),
      },
      {
        id: 'cam',
        label: moderation.camAllowed ? 'Disable Cam' : 'Enable Cam',
        action: () =>
          emitControl(participant.id, moderation.camAllowed ? 'disable_cam' : 'enable_cam'),
      },
      {
        id: 'presenter',
        label: moderation.isPresenter ? 'Remove Presenter' : 'Make Presenter',
        action: () =>
          emitControl(
            participant.id,
            moderation.isPresenter ? 'revoke_presenter' : 'make_presenter',
          ),
      },
      {
        id: 'exit',
        label: 'Exit User',
        action: () => requestKick(participant.id, participant.name),
      },
    ]
    return items
  }, [emitControl, moderation, participant.id, participant.name, requestKick])

  const rootRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current
      if (!root?.contains(e.target as Node)) {
        dispatch(closeParticipantMenu())
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch(closeParticipantMenu())
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen, dispatch])

  const localVideoLive = Boolean(liveTrack(localStream, 'video'))
  const showLocalVideo = meetingLive && isLocal && localVideoLive && cameraStatus === 'ready'

  const remoteVideoLive = Boolean(liveTrack(remoteStream, 'video'))
  const remoteCamPublished = !isLocal && moderation.camAllowed && remoteVideoLive
  const showRemoteVideo = meetingLive && remoteCamPublished

  const remoteAudioOnly =
    meetingLive &&
    !isLocal &&
    !showRemoteVideo &&
    moderation.micAllowed &&
    Boolean(liveTrack(remoteStream, 'audio'))

  const showVideo = showLocalVideo || showRemoteVideo
  const showCameraIssue = isLocal && (cameraStatus === 'denied' || cameraStatus === 'error')

  useEffect(() => {
    const el = videoRef.current
    if (!el || !showVideo) {
      if (el) el.srcObject = null
      return
    }
    const stream = isLocal ? localStream : remoteStream
    if (!stream) {
      el.srcObject = null
      return
    }
    el.srcObject = stream
    el.muted = isLocal
    el.play().catch(() => {
      /* autoplay policies — ignore */
    })
    return () => {
      el.srcObject = null
    }
  }, [isLocal, localStream, remoteStream, showVideo, cameraStatus])

  useEffect(() => {
    const el = audioRef.current
    if (!el || !remoteAudioOnly || !remoteStream) {
      if (el) el.srcObject = null
      return
    }
    const at = liveTrack(remoteStream, 'audio')
    if (!at) {
      el.srcObject = null
      return
    }
    el.srcObject = new MediaStream([at])
    el.play().catch(() => {
      /* autoplay — ignore */
    })
    return () => {
      el.srcObject = null
    }
  }, [remoteAudioOnly, remoteStream])

  return (
    <div
      ref={rootRef}
      id={`video-tile-${participant.id}`}
      role="article"
      className="video-tile video-tile--animated"
      style={{ animationDelay: `${Math.min(tileIndex * 55, 400)}ms` }}
      aria-label={`${participant.name} video tile`}
    >
      <div className="video-tile__media">
        {showVideo ? (
          <video
            ref={videoRef}
            className={`video-tile__video${isLocal ? ' video-tile__video--mirrored' : ''}`}
            playsInline
            muted={isLocal}
            autoPlay
          />
        ) : null}
        {remoteAudioOnly ? (
          <audio ref={audioRef} className="video-tile__audio-only" autoPlay playsInline />
        ) : null}
        <div
          className={`video-tile__fallback ${showVideo || remoteAudioOnly ? 'video-tile__fallback--hidden' : ''}`}
          aria-hidden
        />
        {showCameraIssue ? (
          <div className="video-tile__status-overlay">
            <span className="video-tile__status-text">
              {cameraStatus === 'denied' ? 'Camera access denied' : 'Camera unavailable'}
            </span>
          </div>
        ) : null}
        {!isLocal && !moderation.micAllowed ? (
          <span className="video-tile__badge video-tile__badge--muted" title="Microphone muted by host">
            Mic off
          </span>
        ) : null}
        {!isLocal && !moderation.camAllowed ? (
          <span className="video-tile__badge video-tile__badge--cam-off" title="Camera disabled by host">
            Cam off
          </span>
        ) : null}
      </div>

      {showHostMenu ? (
        <div className="video-tile__chrome">
          <button
            type="button"
            className="video-tile__more meeting-tooltip meeting-tooltip--bottom"
            data-tooltip="More"
            aria-label={`More options for ${participant.name}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation()
              dispatch(toggleParticipantMenu(participant.id))
            }}
          >
            <IconMoreVertical size={16} />
          </button>
        </div>
      ) : null}

      {showHostMenu ? (
        <div
          className={`video-tile__menu-dropdown ${menuOpen ? 'video-tile__menu-dropdown--open' : ''}`}
          role="menu"
          aria-hidden={!menuOpen}
        >
          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="video-tile__menu-item"
              onClick={(e) => {
                e.stopPropagation()
                item.action()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="video-tile__footer">
        <span className="video-tile__label">{participant.name}</span>
        {moderation.isPresenter && participant.role !== 'host' ? (
          <span className="video-tile__role-badge">Presenter</span>
        ) : null}
      </div>
    </div>
  )
}
