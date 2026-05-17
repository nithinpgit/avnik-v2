import { Controller, Get, Param, Query } from '@nestjs/common'
import { ChatHistoryQueryDto } from './dto/chat-history-query.dto'
import { ChatService } from './chat.service'

@Controller('chat/rooms')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  /** Load persisted chat history for a room (public or private thread). */
  @Get(':roomId/history')
  async history(@Param('roomId') roomId: string, @Query() query: ChatHistoryQueryDto) {
    const before = query.before ? new Date(query.before) : undefined
    const messages = await this.chat.getHistory({
      roomId,
      viewerId: query.userId,
      kind: query.kind,
      peerId: query.peerId,
      limit: query.limit,
      before,
    })
    return { roomId, kind: query.kind, peerId: query.peerId ?? null, messages }
  }

  @Get(':roomId/unread')
  async unread(@Param('roomId') roomId: string, @Query('userId') userId: string) {
    if (!userId?.trim()) {
      return { public: 0, private: 0, total: 0 }
    }
    const counts = await this.chat.countUnread(roomId, userId.trim())
    return { ...counts, total: counts.public + counts.private }
  }
}
