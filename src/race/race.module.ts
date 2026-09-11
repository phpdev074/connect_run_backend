import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RaceController } from './race.controller';
import { RaceService } from './race.service';
import { Race, RaceSchema } from './entities/race.entity';
import { User, UserSchema } from '../users/entities/user.entity';
import { Run, RunSchema } from '../runs/entities/run.entity';
import { Chat, ChatSchema } from '../chat/entities/chat.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Race.name, schema: RaceSchema },
      { name: User.name, schema: UserSchema },
      { name: Run.name, schema: RunSchema },
      { name: Chat.name, schema: ChatSchema },
    ]),
  ],
  controllers: [RaceController],
  providers: [RaceService],
  exports: [RaceService],
})
export class RaceModule {}
