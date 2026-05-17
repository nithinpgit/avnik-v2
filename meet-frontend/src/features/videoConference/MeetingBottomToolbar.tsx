import { useCallback, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { store } from '../../app/store'
import { DocumentToolbar } from '../documents/DocumentToolbar'
import {
  openShareDocumentModal,
  selectPresentationVisible,
} from '../documents/documentsSlice'
import { pushToast } from '../documents/notificationsSlice'
import { useIsMeetingHost } from '../meeting/useIsMeetingHost'
import {
  IconAllMicOff,
  IconAllWebcamOff,
  IconDocument,
  IconFullscreen,
  IconHand,
  IconMic,
  IconScreenShare,
  IconVideoShare,
  IconWebcam,
} from './MeetingIcons'
import './meetingBottomToolbar.css'
import './meeting-icons.css'

function toggleLocalTrack(kind: 'audio' | 'video'): boolean {
  const stream = store.getState().videoConference.localStream
  const track = stream?.getTracks().find((t) => t.kind === kind)
  if (!track) return false
  track.enabled = !track.enabled
  return track.enabled
}

export function MeetingBottomToolbar() {
  const dispatch = useAppDispatch()
  const isHost = useIsMeetingHost()
  const presentationActive = useAppSelector(selectPresentationVisible)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const notifySoon = useCallback(
    (label: string) => {
      dispatch(pushToast({ message: `${label} — coming soon`, variant: 'info', durationMs: 3000 }))
    },
    [dispatch],
  )

  const handleMic = () => {
    const enabled = toggleLocalTrack('audio')
    setMicOn(enabled)
    dispatch(
      pushToast({
        message: enabled ? 'Microphone on' : 'Microphone muted',
        variant: 'info',
        durationMs: 2000,
      }),
    )
  }

  const handleCam = () => {
    const enabled = toggleLocalTrack('video')
    setCamOn(enabled)
    dispatch(
      pushToast({
        message: enabled ? 'Camera on' : 'Camera off',
        variant: 'info',
        durationMs: 2000,
      }),
    )
  }

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().then(() => setIsFullscreen(true))
    } else {
      void document.exitFullscreen().then(() => setIsFullscreen(false))
    }
  }

  return (
    <footer className="meeting-bottom-dock" aria-label="Meeting controls">
      <div className="meeting-bottom-dock__inner controls-options-new">
        <ul className="dock-toolbar-list cmn-ul-list">
          <li className="dock-toolbar-section dock-toolbar-section--share share-doc-video-bx">
            <button
              type="button"
              className="dock-btn meeting-tooltip meeting-tooltip--top"
              data-tooltip="Screen Share"
              aria-label="Screen share"
              onClick={() => notifySoon('Screen share')}
            >
              <IconScreenShare />
            </button>
            <button
              type="button"
              className={`dock-btn meeting-tooltip meeting-tooltip--top${presentationActive ? ' dock-btn--document-active' : ''}`}
              data-tooltip="Share Document"
              aria-label="Share document"
              onClick={() => dispatch(openShareDocumentModal())}
            >
              <IconDocument />
            </button>
            <button
              type="button"
              className="dock-btn meeting-tooltip meeting-tooltip--top"
              data-tooltip="Share Video"
              aria-label="Share video"
              onClick={() => notifySoon('Video share')}
            >
              <IconVideoShare />
            </button>
          </li>

          <DocumentToolbar />

          <li className="dock-toolbar-section">
            <button
              type="button"
              className={`dock-btn meeting-tooltip meeting-tooltip--top${isFullscreen ? ' dock-btn--active' : ''}`}
              data-tooltip="Full Screen"
              aria-label="Full screen"
              onClick={handleFullscreen}
            >
              <IconFullscreen />
            </button>
          </li>

          <li className="dock-toolbar-section">
            <button
              type="button"
              className={`dock-btn meeting-tooltip meeting-tooltip--top${camOn ? '' : ' dock-btn--off'}`}
              data-tooltip={camOn ? 'Turn OFF' : 'Turn ON'}
              aria-label={camOn ? 'Turn camera off' : 'Turn camera on'}
              onClick={handleCam}
            >
              <IconWebcam />
            </button>
          </li>

          <li className="dock-toolbar-section">
            <button
              type="button"
              className={`dock-btn meeting-tooltip meeting-tooltip--top${micOn ? '' : ' dock-btn--off'}`}
              data-tooltip={micOn ? 'Mute' : 'Unmute'}
              aria-label={micOn ? 'Mute microphone' : 'Unmute microphone'}
              onClick={handleMic}
            >
              <IconMic />
            </button>
          </li>

          {isHost ? (
            <li className="dock-toolbar-section remove-viewer">
              <button
                type="button"
                className="dock-btn dock-btn--host meeting-tooltip meeting-tooltip--top"
                data-tooltip="Turn OFF All"
                aria-label="Turn off all cameras"
                onClick={() => notifySoon('Turn off all cameras')}
              >
                <IconAllWebcamOff />
              </button>
            </li>
          ) : null}

          {isHost ? (
            <li className="dock-toolbar-section remove-viewer">
              <button
                type="button"
                className="dock-btn meeting-tooltip meeting-tooltip--top"
                data-tooltip="Mute All"
                aria-label="Mute all"
                onClick={() => notifySoon('Mute all')}
              >
                <IconAllMicOff />
              </button>
            </li>
          ) : null}

          <li className="dock-toolbar-section remove-presenter">
            <button
              type="button"
              className="dock-btn meeting-tooltip meeting-tooltip--top"
              data-tooltip="Raise hand"
              aria-label="Raise hand"
              onClick={() => notifySoon('Raise hand')}
            >
              <IconHand />
            </button>
          </li>
        </ul>
      </div>
    </footer>
  )
}
