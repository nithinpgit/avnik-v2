import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm'

@Entity('room_files')
@Index('idx_room_files_room_created', ['roomId', 'createdAt'])
export class RoomFileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'room_id', type: 'varchar', length: 128 })
  roomId!: string

  @Column({ name: 'original_name', type: 'varchar', length: 512 })
  originalName!: string

  @Column({ name: 'stored_name', type: 'varchar', length: 256 })
  storedName!: string

  @Column({ name: 'mime_type', type: 'varchar', length: 128 })
  mimeType!: string

  @Column({ name: 'extension', type: 'varchar', length: 16 })
  extension!: string

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes!: string

  @Column({ name: 'page_count', type: 'int', default: 1 })
  pageCount!: number

  @Column({ name: 'uploaded_by', type: 'varchar', length: 128, nullable: true })
  uploadedBy!: string | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date
}
