import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import {
  setCameraErrorMessage,
  setCameraStatus,
  setLocalStream,
} from '../videoConference/videoConferenceSlice'
import '../videoConference/meeting-icons.css'
import '../videoConference/meetingTooltip.css'
import { PreMeetingEventInfoTab } from './PreMeetingEventInfoTab'
import { completePreMeeting, selectPreMeetingOpen } from './preMeetingSlice'
import { PreMeetingSettingsTab, type PreMeetingSettingsReport } from './PreMeetingSettingsTab'
import './preMeetingModal.css'

type TabId = 'settings' | 'info'

export function PreMeetingModal() {
  const dispatch = useAppDispatch()
  const isOpen = useAppSelector(selectPreMeetingOpen)
  const [tab, setTab] = useState<TabId>('settings')
  const entryRef = useRef<PreMeetingSettingsReport>({
    stream: null,
    mediaMode: 'both',
  })
  /** When true, settings tab must not stop tracks on unmount (stream kept for meeting). */
  const streamTransferredRef = useRef(false)

  const onSettingsState = useCallback((s: PreMeetingSettingsReport) => {
    entryRef.current = s
  }, [])

  useEffect(() => {
    if (isOpen) {
      streamTransferredRef.current = false
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  const handleEnter = () => {
    const { stream, mediaMode } = entryRef.current
    const wantsVideo = mediaMode !== 'none' && mediaMode !== 'mic_only'

    streamTransferredRef.current = true
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

    dispatch(completePreMeeting({ wantsVideo, mediaMode }))
  }

  return (
    <div className="pre-meeting-backdrop" aria-modal role="dialog" aria-labelledby="pre-meeting-title">
      <div className="pre-meeting-modal meeting-setting-popup setting-inside-popup host-info-popup icon_settings_page">
        <div className="pre-meeting-modal__dialog">
          <div className="pre-meeting-modal__content">
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
                      onStateChange={onSettingsState}
                      skipStopTracksOnUnmountRef={streamTransferredRef}
                    />
                  </div>
                  <div className="ah-tab-content" data-active={tab === 'info' ? 'true' : 'false'}>
                    <PreMeetingEventInfoTab />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer meeting-setting-footer">
              <button type="button" className="btn cmn-btn btn_section pre-meeting-enter" onClick={handleEnter}>
                Enter
              </button>
            </div>
            <div className="back-to-home-link">
              <a className="link-btn" href="/" onClick={(e) => e.preventDefault()}>
                Back To Home
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
