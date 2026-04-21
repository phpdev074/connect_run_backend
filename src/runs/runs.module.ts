import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Run, RunSchema } from './entities/run.entity';
import { Mission, MissionSchema } from '../missions/entities/mission.entity';
import { User, UserSchema } from '../users/entities/user.entity';
import { RunsService } from './runs.service';
import { RunsController } from './runs.controller';
import { RunLocation, RunLocationSchema } from './entities/runLocation.entity';
import { RunGateway } from './run.gateway';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Run.name, schema: RunSchema },
      { name: Mission.name, schema: MissionSchema },
      { name: User.name, schema: UserSchema },
      { name: RunLocation.name, schema: RunLocationSchema },
    ]),
  ],
  controllers: [RunsController],
  providers: [RunsService, RunGateway],
})
export class RunsModule { }
