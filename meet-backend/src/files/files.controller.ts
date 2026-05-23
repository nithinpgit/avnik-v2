import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { FilesService, MAX_UPLOAD_BYTES_LIMIT } from './files.service'

class UpdatePageCountDto {
  pageCount!: number
}

class SaveYoutubeDto {
  videoId!: string
  title?: string
  uploadedBy?: string
}

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Get('rooms/:roomId')
  async list(@Param('roomId') roomId: string) {
    const files = await this.files.listByRoom(roomId)
    return { roomId, files }
  }

  @Post('rooms/:roomId/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES_LIMIT },
    }),
  )
  async upload(
    @Param('roomId') roomId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('uploadedBy') uploadedBy?: string,
    @Body('pageCount') pageCountRaw?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file uploaded')
    }
    const pageCount = pageCountRaw ? Number(pageCountRaw) : undefined
    const saved = await this.files.saveUpload({
      roomId,
      originalName: file.originalname,
      buffer: file.buffer,
      mimeType: file.mimetype,
      uploadedBy,
      pageCount: Number.isFinite(pageCount) ? pageCount : undefined,
    })
    return { status: 'success', file: saved }
  }

  @Post('rooms/:roomId/youtube')
  async saveYoutube(
    @Param('roomId') roomId: string,
    @Body() body: SaveYoutubeDto,
  ) {
    if (!body?.videoId?.trim()) {
      throw new BadRequestException('videoId is required')
    }
    const saved = await this.files.saveYoutubeLink({
      roomId,
      videoId: body.videoId,
      title: body.title,
      uploadedBy: body.uploadedBy,
    })
    return { status: 'success', file: saved }
  }

  @Patch(':fileId/page-count')
  async updatePageCount(@Param('fileId') fileId: string, @Body() body: UpdatePageCountDto) {
    const file = await this.files.updatePageCount(fileId, body.pageCount)
    return { status: 'success', file }
  }

  @Delete(':fileId')
  async remove(@Param('fileId') fileId: string) {
    await this.files.deleteFile(fileId)
    return { status: 'success', message: 'File deleted successfully' }
  }
}
