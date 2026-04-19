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
      client.to(roomId).emit('room_snapshot', room.snapshot())
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

    const snapshot = room.snapshot()
    client.emit('room_snapshot', snapshot)

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

    try {
      await this.roomSyncService.setChannel(dto.roomId, dto.channel, dto.payload)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Persist failed'
      client.emit('room_sync_error', { message: msg })
      return
    }

    client.to(dto.roomId).emit('room_sync', {
      channel: dto.channel,
      payload: dto.payload,
    })
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
      client.to(roomId).emit('room_snapshot', room.snapshot())
    }
    delete (client.data as SocketData).roomId
    delete (client.data as SocketData).userId
  }
}
