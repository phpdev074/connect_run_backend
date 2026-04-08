import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReelsController } from './reels.controller';
import { ReelsService } from './reels.service';
import { Reel, ReelSchema } from './entities/reel.entity';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Reel.name, schema: ReelSchema }]),
  ],
  controllers: [ReelsController],
  providers: [ReelsService],
})
export class ReelsModule {}
