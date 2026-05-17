import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { store } from '../../app/store'
import { useMediasoupMedia } from '../mediasoup/MediasoupMediaProvider'
import { IconClose } from '../videoConference/MeetingIcons'
import {
  setCameraErrorMessage,
  setCameraStatus,
  setLocalStream,
} from '../videoConference/videoConferenceSlice'
import '../videoConference/meeting-icons.css'
import '../videoConference/meetingTooltip.css'
import { deviceIdsFromStream } from './mediaDeviceUtils'
import { PreMeetingEventInfoTab } from './PreMeetingEventInfoTab'
import {
  applyMeetingMediaSettings,
  closePreMeetingModal,
  completePreMeeting,
  selectPreMeetingEntryCompleted,
  selectPreMeetingLastMediaMode,
  selectPreMeetingOpen,
  selectPreferredAudioDeviceId,
  selectPreferredVideoDeviceId,
  type PreMeetingMediaMode,
} from './preMeetingSlice'
import { PreMeetingSettingsTab, type PreMeetingSettingsReport } from './PreMeetingSettingsTab'
import './preMeetingModal.css'

type TabId = 'settings' | 'info'

const emptyReport = (): PreMeetingSettingsReport => ({
  stream: null,
  mediaMode: 'both',
  videoDeviceId: '',
  audioInDeviceId: '',
  audioOutDeviceId: '',
})

function applyStreamToStore(
  dispatch: ReturnType<typeof useAppDispatch>,
  stream: MediaStream | null,
  mediaMode: PreMeetingMediaMode,
) {
  const wantsVideo = mediaMode !== 'none' && mediaMode !== 'mic_only'
  dispatch(setLocalStream(stream))
  if (stream && wantsVideo) {
    dispatch(setCameraStatus('ready'))
    dispatch(setCameraErrorMessage(null))
  } else if (stream && !wantsVideo) {
    dispatch(setCameraStatus('idle'))
    dispatch(setCameraErrorMessage(null))
  } else {
    dispatch(setLocalStream(null))
    dispatch(setCameraStatus('idle'))
    dispatch(setCameraErrorMessage(null))
  }
}

export function PreMeetingModal() {
  const dispatch = useAppDispatch()
  const { syncLocalMedia } = useMediasoupMedia()
  const isOpen = useAppSelector(selectPreMeetingOpen)
  const entryCompleted = useAppSelector(selectPreMeetingEntryCompleted)
  const lastMediaMode = useAppSelector(selectPreMeetingLastMediaMode)
  const preferredVideoDeviceId = useAppSelector(selectPreferredVideoDeviceId)
  const preferredAudioDeviceId = useAppSelector(selectPreferredAudioDeviceId)
  const localStream = useAppSelector((s) => s.videoConference.localStream)

  const [tab, setTab] = useState<TabId>('settings')
  const entryRef = useRef<PreMeetingSettingsReport>(emptyReport())
  const streamTransferredRef = useRef(false)

  const initialDevices = useMemo(() => {
    const fromStream = deviceIdsFromStream(localStream)
    return {
      videoDeviceId: preferredVideoDeviceId || fromStream.videoDeviceId,
      audioInDeviceId: preferredAudioDeviceId || fromStream.audioInDeviceId,
    }
  }, [localStream, preferredVideoDeviceId, preferredAudioDeviceId])

  const onSettingsState = useCallback((s: PreMeetingSettingsReport) => {
    entryRef.current = s
  }, [])

  useEffect(() => {
    if (isOpen) {
      streamTransferredRef.current = false
      entryRef.current = emptyReport()
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  const isInMeetingSettings = entryCompleted

  const handleClose = () => {
    dispatch(closePreMeetingModal())
  }

  const handleEnter = () => {
    const { stream, mediaMode, videoDeviceId, audioInDeviceId, audioOutDeviceId } = entryRef.current
    const wantsVideo = mediaMode !== 'none' && mediaMode !== 'mic_only'

    streamTransferredRef.current = true
    applyStreamToStore(dispatch, stream, mediaMode)
    dispatch(
      completePreMeeting({
        wantsVideo,
        mediaMode,
        videoDeviceId: videoDeviceId || undefined,
        audioDeviceId: audioInDeviceId || undefined,
        audioOutputDeviceId: audioOutDeviceId || undefined,
      }),
    )
  }

  const handleContinue = () => {
    const { stream, mediaMode, videoDeviceId, audioInDeviceId, audioOutDeviceId } = entryRef.current
    const wantsVideo = mediaMode !== 'none' && mediaMode !== 'mic_only'
    const previous = store.getState().videoConference.localStream

    streamTransferredRef.current = true

    if (previous && previous !== stream) {
      previous.getTracks().forEach((t) => t.stop())
    }

    applyStreamToStore(dispatch, stream, mediaMode)
    dispatch(
      applyMeetingMediaSettings({
        wantsVideo,
        mediaMode,
        videoDeviceId: videoDeviceId || undefined,
        audioDeviceId: audioInDeviceId || undefined,
        audioOutputDeviceId: audioOutDeviceId || undefined,
      }),
    )
    void syncLocalMedia(stream)
    dispatch(closePreMeetingModal())
  }

  return (
    <PreMeetingBackdrop onClose={isInMeetingSettings ? handleClose : undefined}>
      <div
        className="pre-meeting-modal meeting-setting-popup setting-inside-popup host-info-popup icon_settings_page"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pre-meeting-modal__dialog">
          <div className="pre-meeting-modal__content">
            {isInMeetingSettings ? (
              <button
                type="button"
                className="pre-meeting-modal__close settings-close close"
                aria-label="Close settings"
                onClick={handleClose}
              >
                <span aria-hidden>
                  <IconClose />
                </span>
              </button>
            ) : null}
            <div className="modal-body">
              <div className="av-default-tabs">
                <h2 id="pre-meeting-title" className="visually-hidden">
                  Meeting setup
                </h2>
                <div className="ah-tab-wrapper">
                  <div className="ah-tab">
                    <button
                      type="button"
                      className="ah-tab-item"
                      data-active={tab === 'settings' ? 'true' : 'false'}
                      onClick={() => setTab('settings')}
                    >
                      Settings
                    </button>
                    <button
                      type="button"
                      className="ah-tab-item"
                      data-active={tab === 'info' ? 'true' : 'false'}
                      onClick={() => setTab('info')}
                    >
                      Event Information
                    </button>
                  </div>
                </div>
                <div className="ah-tab-content-wrapper upload_icon_box">
                  <div className="ah-tab-content" data-active={tab === 'settings' ? 'true' : 'false'}>
                    <PreMeetingSettingsTab
                      key={isInMeetingSettings ? 'in-meeting' : 'entry'}
                      onStateChange={onSettingsState}
                      skipStopTracksOnUnmountRef={streamTransferredRef}
                      initialMediaMode={lastMediaMode}
                      initialVideoDeviceId={initialDevices.videoDeviceId}
                      initialAudioInDeviceId={initialDevices.audioInDeviceId}
                    />
                  </div>
                  <div className="ah-tab-content" data-active={tab === 'info' ? 'true' : 'false'}>
                    <PreMeetingEventInfoTab />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer meeting-setting-footer">
              <button
                type="button"
                className="btn cmn-btn btn_section pre-meeting-enter"
                onClick={isInMeetingSettings ? handleContinue : handleEnter}
              >
                {isInMeetingSettings ? 'Continue' : 'Enter'}
              </button>
            </div>
            {!isInMeetingSettings ? (
              <div className="back-to-home-link">
                <a className="link-btn" href="/" onClick={(e) => e.preventDefault()}>
                  Back To Home
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </PreMeetingBackdrop>
  )
}

function PreMeetingBackdrop({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose?: () => void
}) {
  return (
    <div
      className="pre-meeting-backdrop"
      aria-modal
      role="dialog"
      aria-labelledby="pre-meeting-title"
      onClick={(e) => {
        if (onClose && e.target === e.currentTarget) onClose()
      }}
    >
      {children}
    </div>
  )
}
