import { IsInt, Max, Min } from 'class-validator'

export class UpdatePageCountDto {
  @IsInt()
  @Min(1)
  @Max(500)
  pageCount!: number
}
