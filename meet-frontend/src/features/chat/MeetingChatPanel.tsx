import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useMeetingChat } from './MeetingChatProvider'
import { formatChatTime } from './chatUtils'
import type { ChatMessage } from './chatTypes'
import './meetingChatChrome.css'
import '../videoConference/groupChatPopup.css'

function ChatBubble({ msg, isSelf }: { msg: ChatMessage; isSelf: boolean }) {
  const seenLabel =
    isSelf && msg.seenBy.length > 0
      ? msg.seenBy.length === 1
        ? `Seen by ${msg.seenBy[0].userName}`
        : `Seen by ${msg.seenBy.length}`
      : null

  return (
    <li className={`chat-popup-user ${isSelf ? 'me' : 'other'}`}>
      {!isSelf ? (
        <div className="chat-img" aria-hidden>
          <span className="chat-img__initials">
            {msg.senderName.slice(0, 2).toUpperCase()}
          </span>
        </div>
      ) : null}
      <div className="chat-content">
        <div className="chat-pop-message togather">
          <div className="CPM-box">
            {!isSelf ? <i className="ih3">{msg.senderName}</i> : null}
            <span title={formatChatTime(msg.createdAt)}>{msg.body}</span>
          </div>
        </div>
        {seenLabel ? <span className="chat-seen-label">{seenLabel}</span> : null}
      </div>
    </li>
  )
}

function scrollMessagesToBottom(el: HTMLElement, behavior: ScrollBehavior = 'smooth') {
  el.scrollTo({ top: el.scrollHeight, behavior })
}

function MessageList({
  messages,
  localUserId,
}: {
  messages: ChatMessage[]
  localUserId: string
}) {
  const listRef = useRef<HTMLUListElement>(null)
  const bottomRef = useRef<HTMLLIElement>(null)
  const prevCountRef = useRef(0)

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = listRef.current
    if (!el) return
    requestAnimationFrame(() => {
      scrollMessagesToBottom(el, behavior)
      bottomRef.current?.scrollIntoView({ behavior, block: 'end' })
    })
  }, [])

  useEffect(() => {
    const grew = messages.length > prevCountRef.current
    prevCountRef.current = messages.length
    scrollToBottom(grew ? 'smooth' : 'auto')
  }, [messages, scrollToBottom])

  return (
    <div className="chat-rbox">
      <ul ref={listRef} className="chat-list message_box_scroll" aria-live="polite">
        {messages.map((msg) => (
          <ChatBubble key={msg.id} msg={msg} isSelf={msg.senderId === localUserId} />
        ))}
        <li ref={bottomRef} className="chat-scroll-anchor" aria-hidden="true" />
      </ul>
    </div>
  )
}

function Composer({
  placeholder,
  onSend,
}: {
  placeholder: string
  onSend: (text: string) => void
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState('')

  const send = useCallback(() => {
    const t = draft.trim()
    if (!t) return
    onSend(t)
    setDraft('')
    inputRef.current?.focus()
  }, [draft, onSend])

  return (
    <div className="group-chat-pop-footer">
      <div className="group-messages-footer">
        <div className="popup-messages-footer">
          <textarea
            ref={inputRef}
            className="chat-pop-input"
            placeholder={placeholder}
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
              <button type="button" className="send-message-btn" aria-label="Send" onClick={send}>
                <i className="mr-send-icon" aria-hidden />
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export function MeetingChatPanel() {
  const titleId = useId()
  const {
    isOpen,
    closeChat,
    activeTab,
    setActiveTab,
    selectedPeerId,
    setSelectedPeerId,
    publicMessages,
    privateMessages,
    participants,
    localUserId,
    sendMessage,
    privateUnreadByPeer,
    soundMuted,
    setSoundMuted,
  } = useMeetingChat()

  const [pvSearch, setPvSearch] = useState('')

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeChat()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, closeChat])

  if (!isOpen) return null

  const others = participants.filter((p) => p.id !== localUserId)
  const filteredOthers = others.filter((p) =>
    p.name.toLowerCase().includes(pvSearch.trim().toLowerCase()),
  )
  const selectedPeer = others.find((p) => p.id === selectedPeerId)
  const privateTabUnread = Object.values(privateUnreadByPeer).reduce((a, b) => a + b, 0)
  const headerTitle =
    activeTab === 'public'
      ? 'Group Message'
      : selectedPeer
        ? selectedPeer.name
        : 'Private Message'

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
              {activeTab === 'private' && selectedPeer ? (
                <button
                  type="button"
                  className="wb-chat-popup__back"
                  aria-label="Back to user list"
                  onClick={() => setSelectedPeerId(null)}
                >
                  <i className="mr-undo-icon" aria-hidden />
                </button>
              ) : null}
              {headerTitle}
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
                    onClick={() => setSoundMuted(!soundMuted)}
                  >
                    <i
                      className={soundMuted ? 'mr-sound-unmute-icon' : 'mr-sound-mute-icon'}
                      aria-hidden
                    />
                  </button>
                </li>
                <li className={activeTab === 'public' ? 'active' : ''}>
                  <button
                    type="button"
                    className="wb-chat-popup__pill meeting-tooltip meeting-tooltip--top"
                    data-tooltip="Group Chat"
                    aria-label="Group chat"
                    aria-pressed={activeTab === 'public'}
                    onClick={() => {
                      setActiveTab('public')
                      setSelectedPeerId(null)
                    }}
                  >
                    <i className="mr-group-chat-icon" aria-hidden />
                  </button>
                </li>
                <li className={activeTab === 'private' ? 'active' : ''}>
                  <button
                    type="button"
                    className="wb-chat-popup__pill meeting-tooltip meeting-tooltip--top"
                    data-tooltip="Private Chat"
                    aria-label="Private chat"
                    aria-pressed={activeTab === 'private'}
                    onClick={() => {
                      setActiveTab('private')
                      setSelectedPeerId(null)
                    }}
                  >
                    <i className="mr-user-chat-icon" aria-hidden />
                    {privateTabUnread > 0 ? (
                      <span className="chat-mgs-dot chat-message-show" aria-hidden />
                    ) : null}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="meeting-tooltip meeting-tooltip--top"
                    data-tooltip="Close Chat"
                    aria-label="Close chat"
                    onClick={closeChat}
                  >
                    <i className="mr-close-icon" aria-hidden />
                  </button>
                </li>
              </ul>
            </div>
          </header>

          {activeTab === 'public' ? (
            <div className="group_chat_popup_sec">
              <MessageList key="public" messages={publicMessages} localUserId={localUserId} />
              <Composer placeholder="Type a group message..." onSend={sendMessage} />
            </div>
          ) : (
            <div className="person-chat-content">
              {!selectedPeerId ? (
                <div className="WB-pop-list-sec">
                  <div className="WB-search">
                    <input
                      type="search"
                      placeholder="Search participants"
                      value={pvSearch}
                      onChange={(e) => setPvSearch(e.target.value)}
                      aria-label="Search participants"
                    />
                  </div>
                  <ul className="WB-pop-list chatonline" id="pv-chat-users-ul">
                    {filteredOthers.map((p) => {
                      const unread = privateUnreadByPeer[p.id] ?? 0
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            className="wb-chat-user-row"
                            onClick={() => setSelectedPeerId(p.id)}
                          >
                            <span className="avatar-circle">
                              {p.name.slice(0, 2).toUpperCase()}
                              {unread > 0 ? (
                                <span className="chat-message-show chat-mgs-dot" aria-hidden />
                              ) : null}
                            </span>
                            <span className="chat-user-cont">
                              <span className="chat-user-cont__name">{p.name}</span>
                              {unread > 0 ? (
                                <small className="chat-user-cont__badge">{unread}</small>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ) : (
                <div className="WB-pop-person-chat">
                  <MessageList
                    key={selectedPeerId ?? 'private-empty'}
                    messages={privateMessages}
                    localUserId={localUserId}
                  />
                  <Composer
                    placeholder={`Message ${selectedPeer?.name ?? ''}...`}
                    onSend={sendMessage}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
