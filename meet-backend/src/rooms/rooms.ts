import { Room } from './room'

/**
 * Registry of all in-memory meeting rooms.
 */
export class Rooms {
  private readonly rooms = new Map<string, Room>()

  getOrCreate(roomId: string): Room {
    let room = this.rooms.get(roomId)
    if (!room) {
      room = new Room(roomId)
      this.rooms.set(roomId, room)
    }
    return room
  }

  get(roomId: string): Room | undefined {
    return this.rooms.get(roomId)
  }

  /** Removes empty rooms to limit unbounded growth (optional hygiene). */
  pruneIfEmpty(roomId: string): void {
    const room = this.rooms.get(roomId)
    if (room && room.peersByUserId.size === 0) {
      this.rooms.delete(roomId)
    }
  }
}
