import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator'
import type { ChatMessageKind } from '../entities/chat-message.entity'

export class ChatHistoryQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  userId!: string

  @IsIn(['public', 'private'])
  kind!: ChatMessageKind

  @ValidateIf((o: ChatHistoryQueryDto) => o.kind === 'private')
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  peerId?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number

  @IsOptional()
  @IsISO8601()
  before?: string
}
