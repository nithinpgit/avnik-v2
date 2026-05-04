import { Body, Controller, Post } from '@nestjs/common'
import { MediaTokenRequestDto } from './dto/media-token.dto'
import { MediaTokenService } from './media-token.service'

@Controller('media')
export class MediaTokenController {
  constructor(private readonly mediaToken: MediaTokenService) {}

  /** Short-lived JWT for meet-mediaserver WebSocket (/ws). Independent SFU; same secret as mediaserver. */
  @Post('token')
  mint(@Body() body: MediaTokenRequestDto) {
    return this.mediaToken.mint({
      roomId: body.roomId,
      peerId: body.peerId,
      name: body.name,
    })
  }
}
