import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VirtualRoomService } from './virtual-room.service';
import { VirtualRoomController } from './virtual-room.controller';
import { VirtualRoom, VirtualRoomSchema } from './entities/virtual-room.entity';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: VirtualRoom.name, schema: VirtualRoomSchema }]),
  ],
  controllers: [VirtualRoomController],
  providers: [VirtualRoomService],
})
export class VirtualRoomModule {}
