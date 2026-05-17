import { Module } from '@nestjs/common'
import { ChatModule } from '../chat/chat.module'
import { MeetingModule } from '../meeting/meeting.module'
import { SyncModule } from '../sync/sync.module'
import { RoomsGateway } from './rooms.gateway'
import { RoomsService } from './rooms.service'

@Module({
  imports: [SyncModule, ChatModule, MeetingModule],
  providers: [RoomsService, RoomsGateway],
  exports: [RoomsService],
})
export class RoomsModule {}
