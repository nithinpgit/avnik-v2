import { Module } from '@nestjs/common'
import { MediaTokenController } from './media-token.controller'
import { MediaTokenService } from './media-token.service'

@Module({
  controllers: [MediaTokenController],
  providers: [MediaTokenService],
  exports: [MediaTokenService],
})
export class MediaModule {}
