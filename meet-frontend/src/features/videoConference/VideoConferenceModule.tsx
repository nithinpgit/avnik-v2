import type { FC } from 'react'
import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { GroupChatPopup } from './GroupChatPopup'
import { LocalCameraManager } from './LocalCameraManager'
import { ParticipantVideoTile } from './ParticipantVideoTile'
import {
  selectConferenceMode,
  selectParticipants,
  toggleConferenceMode,
} from './videoConferenceSlice'
import {
  IconBell,
  IconChat,
  IconCrown,
  IconDocument,
  IconExit,
  IconFullscreen,
  IconGear,
  IconGridLayout,
  IconHand,
  IconMic,
  IconMonitor,
  IconPause,
  IconRecord,
  IconSearch,
  IconUser,
  IconVideoCam,
} from './MeetingIcons'
import './meeting-icons.css'
import './meetingTooltip.css'
import './videoConference.css'

const dockItems: { key: string; icon: FC; label: string }[] = [
  { key: 'layout', icon: IconGridLayout, label: 'Layout' },
  { key: 'files', icon: IconDocument, label: 'Files' },
  { key: 'video', icon: IconVideoCam, label: 'Video' },
  { key: 'fullscreen', icon: IconFullscreen, label: 'Fullscreen' },
  { key: 'cam', icon: IconVideoCam, label: 'Camera' },
  { key: 'mic', icon: IconMic, label: 'Microphone' },
  { key: 'hand', icon: IconHand, label: 'Raise hand' },
]

export function VideoConferenceModule() {
  const dispatch = useAppDispatch()
  const isConferenceMode = useAppSelector(selectConferenceMode)
  const participants = useAppSelector(selectParticipants)
  const [chatOpen, setChatOpen] = useState(false)

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
          >
            <span className="cmn-cricle-btn__icon" aria-hidden>
              <IconGear />
            </span>
          </button>
          <button
            type="button"
            className="cmn-cricle-btn meeting-tooltip meeting-tooltip--bottom"
            data-tooltip="Host"
            aria-label="Host"
          >
            <span className="cmn-cricle-btn__icon" aria-hidden>
              <IconCrown />
            </span>
          </button>
          <span className="meeting-time">22:26:17</span>
          <button
            type="button"
            className="cmn-cricle-btn meeting-tooltip meeting-tooltip--bottom"
            data-tooltip="Pause"
            aria-label="Pause"
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

      {isConferenceMode && (
        <div className="video-stage" aria-label="Conference stage">
          {participants.map((participant, index) => (
            <ParticipantVideoTile key={participant.id} participant={participant} tileIndex={index} />
          ))}
        </div>
      )}

      <footer className="meeting-bottom-dock" aria-label="Meeting controls">
        <div className="meeting-bottom-dock__inner">
          {dockItems.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              type="button"
              className="dock-btn meeting-tooltip meeting-tooltip--top"
              data-tooltip={label}
              aria-label={label}
            >
              <Icon />
            </button>
          ))}
        </div>
      </footer>

      <button
        type="button"
        className={`fab-corner fab-corner--chat meeting-tooltip meeting-tooltip--top ${chatOpen ? 'fab-corner--chat-active' : ''}`}
        data-tooltip="Chat"
        aria-label="Chat"
        aria-expanded={chatOpen}
        onClick={() => setChatOpen((o) => !o)}
      >
        <IconChat />
      </button>

      <GroupChatPopup isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </section>
  )
}
