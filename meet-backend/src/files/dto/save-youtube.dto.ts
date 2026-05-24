import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator'

export class SaveYoutubeDto {
  @IsString()
  @MinLength(11)
  @MaxLength(11)
  @Matches(/^[a-zA-Z0-9_-]{11}$/, { message: 'videoId must be a valid YouTube id' })
  videoId!: string

  @IsOptional()
  @IsString()
  @MaxLength(256)
  title?: string

  @IsOptional()
  @IsString()
  @MaxLength(128)
  uploadedBy?: string
}
