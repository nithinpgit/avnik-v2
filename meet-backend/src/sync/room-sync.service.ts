import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import type Redis from 'ioredis'
import { REDIS_CLIENT } from '../redis/redis.constants'

const ROOM_HASH_PREFIX = 'room:'

/** Max serialized JSON size per channel (bytes). */
export const MAX_ROOM_SYNC_CHANNEL_BYTES = 1_500_000

/**
 * Centralized persisted room state per logical channel (e.g. whiteboard, future chat transcript).
 * Backed by Redis HASH `room:{roomId}:channels` → field = channel, value = JSON string.
 * When REDIS_URL is unset, falls back to in-memory storage (single-node dev only).
 */
@Injectable()
export class RoomSyncService implements OnModuleDestroy {
  private readonly logger = new Logger(RoomSyncService.name)
  private readonly memory = new Map<string, Map<string, string>>()

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | null) {}

  onModuleDestroy() {
    if (this.redis) {
      void this.redis.quit()
    }
  }

  private hashKey(roomId: string): string {
    return `${ROOM_HASH_PREFIX}${roomId}:channels`
  }

  async getAllParsed(roomId: string): Promise<Record<string, unknown>> {
    if (this.redis) {
      try {
        const raw = await this.redis.hgetall(this.hashKey(roomId))
        return this.parseHash(raw)
      } catch (e) {
        this.logger.warn(`Redis hgetall failed for ${roomId}, using memory: ${String(e)}`)
      }
    }
    const m = this.memory.get(roomId)
    if (!m) return {}
    return this.parseHash(Object.fromEntries(m))
  }

  private parseHash(raw: Record<string, string>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(raw)) {
      if (!v) continue
      try {
        out[k] = JSON.parse(v) as unknown
      } catch {
        out[k] = v
      }
    }
    return out
  }

  async setChannel(roomId: string, channel: string, payload: unknown): Promise<void> {
    const json = JSON.stringify(payload ?? null)
    if (json.length > MAX_ROOM_SYNC_CHANNEL_BYTES) {
      throw new Error(`room_sync payload exceeds ${MAX_ROOM_SYNC_CHANNEL_BYTES} bytes`)
    }
    if (this.redis) {
      try {
        await this.redis.hset(this.hashKey(roomId), channel, json)
        return
      } catch (e) {
        this.logger.warn(`Redis hset failed for ${roomId}/${channel}, using memory: ${String(e)}`)
      }
    }
    let m = this.memory.get(roomId)
    if (!m) {
      m = new Map()
      this.memory.set(roomId, m)
    }
    m.set(channel, json)
  }

  /** Optional: clear room state when room is pruned (future). */
  clearRoomLocal(roomId: string): void {
    this.memory.delete(roomId)
  }
}
