import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { existsSync, mkdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import { Repository } from 'typeorm'
import { randomUUID } from 'crypto'
import { RoomFileEntity } from './entities/room-file.entity'

export const ALLOWED_FILE_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
])

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

export type RoomFileDto = {
  id: string
  roomId: string
  originalName: string
  storedName: string
  mimeType: string
  extension: string
  sizeBytes: number
  pageCount: number
  uploadedBy: string | null
  url: string
  createdAt: string
}

@Injectable()
export class FilesService {
  private readonly uploadRoot: string

  constructor(
    @InjectRepository(RoomFileEntity)
    private readonly filesRepo: Repository<RoomFileEntity>,
  ) {
    this.uploadRoot = process.env.UPLOAD_DIR?.trim() || join(process.cwd(), 'uploads')
    if (!existsSync(this.uploadRoot)) {
      mkdirSync(this.uploadRoot, { recursive: true })
    }
  }

  roomDir(roomId: string): string {
    const dir = join(this.uploadRoot, roomId)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    return dir
  }

  fileUrl(roomId: string, storedName: string): string {
    return `/uploads/${encodeURIComponent(roomId)}/${encodeURIComponent(storedName)}`
  }

  toDto(entity: RoomFileEntity): RoomFileDto {
    return {
      id: entity.id,
      roomId: entity.roomId,
      originalName: entity.originalName,
      storedName: entity.storedName,
      mimeType: entity.mimeType,
      extension: entity.extension,
      sizeBytes: Number(entity.sizeBytes),
      pageCount: entity.pageCount,
      uploadedBy: entity.uploadedBy,
      url: this.fileUrl(entity.roomId, entity.storedName),
      createdAt: entity.createdAt.toISOString(),
    }
  }

  async listByRoom(roomId: string): Promise<RoomFileDto[]> {
    const rows = await this.filesRepo.find({
      where: { roomId },
      order: { createdAt: 'DESC' },
    })
    return rows.map((r) => this.toDto(r))
  }

  async saveUpload(params: {
    roomId: string
    originalName: string
    buffer: Buffer
    mimeType: string
    uploadedBy?: string
    pageCount?: number
  }): Promise<RoomFileDto> {
    const ext = this.extensionFromName(params.originalName)
    if (!ALLOWED_FILE_EXTENSIONS.has(ext)) {
      throw new BadRequestException(
        'Invalid file type. Allowed: pdf, doc, docx, xls, xlsx, ppt, pptx, png, jpg, jpeg, gif, webp',
      )
    }
    if (params.buffer.length > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('File size should be less than 20 MB')
    }

    const storedName = `${randomUUID()}.${ext}`
    const dir = this.roomDir(params.roomId)
    const fullPath = join(dir, storedName)
    await import('fs/promises').then((fs) => fs.writeFile(fullPath, params.buffer))

    const entity = this.filesRepo.create({
      roomId: params.roomId,
      originalName: params.originalName,
      storedName,
      mimeType: params.mimeType || 'application/octet-stream',
      extension: ext,
      sizeBytes: String(params.buffer.length),
      pageCount: params.pageCount ?? 1,
      uploadedBy: params.uploadedBy?.trim() || null,
    })
    const saved = await this.filesRepo.save(entity)
    return this.toDto(saved)
  }

  async updatePageCount(fileId: string, pageCount: number): Promise<RoomFileDto> {
    const entity = await this.filesRepo.findOne({ where: { id: fileId } })
    if (!entity) {
      throw new NotFoundException('File not found')
    }
    entity.pageCount = Math.max(1, Math.min(500, Math.floor(pageCount)))
    const saved = await this.filesRepo.save(entity)
    return this.toDto(saved)
  }

  async deleteFile(fileId: string): Promise<void> {
    const entity = await this.filesRepo.findOne({ where: { id: fileId } })
    if (!entity) {
      throw new NotFoundException('File not found')
    }
    const fullPath = join(this.roomDir(entity.roomId), entity.storedName)
    if (existsSync(fullPath)) {
      try {
        unlinkSync(fullPath)
      } catch {
        /* best-effort */
      }
    }
    await this.filesRepo.delete({ id: fileId })
  }

  extensionFromName(name: string): string {
    const parts = name.split('.')
    if (parts.length < 2) return ''
    return parts[parts.length - 1].toLowerCase()
  }
}
