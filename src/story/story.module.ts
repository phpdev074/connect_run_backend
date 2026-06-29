import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StoryService } from './story.service';
import { StoryController } from './story.controller';
import { Story, StorySchema } from './entities/story.entity';
import { User, UserSchema } from '../users/entities/user.entity';
import { BlockModule } from '../block/block.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Story.name, schema: StorySchema },
      { name: User.name, schema: UserSchema },
    ]),
    BlockModule,
  ],
  controllers: [StoryController],
  providers: [StoryService],
  exports: [StoryService],
})
export class StoryModule {}
