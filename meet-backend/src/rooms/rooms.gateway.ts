import { Logger } from '@nestjs/common'
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import type { Server, Socket } from 'socket.io'
import { ChatService } from '../chat/chat.service'
import { ChatMarkReadDto } from '../chat/dto/chat-mark-read.dto'
import { ChatSendDto } from '../chat/dto/chat-send.dto'
import { MEETING_LIFECYCLE_CHANNEL } from '../meeting/meeting-lifecycle.types'
import { MeetingLifecycleService } from '../meeting/meeting-lifecycle.service'
import { RoomSyncDto } from '../sync/dto/room-sync.dto'
import { MAX_ROOM_SYNC_CHANNEL_BYTES, RoomSyncService } from '../sync/room-sync.service'
import { JoinRoomDto } from './dto/join-room.dto'
import { RoomsService } from './rooms.service'

type SocketData = {
  roomId?: string
  userId?: string
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()) ?? ['http://localhost:5173'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class RoomsGateway implements OnGatewayInit, OnGatewayDisconnect {
  private readonly logger = new Logger(RoomsGateway.name)

  @WebSocketServer()
  server!: Server

  constructor(
    private readonly roomsService: RoomsService,
    private readonly roomSyncService: RoomSyncService,
    private readonly meetingLifecycle: MeetingLifecycleService,
    private readonly chatService: ChatService,
  ) {}

  afterInit(server: Server) {
    server.use((socket, next) => {
      // Reserved for auth: socket.handshake.auth.token, signed cookies, etc.
      void socket.handshake.address
      next()
    })
  }

  handleDisconnect(client: Socket) {
    const data = client.data as SocketData
    const roomId = data.roomId
    if (!roomId) {
      return
    }
    const room = this.roomsService.getRoom(roomId)
    if (!room) {
      return
    }
    const left = room.removeBySocketId(client.id)
    void client.leave(roomId)
    this.roomsService.pruneEmpty(roomId)
    if (left) {
      client.to(roomId).emit('peer_left', { userId: left.userId })
      void this.emitRoomSnapshot(roomId)
    }
  }

  @SubscribeMessage('join_room')
  async joinRoom(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): Promise<void> {
    const dto = plainToInstance(JoinRoomDto, body ?? {})
    const errors = validateSync(dto, { forbidUnknownValues: false })
    if (errors.length > 0) {
      client.emit('join_error', {
        message: 'Invalid join payload',
        details: errors.map((e) => ({ property: e.property, constraints: e.constraints })),
      })
      return
    }

    const prevRoomId = (client.data as SocketData).roomId
    if (prevRoomId && prevRoomId !== dto.roomId) {
      this.leaveRoomSocket(client, prevRoomId)
    }

    const room = this.roomsService.joinRoom(dto.roomId)
    const previous = room.peersByUserId.get(dto.userId)
    const { peer, roleAssigned } = room.upsertPeer({
      userId: dto.userId,
      name: dto.name,
      requestedRole: dto.role,
      profileImage: dto.profileImage ?? null,
      socketId: client.id,
    })
    if (previous && previous.socketId !== client.id) {
      this.server.sockets.sockets.get(previous.socketId)?.disconnect(true)
    }

    void client.join(dto.roomId)
    ;(client.data as SocketData).roomId = dto.roomId
    ;(client.data as SocketData).userId = dto.userId

    const meeting = await this.meetingLifecycle.ensure(dto.roomId)
    client.emit('room_snapshot', room.snapshot(meeting))

    try {
      const states = await this.roomSyncService.getAllParsed(dto.roomId)
      client.emit('room_sync_bulk', { states })
    } catch (e) {
      this.logger.warn(`room_sync_bulk failed for ${dto.roomId}: ${String(e)}`)
      client.emit('room_sync_bulk', { states: {} })
    }

    if (roleAssigned !== dto.role) {
      client.emit('role_updated', { userId: dto.userId, role: roleAssigned })
    }

    client.to(dto.roomId).emit('peer_joined', { peer: peer.toPublic() })

    this.logger.debug(`Socket ${client.id} joined room ${dto.roomId} as ${dto.userId}`)
  }

  /**
   * Generic room document sync (whiteboard, future shared state). Persists to Redis and
   * broadcasts to other peers in the same Socket.IO room.
   */
  @SubscribeMessage('room_sync')
  async roomSync(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): Promise<void> {
    const dto = plainToInstance(RoomSyncDto, body ?? {})
    const errors = validateSync(dto, { forbidUnknownValues: false })
    if (errors.length > 0) {
      client.emit('room_sync_error', {
        message: 'Invalid room_sync payload',
        details: errors.map((e) => ({ property: e.property, constraints: e.constraints })),
      })
      return
    }

    const data = client.data as SocketData
    if (!data.roomId || data.roomId !== dto.roomId) {
      client.emit('room_sync_error', { message: 'Must join_room before room_sync' })
      return
    }

    const size = Buffer.byteLength(JSON.stringify(dto.payload ?? null), 'utf8')
    if (size > MAX_ROOM_SYNC_CHANNEL_BYTES) {
      client.emit('room_sync_error', {
        message: `Payload exceeds max size (${MAX_ROOM_SYNC_CHANNEL_BYTES} bytes)`,
      })
      return
    }

    if (dto.channel === MEETING_LIFECYCLE_CHANNEL) {
      client.emit('room_sync_error', {
        message: 'meeting_lifecycle is server-controlled; use start_meeting',
      })
      return
    }

    try {
      await this.roomSyncService.setChannel(dto.roomId, dto.channel, dto.payload)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Persist failed'
      client.emit('room_sync_error', { message: msg })
      return
    }

    this.server.to(dto.roomId).emit('room_sync', {
      channel: dto.channel,
      payload: dto.payload,
    })
  }

  @SubscribeMessage('pause_meeting')
  async pauseMeeting(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): Promise<void> {
    const data = client.data as SocketData
    const roomId = typeof body === 'object' && body !== null && 'roomId' in body
      ? String((body as { roomId: unknown }).roomId)
      : data.roomId
    if (!roomId || data.roomId !== roomId || !data.userId) {
      client.emit('meeting_error', { message: 'Must join_room before pause_meeting' })
      return
    }

    const room = this.roomsService.getRoom(roomId)
    if (!room) {
      client.emit('meeting_error', { message: 'Room not found' })
      return
    }

    if (room.hostUserId !== data.userId) {
      client.emit('meeting_error', { message: 'Only the host can pause the meeting' })
      return
    }

    try {
      const meeting = await this.meetingLifecycle.pauseMeeting(roomId, data.userId)
      this.broadcastMeetingLifecycle(roomId, meeting)
      this.logger.debug(`Meeting paused in ${roomId} by ${data.userId}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Pause failed'
      client.emit('meeting_error', { message: msg })
    }
  }

  @SubscribeMessage('start_meeting')
  async startMeeting(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): Promise<void> {
    const data = client.data as SocketData
    const roomId = typeof body === 'object' && body !== null && 'roomId' in body
      ? String((body as { roomId: unknown }).roomId)
      : data.roomId
    if (!roomId || data.roomId !== roomId || !data.userId) {
      client.emit('meeting_error', { message: 'Must join_room before start_meeting' })
      return
    }

    const room = this.roomsService.getRoom(roomId)
    if (!room) {
      client.emit('meeting_error', { message: 'Room not found' })
      return
    }

    if (room.hostUserId !== data.userId) {
      client.emit('meeting_error', { message: 'Only the host can start the meeting' })
      return
    }

    try {
      const meeting = await this.meetingLifecycle.startMeeting(roomId, data.userId)
      this.broadcastMeetingLifecycle(roomId, meeting)
      this.logger.debug(`Meeting started in ${roomId} by ${data.userId}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Start failed'
      client.emit('meeting_error', { message: msg })
    }
  }

  @SubscribeMessage('chat_send')
  async chatSend(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): Promise<void> {
    const dto = plainToInstance(ChatSendDto, body ?? {})
    const errors = validateSync(dto, { forbidUnknownValues: false })
    if (errors.length > 0) {
      client.emit('chat_error', {
        message: 'Invalid chat_send payload',
        details: errors.map((e) => ({ property: e.property, constraints: e.constraints })),
      })
      return
    }

    const data = client.data as SocketData
    if (!data.roomId || data.roomId !== dto.roomId || !data.userId) {
      client.emit('chat_error', { message: 'Must join_room before chat_send' })
      return
    }

    const room = this.roomsService.getRoom(dto.roomId)
    if (!room) {
      client.emit('chat_error', { message: 'Room not found' })
      return
    }

    const sender = room.peersByUserId.get(data.userId)
    if (!sender) {
      client.emit('chat_error', { message: 'Sender not in room' })
      return
    }

    if (dto.kind === 'private') {
      const recipient = room.peersByUserId.get(dto.recipientId!)
      if (!recipient) {
        client.emit('chat_error', { message: 'Recipient not in room' })
        return
      }
    }

    try {
      const message = await this.chatService.createMessage({
        roomId: dto.roomId,
        senderId: data.userId,
        senderName: sender.name,
        kind: dto.kind,
        recipientId: dto.recipientId ?? null,
        body: dto.body,
      })

      const payload = { message }
      if (dto.kind === 'public') {
        this.server.to(dto.roomId).emit('chat_message', payload)
      } else {
        this.emitChatToUsers(dto.roomId, [data.userId, dto.recipientId!], payload)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Send failed'
      client.emit('chat_error', { message: msg })
    }
  }

  @SubscribeMessage('chat_mark_read')
  async chatMarkRead(@ConnectedSocket() client: Socket, @MessageBody() body: unknown): Promise<void> {
    const dto = plainToInstance(ChatMarkReadDto, body ?? {})
    const errors = validateSync(dto, { forbidUnknownValues: false })
    if (errors.length > 0) {
      client.emit('chat_error', {
        message: 'Invalid chat_mark_read payload',
        details: errors.map((e) => ({ property: e.property, constraints: e.constraints })),
      })
      return
    }

    const data = client.data as SocketData
    if (!data.roomId || data.roomId !== dto.roomId || !data.userId) {
      client.emit('chat_error', { message: 'Must join_room before chat_mark_read' })
      return
    }

    const room = this.roomsService.getRoom(dto.roomId)
    const reader = room?.peersByUserId.get(data.userId)
    if (!reader) {
      client.emit('chat_error', { message: 'Reader not in room' })
      return
    }

    try {
      const result = await this.chatService.markRead({
        roomId: dto.roomId,
        userId: data.userId,
        userName: reader.name,
        messageIds: dto.messageIds,
      })
      if (result.messageIds.length === 0) return

      this.server.to(dto.roomId).emit('chat_read', {
        roomId: dto.roomId,
        messageIds: result.messageIds,
        userId: data.userId,
        userName: reader.name,
        readAt: result.readAt,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Mark read failed'
      client.emit('chat_error', { message: msg })
    }
  }

  private emitChatToUsers(roomId: string, userIds: string[], payload: unknown) {
    const room = this.roomsService.getRoom(roomId)
    if (!room) return
    const seen = new Set<string>()
    for (const uid of userIds) {
      if (seen.has(uid)) continue
      seen.add(uid)
      const peer = room.peersByUserId.get(uid)
      if (peer) {
        this.server.to(peer.socketId).emit('chat_message', payload)
      }
    }
  }

  private leaveRoomSocket(client: Socket, roomId: string) {
    const room = this.roomsService.getRoom(roomId)
    if (!room) {
      void client.leave(roomId)
      return
    }
    const left = room.removeBySocketId(client.id)
    void client.leave(roomId)
    this.roomsService.pruneEmpty(roomId)
    if (left) {
      client.to(roomId).emit('peer_left', { userId: left.userId })
      void this.emitRoomSnapshot(roomId)
    }
    delete (client.data as SocketData).roomId
    delete (client.data as SocketData).userId
  }

  private async emitRoomSnapshot(roomId: string): Promise<void> {
    const room = this.roomsService.getRoom(roomId)
    if (!room) return
    const meeting = await this.meetingLifecycle.get(roomId)
    this.server.to(roomId).emit('room_snapshot', room.snapshot(meeting))
  }

  private broadcastMeetingLifecycle(roomId: string, meeting: Awaited<ReturnType<MeetingLifecycleService['startMeeting']>>) {
    this.server.to(roomId).emit('meeting_lifecycle', { meeting })
    this.server.to(roomId).emit('room_sync', {
      channel: MEETING_LIFECYCLE_CHANNEL,
      payload: meeting,
    })
  }
}
