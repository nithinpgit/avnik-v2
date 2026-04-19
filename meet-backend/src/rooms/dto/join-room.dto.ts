import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class JoinRoomDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  roomId!: string

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  userId!: string

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string

  @IsIn(['host', 'participant'])
  role!: 'host' | 'participant'

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  profileImage?: string | null
}
