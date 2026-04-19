import { Module } from '@nestjs/common'
import { RedisModule } from '../redis/redis.module'
import { RoomSyncService } from './room-sync.service'

@Module({
  imports: [RedisModule],
  providers: [RoomSyncService],
  exports: [RoomSyncService],
})
export class SyncModule {}
