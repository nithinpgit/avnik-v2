import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { MeetingStatusBanner } from '../meeting/MeetingStatusBanner'
import { selectIsMeetingLive, selectMeetingStatus } from '../meeting/meetingLifecycleSlice'
import { useIsMeetingHost } from '../meeting/useIsMeetingHost'
import { useMeetingElapsedLabel } from '../meeting/useMeetingElapsedLabel'
import { openPreMeetingSettings } from '../preMeeting/preMeetingSlice'
import { useMeetingSocket } from '../meetingRoom/MeetingSocketProvider'
import { MeetingBottomToolbar } from './MeetingBottomToolbar'
import { LocalCameraManager } from './LocalCameraManager'
import { ParticipantVideoTile } from './ParticipantVideoTile'
import {
  selectConferenceMode,
  selectParticipants,
  toggleConferenceMode,
} from './videoConferenceSlice'
import {
  IconBell,
  IconExit,
  IconGear,
  IconMonitor,
  IconPause,
  IconPlay,
  IconRecord,
  IconSearch,
  IconUser,
} from './MeetingIcons'
import { getConferenceGridLayout } from './conferenceGrid'
import './meeting-icons.css'
import './meetingBottomToolbar.css'
import './meetingTooltip.css'
import './videoConference.css'

export function VideoConferenceModule() {
  const dispatch = useAppDispatch()
  const { startMeeting, pauseMeeting } = useMeetingSocket()
  const isConferenceMode = useAppSelector(selectConferenceMode)
  const participants = useAppSelector(selectParticipants)
  const meetingStatus = useAppSelector(selectMeetingStatus)
  const meetingLive = useAppSelector(selectIsMeetingLive)
  const isHost = useIsMeetingHost()
  const elapsedLabel = useMeetingElapsedLabel()
  const [startingMeeting, setStartingMeeting] = useState(false)

  const showHostPlay = isHost && (meetingStatus === 'not_started' || meetingStatus === 'paused')
  const showHostPause = isHost && meetingStatus === 'started'

  useEffect(() => {
    if (!startingMeeting) return
    const id = window.setTimeout(() => setStartingMeeting(false), 8000)
    return () => window.clearTimeout(id)
  }, [startingMeeting])

  useEffect(() => {
    if (meetingLive || meetingStatus === 'paused') {
      setStartingMeeting(false)
    }
  }, [meetingLive, meetingStatus])

  const handleStartOrResume = () => {
    if (startingMeeting) return
    if (meetingStatus !== 'not_started' && meetingStatus !== 'paused') return
    setStartingMeeting(true)
    startMeeting()
  }

  const handlePauseMeeting = () => {
    if (!meetingLive) return
    pauseMeeting()
  }

  const conferenceGrid = useMemo(
    () => getConferenceGridLayout(participants.length),
    [participants.length],
  )

  const stageStyle = useMemo(
    () =>
      ({
        '--stage-cols': conferenceGrid.cols,
        '--stage-rows': conferenceGrid.rows,
      }) as CSSProperties,
    [conferenceGrid],
  )

  return (
    <section
      className={`video-conference ${isConferenceMode ? 'conference' : 'normal'}`}
      aria-label="Video conference module"
    >
      <LocalCameraManager />

      <header className="meeting-topbar">
        <div className="meeting-topbar__left">
          <button
            type="button"
            className="cmn-cricle-btn meeting-tooltip meeting-tooltip--bottom"
            data-tooltip="Settings"
            aria-label="Settings"
            onClick={() => dispatch(openPreMeetingSettings())}
          >
            <span className="cmn-cricle-btn__icon" aria-hidden>
              <IconGear />
            </span>
          </button>
          <span className="meeting-time" aria-live="polite">
            {elapsedLabel}
          </span>
          {showHostPlay ? (
            <button
              type="button"
              className="cmn-cricle-btn cmn-cricle-btn--active meeting-tooltip meeting-tooltip--bottom"
              data-tooltip={
                meetingStatus === 'paused'
                  ? 'Click play button to resume meeting'
                  : 'Click play button to start meeting'
              }
              aria-label={meetingStatus === 'paused' ? 'Resume meeting' : 'Start meeting'}
              disabled={startingMeeting}
              onClick={handleStartOrResume}
            >
              <span className="cmn-cricle-btn__icon" aria-hidden>
                <IconPlay />
              </span>
            </button>
          ) : null}
          {showHostPause ? (
            <>
              <button
                type="button"
                className="cmn-cricle-btn meeting-tooltip meeting-tooltip--bottom"
                data-tooltip="Pause"
                aria-label="Pause meeting"
                onClick={handlePauseMeeting}
              >
                <span className="cmn-cricle-btn__icon" aria-hidden>
                  <IconPause />
                </span>
              </button>
              <button
                type="button"
                className="cmn-cricle-btn cmn-cricle-btn--record-dot meeting-tooltip meeting-tooltip--bottom"
                data-tooltip="Recording"
                aria-label="Recording"
              >
                <span className="cmn-cricle-btn__icon cmn-cricle-btn__icon--record" aria-hidden>
                  <IconRecord size={14} />
                </span>
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="cmn-cricle-btn cmn-cricle-btn--exit meeting-tooltip meeting-tooltip--bottom"
            data-tooltip="Leave meeting"
            aria-label="Leave meeting"
          >
            <span className="cmn-cricle-btn__icon" aria-hidden>
              <IconExit />
            </span>
          </button>
        </div>
        <div className="meeting-topbar__brand">avnik</div>
        <div className="meeting-topbar__right">
          <button
            type="button"
            className="cmn-cricle-btn cmn-cricle-btn--notify meeting-tooltip meeting-tooltip--bottom"
            data-tooltip="Notifications"
            aria-label="Notifications"
          >
            <span className="cmn-cricle-btn__icon" aria-hidden>
              <IconBell />
            </span>
            <span className="notify-badge" aria-hidden>
              1
            </span>
          </button>
          <button
            type="button"
            className={`cmn-cricle-btn meeting-tooltip meeting-tooltip--bottom ${isConferenceMode ? 'cmn-cricle-btn--active' : ''}`}
            data-tooltip={isConferenceMode ? 'Whiteboard layout' : 'Conference Mode'}
            aria-label={isConferenceMode ? 'Switch to whiteboard layout' : 'Conference mode'}
            aria-pressed={isConferenceMode}
            onClick={() => dispatch(toggleConferenceMode())}
          >
            <span className="cmn-cricle-btn__icon" aria-hidden>
              <IconMonitor />
            </span>
          </button>
          <button
            type="button"
            className="cmn-cricle-btn meeting-tooltip meeting-tooltip--bottom"
            data-tooltip="Add participant"
            aria-label="Account"
          >
            <span className="cmn-cricle-btn__icon" aria-hidden>
              <IconUser />
            </span>
          </button>
        </div>
      </header>

      {!isConferenceMode && (
        <aside id="video-sidebar" className="video-sidebar" aria-label="Participants panel">
          <MeetingStatusBanner />
          <header className="video-sidebar__header">
            <span>Participants ({participants.length})</span>
            <button
              type="button"
              className="video-sidebar__search meeting-tooltip meeting-tooltip--bottom"
              data-tooltip="Search"
              aria-label="Search participants"
            >
              <IconSearch />
            </button>
          </header>
          <div id="video-sidebar__tiles" className="video-sidebar__tiles">
            {participants.map((participant, index) => (
              <ParticipantVideoTile key={participant.id} participant={participant} tileIndex={index} />
            ))}
          </div>
        </aside>
      )}

      {isConferenceMode ? (
        <>
          <div className="conference-backdrop" aria-hidden />
          <div className="video-stage" style={stageStyle} aria-label="Conference stage">
            {participants.map((participant, index) => (
              <ParticipantVideoTile key={participant.id} participant={participant} tileIndex={index} />
            ))}
          </div>
        </>
      ) : null}

      <MeetingBottomToolbar />

    </section>
  )
}
