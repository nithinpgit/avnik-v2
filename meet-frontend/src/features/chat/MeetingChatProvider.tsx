import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAppSelector } from '../../app/hooks'
import { useMeetingSocket } from '../meetingRoom/MeetingSocketProvider'
import {
  selectMeetingRoomId,
  selectMeetingUserId,
} from '../meetingSession/meetingSessionSlice'
import { selectParticipants } from '../videoConference/videoConferenceSlice'
import { fetchChatHistory, fetchChatUnread } from './chatApi'
import type { ChatMessage, ChatTab } from './chatTypes'
import { applyChatRead, mergeChatMessage } from './chatUtils'

export type MeetingChatContextValue = {
  isOpen: boolean
  openChat: () => void
  closeChat: () => void
  toggleChat: () => void
  activeTab: ChatTab
  setActiveTab: (tab: ChatTab) => void
  selectedPeerId: string | null
  setSelectedPeerId: (peerId: string | null) => void
  publicMessages: ChatMessage[]
  privateMessages: ChatMessage[]
  participants: ReturnType<typeof selectParticipants>
  localUserId: string
  sendMessage: (body: string) => void
  unreadTotal: number
  privateUnreadByPeer: Record<string, number>
  soundMuted: boolean
  setSoundMuted: (v: boolean) => void
}

const MeetingChatContext = createContext<MeetingChatContextValue | null>(null)

export function useMeetingChat(): MeetingChatContextValue {
  const ctx = useContext(MeetingChatContext)
  if (!ctx) {
    throw new Error('useMeetingChat must be used within MeetingChatProvider')
  }
  return ctx
}

export function MeetingChatProvider({ children }: { children: ReactNode }) {
  const { socket, presenceJoined } = useMeetingSocket()
  const roomId = useAppSelector(selectMeetingRoomId)
  const userId = useAppSelector(selectMeetingUserId)
  const participants = useAppSelector(selectParticipants)

  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<ChatTab>('public')
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null)
  const [publicMessages, setPublicMessages] = useState<ChatMessage[]>([])
  const [privateMessages, setPrivateMessages] = useState<ChatMessage[]>([])
  const [privateUnreadByPeer, setPrivateUnreadByPeer] = useState<Record<string, number>>({})
  const [publicUnread, setPublicUnread] = useState(0)
  const [soundMuted, setSoundMuted] = useState(false)

  const isOpenRef = useRef(isOpen)
  const activeTabRef = useRef(activeTab)
  const selectedPeerRef = useRef(selectedPeerId)
  isOpenRef.current = isOpen
  activeTabRef.current = activeTab
  selectedPeerRef.current = selectedPeerId

  const openChat = useCallback(() => setIsOpen(true), [])
  const closeChat = useCallback(() => setIsOpen(false), [])
  const toggleChat = useCallback(() => setIsOpen((o) => !o), [])

  const refreshUnread = useCallback(async () => {
    if (!roomId || !userId) return
    const counts = await fetchChatUnread(roomId, userId)
    setPublicUnread(counts.public)
  }, [roomId, userId])

  const loadPublicHistory = useCallback(async () => {
    if (!roomId || !userId) return
    const messages = await fetchChatHistory(roomId, userId, 'public')
    setPublicMessages(messages)
  }, [roomId, userId])

  const loadPrivateHistory = useCallback(
    async (peerId: string) => {
      if (!roomId || !userId) return
      const messages = await fetchChatHistory(roomId, userId, 'private', peerId)
      setPrivateMessages(messages)
    },
    [roomId, userId],
  )

  useEffect(() => {
    if (!presenceJoined || !roomId || !userId) {
      setPublicMessages([])
      setPrivateMessages([])
      setPrivateUnreadByPeer({})
      setPublicUnread(0)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        await loadPublicHistory()
        if (!cancelled) {
          await refreshUnread()
        }
      } catch (e) {
        console.error('chat history load failed', e)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [presenceJoined, roomId, userId, loadPublicHistory, refreshUnread])

  useEffect(() => {
    if (activeTab === 'private' && selectedPeerId) {
      void loadPrivateHistory(selectedPeerId)
    }
  }, [activeTab, selectedPeerId, loadPrivateHistory])

  const markRead = useCallback(
    (messageIds: string[]) => {
      if (!socket?.connected || !roomId || messageIds.length === 0) return
      socket.emit('chat_mark_read', { roomId, messageIds })
    },
    [socket, roomId],
  )

  const markThreadRead = useCallback(
    (messages: ChatMessage[]) => {
      const unreadIds = messages.filter((m) => m.senderId !== userId && !m.readByMe).map((m) => m.id)
      if (unreadIds.length > 0) markRead(unreadIds)
    },
    [markRead, userId],
  )

  useEffect(() => {
    if (!isOpen) return
    if (activeTab === 'public') {
      markThreadRead(publicMessages)
      setPublicUnread(0)
    } else if (selectedPeerId) {
      markThreadRead(privateMessages)
      setPrivateUnreadByPeer((prev) => {
        if (!prev[selectedPeerId]) return prev
        const next = { ...prev }
        delete next[selectedPeerId]
        return next
      })
    }
  }, [isOpen, activeTab, selectedPeerId, publicMessages, privateMessages, markThreadRead])

  const shouldNotify = useCallback(
    (msg: ChatMessage) => {
      if (msg.senderId === userId) return false
      if (!isOpenRef.current) return true
      if (msg.kind === 'public' && activeTabRef.current !== 'public') return true
      if (
        msg.kind === 'private' &&
        (activeTabRef.current !== 'private' ||
          selectedPeerRef.current !== msg.senderId)
      ) {
        return true
      }
      return false
    },
    [userId],
  )

  useEffect(() => {
    if (!socket) return

    const onMessage = (payload: { message: ChatMessage }) => {
      const msg = payload.message
      if (!msg || msg.roomId !== roomId) return

      if (msg.kind === 'public') {
        setPublicMessages((list) => mergeChatMessage(list, msg))
        if (shouldNotify(msg)) {
          setPublicUnread((n) => n + 1)
          if (!soundMuted) {
            try {
              new Audio('/notification.mp3').play().catch(() => {})
            } catch {
              /* optional sound asset */
            }
          }
        } else if (isOpenRef.current && activeTabRef.current === 'public') {
          markRead([msg.id])
        }
      } else if (msg.recipientId) {
        const peerId = msg.senderId === userId ? msg.recipientId : msg.senderId
        if (selectedPeerRef.current === peerId || msg.senderId === userId) {
          setPrivateMessages((list) => mergeChatMessage(list, msg))
        }
        if (shouldNotify(msg)) {
          const fromPeer = msg.senderId
          setPrivateUnreadByPeer((prev) => ({
            ...prev,
            [fromPeer]: (prev[fromPeer] ?? 0) + 1,
          }))
        } else if (
          isOpenRef.current &&
          activeTabRef.current === 'private' &&
          selectedPeerRef.current === peerId
        ) {
          markRead([msg.id])
        }
      }
    }

    const onRead = (payload: {
      roomId: string
      messageIds: string[]
      userId: string
      userName: string
      readAt: string
    }) => {
      if (payload.roomId !== roomId) return
      const reader = {
        userId: payload.userId,
        userName: payload.userName,
        readAt: payload.readAt,
      }
      setPublicMessages((list) => applyChatRead(list, payload.messageIds, reader))
      setPrivateMessages((list) => applyChatRead(list, payload.messageIds, reader))
    }

    const onError = (payload: { message?: string }) => {
      console.error('chat_error', payload)
    }

    socket.on('chat_message', onMessage)
    socket.on('chat_read', onRead)
    socket.on('chat_error', onError)

    return () => {
      socket.off('chat_message', onMessage)
      socket.off('chat_read', onRead)
      socket.off('chat_error', onError)
    }
  }, [socket, roomId, shouldNotify, soundMuted, markRead])

  const sendMessage = useCallback(
    (body: string) => {
      const text = body.trim()
      if (!text || !socket?.connected || !roomId || !userId) return
      if (activeTab === 'public') {
        socket.emit('chat_send', { roomId, body: text, kind: 'public' })
      } else if (selectedPeerId) {
        socket.emit('chat_send', {
          roomId,
          body: text,
          kind: 'private',
          recipientId: selectedPeerId,
        })
      }
    },
    [socket, roomId, userId, activeTab, selectedPeerId],
  )

  const unreadTotal =
    publicUnread + Object.values(privateUnreadByPeer).reduce((a, b) => a + b, 0)

  const value = useMemo<MeetingChatContextValue>(
    () => ({
      isOpen,
      openChat,
      closeChat,
      toggleChat,
      activeTab,
      setActiveTab,
      selectedPeerId,
      setSelectedPeerId,
      publicMessages,
      privateMessages,
      participants,
      localUserId: userId ?? '',
      sendMessage,
      unreadTotal,
      privateUnreadByPeer,
      soundMuted,
      setSoundMuted,
    }),
    [
      isOpen,
      openChat,
      closeChat,
      toggleChat,
      activeTab,
      selectedPeerId,
      publicMessages,
      privateMessages,
      participants,
      userId,
      sendMessage,
      unreadTotal,
      privateUnreadByPeer,
      soundMuted,
    ],
  )

  return <MeetingChatContext.Provider value={value}>{children}</MeetingChatContext.Provider>
}
