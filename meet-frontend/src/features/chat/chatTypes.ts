export type ChatMessageKind = 'public' | 'private'

export type ChatSeenBy = {
  userId: string
  userName: string
  readAt: string
}

export type ChatMessage = {
  id: string
  roomId: string
  senderId: string
  senderName: string
  kind: ChatMessageKind
  recipientId: string | null
  body: string
  createdAt: string
  readByMe: boolean
  seenBy: ChatSeenBy[]
}

export type ChatTab = 'public' | 'private'
