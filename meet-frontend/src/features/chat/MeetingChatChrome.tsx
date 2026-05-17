import { MeetingChatPanel } from './MeetingChatPanel'
import { useMeetingChat } from './MeetingChatProvider'
import { IconChat } from '../videoConference/MeetingIcons'
import '../videoConference/meeting-icons.css'
import '../videoConference/meetingTooltip.css'
import './meetingChatChrome.css'

/**
 * Fixed bottom-right chat launcher + panel (viewport anchored, not tied to video layout).
 */
export function MeetingChatChrome() {
  const { isOpen, toggleChat, unreadTotal } = useMeetingChat()

  return (
    <div className="meeting-chat-chrome" aria-live="polite">
      <MeetingChatPanel />
      <button
        type="button"
        className={`meeting-chat-chrome__launcher meeting-tooltip meeting-tooltip--top ${isOpen ? 'meeting-chat-chrome__launcher--active' : ''}`}
        data-tooltip="Chat"
        aria-label={unreadTotal > 0 ? `Chat (${unreadTotal} unread)` : 'Chat'}
        aria-expanded={isOpen}
        onClick={toggleChat}
      >
        <IconChat />
        {unreadTotal > 0 && !isOpen ? (
          <span className="meeting-chat-chrome__badge" aria-hidden>
            {unreadTotal > 99 ? '99+' : unreadTotal}
          </span>
        ) : null}
      </button>
    </div>
  )
}
