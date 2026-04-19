import { Injectable } from '@nestjs/common'
import { Rooms } from './rooms'

@Injectable()
export class RoomsService {
  private readonly registry = new Rooms()

  joinRoom(roomId: string) {
    return this.registry.getOrCreate(roomId)
  }

  getRoom(roomId: string) {
    return this.registry.get(roomId)
  }

  pruneEmpty(roomId: string) {
    this.registry.pruneIfEmpty(roomId)
  }
}
