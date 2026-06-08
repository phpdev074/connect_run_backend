import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { Community, CommunitySchema } from './entities/community.entity';
import { User, UserSchema } from '../users/entities/user.entity';
import { Match, MatchSchema } from '../matches/entities/match.entity';
import { CommunityRun, CommunityRunSchema } from './entities/community-run.entity';
import { CommunityRunPath, CommunityRunPathSchema } from './entities/community-run-path.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Community.name, schema: CommunitySchema },
      { name: User.name, schema: UserSchema },
      { name: Match.name, schema: MatchSchema },
      { name: CommunityRun.name, schema: CommunityRunSchema },
      { name: CommunityRunPath.name, schema: CommunityRunPathSchema },
    ]),
  ],
  controllers: [CommunityController],
  providers: [CommunityService],
  exports: [CommunityService],
})
export class CommunityModule { }
