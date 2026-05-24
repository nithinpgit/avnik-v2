import { IsIn, IsString, MaxLength, MinLength } from 'class-validator'
import type { ParticipantControlAction } from '../../participant/participant-moderation.types'

const ACTIONS: ParticipantControlAction[] = [
  'mute_mic',
  'unmute_mic',
  'disable_cam',
  'enable_cam',
  'make_presenter',
  'revoke_presenter',
  'kick',
]

export class ParticipantControlDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  roomId!: string

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  targetUserId!: string

  @IsString()
  @IsIn(ACTIONS)
  action!: ParticipantControlAction
}
