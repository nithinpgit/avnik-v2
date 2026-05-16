import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm'

@Entity('chat_message_reads')
@Unique('uq_chat_message_reads_message_user', ['messageId', 'userId'])
@Index('idx_chat_message_reads_user', ['userId'])
export class ChatMessageReadEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'message_id', type: 'uuid' })
  messageId!: string

  @Column({ name: 'user_id', type: 'varchar', length: 128 })
  userId!: string

  @Column({ name: 'user_name', type: 'varchar', length: 200 })
  userName!: string

  @CreateDateColumn({ name: 'read_at', type: 'timestamptz' })
  readAt!: Date
}
