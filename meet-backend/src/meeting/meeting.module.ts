import { Module } from '@nestjs/common'
import { SyncModule } from '../sync/sync.module'
import { MeetingLifecycleController } from './meeting-lifecycle.controller'
import { MeetingLifecycleService } from './meeting-lifecycle.service'

@Module({
  imports: [SyncModule],
  controllers: [MeetingLifecycleController],
  providers: [MeetingLifecycleService],
  exports: [MeetingLifecycleService],
})
export class MeetingModule {}
