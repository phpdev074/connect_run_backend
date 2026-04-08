import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Run, RunSchema } from './entities/run.entity';
import { Mission, MissionSchema } from '../missions/entities/mission.entity';
import { RunsService } from './runs.service';
import { RunsController } from './runs.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Run.name, schema: RunSchema },
      { name: Mission.name, schema: MissionSchema },
    ]),
  ],
  controllers: [RunsController],
  providers: [RunsService],
})
export class RunsModule { }
