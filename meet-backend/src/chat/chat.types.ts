import type { ChatMessageKind } from './entities/chat-message.entity'

export type ChatSeenByDto = {
  userId: string
  userName: string
  readAt: string
}

export type ChatMessageDto = {
  id: string
  roomId: string
  senderId: string
  senderName: string
  kind: ChatMessageKind
  recipientId: string | null
  body: string
  createdAt: string
  readByMe: boolean
  seenBy: ChatSeenByDto[]
}
