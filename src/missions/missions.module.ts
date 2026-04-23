import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Mission, MissionSchema } from './entities/mission.entity';
import { MissionsController } from './missions.controller';
import { MissionsService } from './missions.service';
import { Match, MatchSchema } from '../matches/entities/match.entity';
import { User, UserSchema } from '../users/entities/user.entity';
import { RunInvite, RunInviteSchema } from '../matches/entities/run-invite.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Mission.name, schema: MissionSchema },
      { name: Match.name, schema: MatchSchema },
      { name: User.name, schema: UserSchema },
      { name: RunInvite.name, schema: RunInviteSchema },
    ]),
  ],
  controllers: [MissionsController],
  providers: [MissionsService],
  exports: [MissionsService],
})
export class MissionsModule { }
