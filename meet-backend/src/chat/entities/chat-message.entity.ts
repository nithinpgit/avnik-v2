import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm'

export type ChatMessageKind = 'public' | 'private'

@Entity('chat_messages')
@Index('idx_chat_messages_room_created', ['roomId', 'createdAt'])
@Index('idx_chat_messages_room_private', ['roomId', 'kind', 'createdAt'])
export class ChatMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'room_id', type: 'varchar', length: 128 })
  roomId!: string

  @Column({ name: 'sender_id', type: 'varchar', length: 128 })
  senderId!: string

  @Column({ name: 'sender_name', type: 'varchar', length: 200 })
  senderName!: string

  @Column({ type: 'varchar', length: 16 })
  kind!: ChatMessageKind

  /** Set for private messages (recipient user id). Null for public room chat. */
  @Column({ name: 'recipient_id', type: 'varchar', length: 128, nullable: true })
  recipientId!: string | null

  @Column({ type: 'text' })
  body!: string

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date
}
