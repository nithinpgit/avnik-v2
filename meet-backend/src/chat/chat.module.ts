import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'
import { ChatMessageEntity } from './entities/chat-message.entity'
import { ChatMessageReadEntity } from './entities/chat-message-read.entity'

@Module({
  imports: [TypeOrmModule.forFeature([ChatMessageEntity, ChatMessageReadEntity])],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
