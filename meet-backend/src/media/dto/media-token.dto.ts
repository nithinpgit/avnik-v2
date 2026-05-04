import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class MediaTokenRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  roomId!: string

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  peerId!: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string
}
