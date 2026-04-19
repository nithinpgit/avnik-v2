import { useCallback, useEffect, useId, useRef, useState } from 'react'
import './groupChatPopup.css'

export type GroupChatPopupProps = {
  isOpen: boolean
  onClose: () => void
}

export function GroupChatPopup({ isOpen, onClose }: GroupChatPopupProps) {
  const titleId = useId()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [soundMuted, setSoundMuted] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<{ id: string; text: string; self: boolean }[]>([])

  const send = useCallback(() => {
    const t = draft.trim()
    if (!t) return
    setMessages((m) => [...m, { id: `${Date.now()}`, text: t, self: true }])
    setDraft('')
    inputRef.current?.focus()
  }, [draft])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="wb-chat-popup-root wb-chat-popup-root--open"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
    >
      <div className="WB-chat-popup-sec">
        <div className="WB-chat-popup">
          <header className="wb-chat-popup__header">
            <h2 id={titleId} className="wb-chat-popup__header-title">
              Group Message
            </h2>
            <div className="WBCP-right">
              <ul className="nav nav-pills">
                <li>
                  <button
                    type="button"
                    className="meeting-tooltip meeting-tooltip--top"
                    data-tooltip="Chat Sound"
                    aria-label={soundMuted ? 'Unmute chat sound' : 'Mute chat sound'}
                    aria-pressed={soundMuted}
                    onClick={() => setSoundMuted((v) => !v)}
                  >
                    <i
                      className={soundMuted ? 'mr-sound-unmute-icon' : 'mr-sound-mute-icon'}
                      aria-hidden
                    />
                  </button>
                </li>
                <li className="active">
                  <span
                    className="wb-chat-popup__pill meeting-tooltip meeting-tooltip--top"
                    data-tooltip="Group Chat"
                    role="img"
                    aria-label="Group chat"
                  >
                    <i className="mr-group-chat-icon" aria-hidden />
                  </span>
                </li>
                <li>
                  <button
                    type="button"
                    className="meeting-tooltip meeting-tooltip--top"
                    data-tooltip="Close Chat"
                    aria-label="Close chat"
                    onClick={onClose}
                  >
                    <i className="mr-close-icon" aria-hidden />
                  </button>
                </li>
              </ul>
            </div>
          </header>

          <div className="group_chat_popup_sec">
            <div className="chat-rbox">
              <ul className="chat-list message_box_scroll" aria-live="polite">
                {messages.map((msg) => (
                  <li
                    key={msg.id}
                    className={`wb-chat-msg ${msg.self ? 'wb-chat-msg--self' : ''}`}
                  >
                    {msg.text}
                  </li>
                ))}
              </ul>
            </div>

            <div className="group-chat-pop-footer">
              <div className="group-messages-footer">
                <div className="popup-messages-footer">
                  <textarea
                    ref={inputRef}
                    id="group-chat-input"
                    className="chat-pop-input"
                    placeholder="Type a message..."
                    rows={1}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        send()
                      }
                    }}
                  />
                </div>
                <div className="group-message-advance">
                  <ul>
                    <li>
                      <label className="fileUpload" aria-label="Attach file">
                        <i className="mr-attachment-icon" aria-hidden />
                        <input type="file" name="chatFile" />
                      </label>
                    </li>
                    <li className="smiley-btn">
                      <button type="button" aria-label="Emoji">
                        <i className="mr-emoji-icon" aria-hidden />
                      </button>
                    </li>
                    <li>
                      <button type="button" className="send-message-btn" aria-label="Send" onClick={send}>
                        <i className="mr-send-icon" aria-hidden />
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
