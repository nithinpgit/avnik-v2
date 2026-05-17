import { IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator'
import type { ChatMessageKind } from '../entities/chat-message.entity'

export class ChatSendDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  roomId!: string

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string

  @IsIn(['public', 'private'])
  kind!: ChatMessageKind

  @ValidateIf((o: ChatSendDto) => o.kind === 'private')
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  recipientId?: string
}
