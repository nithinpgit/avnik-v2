import { Controller, Get, Param } from '@nestjs/common'
import { MeetingLifecycleService } from './meeting-lifecycle.service'

@Controller('rooms')
export class MeetingLifecycleController {
  constructor(private readonly lifecycle: MeetingLifecycleService) {}

  /** Restored on page reload before Socket.IO reconnects. */
  @Get(':roomId/lifecycle')
  async getLifecycle(@Param('roomId') roomId: string) {
    const meeting = await this.lifecycle.ensure(roomId)
    return { roomId, meeting }
  }
}
