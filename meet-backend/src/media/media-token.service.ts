import { Injectable, UnauthorizedException } from '@nestjs/common'
import * as jwt from 'jsonwebtoken'

export type MediaJwtPayload = {
  roomId: string
  peerId: string
  name?: string
}

@Injectable()
export class MediaTokenService {
  private readonly secret = process.env.MEDIA_JWT_SECRET?.trim()
  private readonly ttlSec = Number(process.env.MEDIA_JWT_TTL_SEC) || 600

  mint(payload: MediaJwtPayload): { accessToken: string; expiresIn: number } {
    if (!this.secret) {
      throw new UnauthorizedException('MEDIA_JWT_SECRET is not configured')
    }
    const accessToken = jwt.sign(
      { roomId: payload.roomId, peerId: payload.peerId, name: payload.name },
      this.secret,
      { expiresIn: this.ttlSec },
    )
    return { accessToken, expiresIn: this.ttlSec }
  }
}
