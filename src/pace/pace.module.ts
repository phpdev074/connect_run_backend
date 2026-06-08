import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaceController } from './pace.controller';
import { PaceService } from './pace.service';
import { Pace, PaceSchema } from './entities/pace.entity';
import { User, UserSchema } from '../users/entities/user.entity';
import { Match, MatchSchema } from '../matches/entities/match.entity';
import { PaceRunPath, PaceRunPathSchema } from './entities/pace-run-path.entity';
import { RewardsModule } from '../rewards/reward.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Pace.name, schema: PaceSchema },
      { name: User.name, schema: UserSchema },
      { name: Match.name, schema: MatchSchema },
      { name: PaceRunPath.name, schema: PaceRunPathSchema },
    ]),
    RewardsModule,
  ],
  controllers: [PaceController],
  providers: [PaceService],
  exports: [PaceService],
})
export class PaceModule { }
