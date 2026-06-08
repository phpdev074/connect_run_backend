import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';
import { Group, GroupSchema } from './entities/group.entity';
import { User, UserSchema } from '../users/entities/user.entity';
import { Match, MatchSchema } from '../matches/entities/match.entity';
import { GroupRun, GroupRunSchema } from './entities/group-run.entity';
import { GroupRunPath, GroupRunPathSchema } from './entities/group-run-path.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Group.name, schema: GroupSchema },
      { name: User.name, schema: UserSchema },
      { name: Match.name, schema: MatchSchema },
      { name: GroupRun.name, schema: GroupRunSchema },
      { name: GroupRunPath.name, schema: GroupRunPathSchema },
    ]),
  ],
  controllers: [GroupController],
  providers: [GroupService],
  exports: [GroupService],
})
export class GroupModule {}
