import type { ChatMessage, ChatMessageKind } from './chatTypes'

export async function fetchChatHistory(
  roomId: string,
  userId: string,
  kind: ChatMessageKind,
  peerId?: string,
): Promise<ChatMessage[]> {
  const params = new URLSearchParams({ userId, kind })
  if (kind === 'private' && peerId) {
    params.set('peerId', peerId)
  }
  const res = await fetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/history?${params}`, {
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(`chat history ${res.status}`)
  }
  const data = (await res.json()) as { messages: ChatMessage[] }
  return data.messages ?? []
}

export async function fetchChatUnread(
  roomId: string,
  userId: string,
): Promise<{ public: number; private: number; total: number }> {
  const params = new URLSearchParams({ userId })
  const res = await fetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/unread?${params}`, {
    credentials: 'include',
  })
  if (!res.ok) {
    return { public: 0, private: 0, total: 0 }
  }
  return (await res.json()) as { public: number; private: number; total: number }
}
