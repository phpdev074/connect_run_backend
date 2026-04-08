import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Mission, MissionSchema } from './entities/mission.entity';
import { MissionsController } from './missions.controller';
import { MissionsService } from './missions.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Mission.name, schema: MissionSchema }]),
  ],
  controllers: [MissionsController],
  providers: [MissionsService],
  exports: [MissionsService],
})
export class MissionsModule { }
