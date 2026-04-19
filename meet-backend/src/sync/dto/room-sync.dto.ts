import { Allow, IsString, Matches, MaxLength, MinLength } from 'class-validator'

export class RoomSyncDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  roomId!: string

  /** Lowercase identifier: whiteboard, chat_state, etc. */
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'channel must be snake_case starting with a letter',
  })
  channel!: string

  /** Opaque JSON-serializable document per channel (shape defined by the feature). */
  @Allow()
  payload!: unknown
}
