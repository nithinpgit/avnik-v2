import type { Router } from 'mediasoup/types'
import { logger } from './logger.js'
import { getWorker, mediaCodecs } from './worker.js'
import { MediaRoom } from './mediaRoom.js'

/** One router per SFU room (scale horizontally by sharding roomId in K8s). */
export class RoomManager {
  private readonly rooms = new Map<string, MediaRoom>()

  async getOrCreateRoom(roomId: string): Promise<MediaRoom> {
    let room = this.rooms.get(roomId)
    if (room) return room
    const worker = await getWorker()
    const router: Router = await worker.createRouter({ mediaCodecs })
    room = new MediaRoom(roomId, router, () => {
      this.rooms.delete(roomId)
      void router.close()
      logger.info({ roomId }, 'room closed (empty)')
    })
    this.rooms.set(roomId, room)
    logger.info({ roomId }, 'room created')
    return room
  }

  getRoom(roomId: string): MediaRoom | undefined {
    return this.rooms.get(roomId)
  }
}
