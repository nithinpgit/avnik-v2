import { ArrayMaxSize, IsArray, IsString, IsUUID, MaxLength, MinLength } from 'class-validator'

export class ChatMarkReadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  roomId!: string

  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  messageIds!: string[]
}
