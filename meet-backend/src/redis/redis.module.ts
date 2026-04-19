import { Global, Module } from '@nestjs/common'
import Redis from 'ioredis'
import { REDIS_CLIENT } from './redis.constants'

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (): Redis | null => {
        const url = process.env.REDIS_URL?.trim()
        if (!url) {
          return null
        }
        return new Redis(url, {
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
        })
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
