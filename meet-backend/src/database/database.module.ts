import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ChatMessageEntity } from '../chat/entities/chat-message.entity'
import { ChatMessageReadEntity } from '../chat/entities/chat-message-read.entity'
import { RoomFileEntity } from '../files/entities/room-file.entity'

function databaseUrl(): string {
  if (process.env.DATABASE_URL?.trim()) {
    return process.env.DATABASE_URL.trim()
  }
  const host = process.env.POSTGRES_HOST?.trim() || 'postgres'
  const port = process.env.POSTGRES_PORT?.trim() || '5432'
  const user = process.env.POSTGRES_USER?.trim() || 'meet'
  const pass = process.env.POSTGRES_PASSWORD?.trim() || 'meet'
  const db = process.env.POSTGRES_DB?.trim() || 'meet'
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}:${port}/${db}`
}

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: databaseUrl(),
      entities: [ChatMessageEntity, ChatMessageReadEntity, RoomFileEntity],
      synchronize:
        process.env.DATABASE_SYNC === 'true' ||
        (process.env.DATABASE_SYNC !== 'false' && process.env.NODE_ENV !== 'production'),
      logging: process.env.DATABASE_LOGGING === 'true',
    }),
  ],
})
export class DatabaseModule {}
