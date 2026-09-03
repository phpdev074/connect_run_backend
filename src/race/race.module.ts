import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RaceController } from './race.controller';
import { RaceService } from './race.service';
import { Race, RaceSchema } from './entities/race.entity';
import { User, UserSchema } from '../users/entities/user.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Race.name, schema: RaceSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [RaceController],
  providers: [RaceService],
  exports: [RaceService],
})
export class RaceModule {}
