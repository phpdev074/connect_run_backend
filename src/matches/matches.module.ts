import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MatchesService } from './matches.service';
import { MatchesController } from './matches.controller';
import { Match, MatchSchema } from './entities/match.entity';
import { User, UserSchema } from '../users/entities/user.entity';
import { RunInvite, RunInviteSchema } from './entities/run-invite.entity';
import { RewardsModule } from '../rewards/reward.module';
import { Mission, MissionSchema } from 'src/missions/entities/mission.entity';
import { UsersModule } from '../users/users.module';


@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Match.name, schema: MatchSchema },
      { name: User.name, schema: UserSchema },
      { name: RunInvite.name, schema: RunInviteSchema },
      { name: Mission.name, schema: MissionSchema },
    ]),
    RewardsModule,
    UsersModule,
  ],

  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule { }
