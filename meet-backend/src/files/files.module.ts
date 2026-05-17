import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { RoomFileEntity } from './entities/room-file.entity'
import { FilesController } from './files.controller'
import { FilesService } from './files.service'

@Module({
  imports: [TypeOrmModule.forFeature([RoomFileEntity])],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
