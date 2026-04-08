import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Run, RunDocument } from './entities/run.entity';
import { Mission, MissionDocument } from '../missions/entities/mission.entity';

@Injectable()
export class RunsService {
  constructor(
    @InjectModel(Run.name) private runModel: Model<RunDocument>,
    @InjectModel(Mission.name) private missionModel: Model<MissionDocument>,
  ) {}

  async recordRun(userId: string, data: any) {
    const run = await this.runModel.create({
      userId: new Types.ObjectId(userId),
      ...data,
    });

    if (data.missionId) {
      await this.missionModel.findByIdAndUpdate(data.missionId, { status: 'completed' });
    }

    // Logic to update user stats (total miles, points, streak) could go here or in a separate stats service
    
    return run;
  }

  async getUserRuns(userId: string) {
    return this.runModel.find({ userId: new Types.ObjectId(userId) }).sort({ date: -1 });
  }

  async getStats(userId: string) {
    const runs = await this.runModel.find({ userId: new Types.ObjectId(userId) });
    const totalMiles = runs.reduce((acc, run) => acc + run.distance, 0);
    const totalPoints = runs.reduce((acc, run) => acc + run.pointsEarned, 0);
    // Streak logic omitted for brevity
    
    return {
      totalMiles,
      totalPoints,
      dayStreak: 5, // Placeholder
    };
  }
}
