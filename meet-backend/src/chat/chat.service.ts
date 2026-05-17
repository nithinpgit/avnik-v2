import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import type { ChatMessageKind } from './entities/chat-message.entity'
import { ChatMessageEntity } from './entities/chat-message.entity'
import { ChatMessageReadEntity } from './entities/chat-message-read.entity'
import type { ChatMessageDto, ChatSeenByDto } from './chat.types'

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessageEntity)
    private readonly messages: Repository<ChatMessageEntity>,
    @InjectRepository(ChatMessageReadEntity)
    private readonly reads: Repository<ChatMessageReadEntity>,
  ) {}

  async createMessage(input: {
    roomId: string
    senderId: string
    senderName: string
    kind: ChatMessageKind
    recipientId?: string | null
    body: string
  }): Promise<ChatMessageDto> {
    const body = input.body.trim()
    if (!body) {
      throw new BadRequestException('Message body is empty')
    }
    if (input.kind === 'private') {
      if (!input.recipientId?.trim()) {
        throw new BadRequestException('recipientId is required for private messages')
      }
      if (input.recipientId === input.senderId) {
        throw new BadRequestException('Cannot send a private message to yourself')
      }
    }

    const row = this.messages.create({
      roomId: input.roomId,
      senderId: input.senderId,
      senderName: input.senderName.trim() || input.senderId,
      kind: input.kind,
      recipientId: input.kind === 'private' ? input.recipientId!.trim() : null,
      body,
    })
    const saved = await this.messages.save(row)
    return this.toDto(saved, input.senderId, [], true)
  }

  async getHistory(input: {
    roomId: string
    viewerId: string
    kind: ChatMessageKind
    peerId?: string
    limit?: number
    before?: Date
  }): Promise<ChatMessageDto[]> {
    const limit = Math.min(input.limit ?? 100, 200)
    const qb = this.messages
      .createQueryBuilder('m')
      .where('m.room_id = :roomId', { roomId: input.roomId })
      .andWhere('m.kind = :kind', { kind: input.kind })

    if (input.kind === 'public') {
      qb.andWhere('m.recipient_id IS NULL')
    } else {
      const peerId = input.peerId?.trim()
      if (!peerId) {
        throw new BadRequestException('peerId is required for private history')
      }
      qb.andWhere(
        '(m.sender_id = :viewer AND m.recipient_id = :peer) OR (m.sender_id = :peer AND m.recipient_id = :viewer)',
        { viewer: input.viewerId, peer: peerId },
      )
    }

    if (input.before) {
      qb.andWhere('m.created_at < :before', { before: input.before })
    }

    const rows = await qb.orderBy('m.created_at', 'ASC').take(limit).getMany()
    return this.enrichForViewer(rows, input.viewerId)
  }

  async markRead(input: {
    roomId: string
    userId: string
    userName: string
    messageIds: string[]
  }): Promise<{ messageIds: string[]; readAt: string }> {
    if (input.messageIds.length === 0) {
      return { messageIds: [], readAt: new Date().toISOString() }
    }

    const uniqueIds = [...new Set(input.messageIds)]
    const found = await this.messages.find({
      where: { id: In(uniqueIds), roomId: input.roomId },
    })
    if (found.length === 0) {
      return { messageIds: [], readAt: new Date().toISOString() }
    }

    const allowed = found.filter((m) => this.viewerMayReadMessage(m, input.userId))
    const readAt = new Date()
    const inserted: string[] = []

    for (const msg of allowed) {
      const existing = await this.reads.findOne({
        where: { messageId: msg.id, userId: input.userId },
      })
      if (existing) continue
      await this.reads.save(
        this.reads.create({
          messageId: msg.id,
          userId: input.userId,
          userName: input.userName.trim() || input.userId,
          readAt,
        }),
      )
      inserted.push(msg.id)
    }

    return { messageIds: inserted, readAt: readAt.toISOString() }
  }

  async getSeenByForMessages(messageIds: string[]): Promise<Map<string, ChatSeenByDto[]>> {
    const map = new Map<string, ChatSeenByDto[]>()
    if (messageIds.length === 0) return map

    const rows = await this.reads.find({
      where: { messageId: In(messageIds) },
      order: { readAt: 'ASC' },
    })
    for (const r of rows) {
      const list = map.get(r.messageId) ?? []
      list.push({
        userId: r.userId,
        userName: r.userName,
        readAt: r.readAt.toISOString(),
      })
      map.set(r.messageId, list)
    }
    return map
  }

  private viewerMayReadMessage(m: ChatMessageEntity, viewerId: string): boolean {
    if (m.kind === 'public') return true
    return m.senderId === viewerId || m.recipientId === viewerId
  }

  private async enrichForViewer(rows: ChatMessageEntity[], viewerId: string): Promise<ChatMessageDto[]> {
    const ids = rows.map((r) => r.id)
    const reads = await this.reads.find({ where: { messageId: In(ids) } })
    const readsByMessage = new Map<string, ChatMessageReadEntity[]>()
    for (const r of reads) {
      const list = readsByMessage.get(r.messageId) ?? []
      list.push(r)
      readsByMessage.set(r.messageId, list)
    }

    return rows.map((row) => {
      const msgReads = readsByMessage.get(row.id) ?? []
      const readByMe = msgReads.some((r) => r.userId === viewerId)
      const seenBy: ChatSeenByDto[] =
        row.senderId === viewerId
          ? msgReads
              .filter((r) => r.userId !== viewerId)
              .map((r) => ({
                userId: r.userId,
                userName: r.userName,
                readAt: r.readAt.toISOString(),
              }))
          : []
      return this.toDto(row, viewerId, seenBy, readByMe)
    })
  }

  private toDto(
    row: ChatMessageEntity,
    viewerId: string,
    seenBy: ChatSeenByDto[],
    readByMe: boolean,
  ): ChatMessageDto {
    return {
      id: row.id,
      roomId: row.roomId,
      senderId: row.senderId,
      senderName: row.senderName,
      kind: row.kind,
      recipientId: row.recipientId,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      readByMe,
      seenBy,
    }
  }

  /** Unread counts for notification badge (messages from others not read by viewer). */
  async countUnread(roomId: string, viewerId: string): Promise<{ public: number; private: number }> {
    const publicUnread = await this.messages
      .createQueryBuilder('m')
      .leftJoin(
        ChatMessageReadEntity,
        'r',
        'r.message_id = m.id AND r.user_id = :viewerId',
        { viewerId },
      )
      .where('m.room_id = :roomId', { roomId })
      .andWhere('m.kind = :kind', { kind: 'public' })
      .andWhere('m.sender_id != :viewerId', { viewerId })
      .andWhere('r.id IS NULL')
      .getCount()

    const privateUnread = await this.messages
      .createQueryBuilder('m')
      .leftJoin(
        ChatMessageReadEntity,
        'r',
        'r.message_id = m.id AND r.user_id = :viewerId',
        { viewerId },
      )
      .where('m.room_id = :roomId', { roomId })
      .andWhere('m.kind = :kind', { kind: 'private' })
      .andWhere('m.recipient_id = :viewerId', { viewerId })
      .andWhere('m.sender_id != :viewerId', { viewerId })
      .andWhere('r.id IS NULL')
      .getCount()

    return { public: publicUnread, private: privateUnread }
  }
}
