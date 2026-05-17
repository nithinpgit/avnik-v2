import { BadRequestException, Injectable } from '@nestjs/common'
import { RoomSyncService } from '../sync/room-sync.service'
import {
  DEFAULT_MEETING_LIFECYCLE,
  MEETING_LIFECYCLE_CHANNEL,
  type MeetingLifecycleState,
  type MeetingLifecycleStatus,
} from './meeting-lifecycle.types'

@Injectable()
export class MeetingLifecycleService {
  constructor(private readonly roomSync: RoomSyncService) {}

  private parse(raw: unknown): MeetingLifecycleState {
    if (!raw || typeof raw !== 'object') {
      return { ...DEFAULT_MEETING_LIFECYCLE }
    }
    const o = raw as Record<string, unknown>
    const status = o.status as MeetingLifecycleStatus
    const valid: MeetingLifecycleStatus[] = ['not_started', 'started', 'paused', 'ended']
    return {
      status: valid.includes(status) ? status : 'not_started',
      startedAt: typeof o.startedAt === 'string' ? o.startedAt : null,
      startedBy: typeof o.startedBy === 'string' ? o.startedBy : null,
    }
  }

  async get(roomId: string): Promise<MeetingLifecycleState> {
    const all = await this.roomSync.getAllParsed(roomId)
    const raw = all[MEETING_LIFECYCLE_CHANNEL]
    if (raw === undefined) {
      return { ...DEFAULT_MEETING_LIFECYCLE }
    }
    return this.parse(raw)
  }

  /** Returns persisted lifecycle, creating default `not_started` if missing. */
  async ensure(roomId: string): Promise<MeetingLifecycleState> {
    const current = await this.get(roomId)
    const all = await this.roomSync.getAllParsed(roomId)
    if (all[MEETING_LIFECYCLE_CHANNEL] !== undefined) {
      return current
    }
    await this.persist(roomId, current)
    return current
  }

  async persist(roomId: string, state: MeetingLifecycleState): Promise<void> {
    await this.roomSync.setChannel(roomId, MEETING_LIFECYCLE_CHANNEL, state)
  }

  async startMeeting(roomId: string, hostUserId: string): Promise<MeetingLifecycleState> {
    const current = await this.ensure(roomId)
    if (current.status === 'ended') {
      throw new BadRequestException('Meeting has already ended')
    }
    if (current.status === 'started') {
      return current
    }
    const next: MeetingLifecycleState = {
      status: 'started',
      startedAt: new Date().toISOString(),
      startedBy: hostUserId,
    }
    await this.persist(roomId, next)
    return next
  }

  isLive(status: MeetingLifecycleStatus): boolean {
    return status === 'started'
  }
}
