import type { ChatMessage } from './chatTypes'

export function formatChatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function mergeChatMessage(list: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  if (list.some((m) => m.id === incoming.id)) return list
  return [...list, incoming].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
}

export function applyChatRead(
  list: ChatMessage[],
  messageIds: string[],
  reader: { userId: string; userName: string; readAt: string },
): ChatMessage[] {
  const ids = new Set(messageIds)
  return list.map((m) => {
    if (!ids.has(m.id)) return m
    const readByMe = m.senderId !== reader.userId ? true : m.readByMe
    const seenBy =
      m.senderId !== reader.userId && !m.seenBy.some((s) => s.userId === reader.userId)
        ? [...m.seenBy, { userId: reader.userId, userName: reader.userName, readAt: reader.readAt }]
        : m.seenBy
    return { ...m, readByMe, seenBy }
  })
}

export function privateThreadKey(a: string, b: string): string {
  return [a, b].sort().join(':')
}
