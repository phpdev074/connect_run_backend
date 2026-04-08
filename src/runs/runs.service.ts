import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Run, RunDocument } from './entities/run.entity';
import { Mission, MissionDocument } from '../missions/entities/mission.entity';
import { User, UserDocument } from '../users/entities/user.entity';

@Injectable()
export class RunsService {
  constructor(
    @InjectModel(Run.name) private runModel: Model<RunDocument>,
    @InjectModel(Mission.name) private missionModel: Model<MissionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async recordRun(userId: string, data: any) {
    const run = await this.runModel.create({
      userId: new Types.ObjectId(userId),
      ...data,
    });

    if (data.missionId) {
      await this.missionModel.findByIdAndUpdate(data.missionId, { status: 'completed' });
    }

    // Update user stats
    await this.userModel.findByIdAndUpdate(userId, {
      $inc: { 
        total_miles: data.distance,
        points: data.pointsEarned || 50, // Default 50 pts for a run
        streak: 1 // Increment streak (simulated)
      }
    });
    
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

  async getNearbySpots(lat: number, lng: number) {
    // Mocking AI-picked spots nearby
    return [
      {
        name: 'Blue Bottle Coffee',
        distance: '0.2 mi away',
        rating: 4.8,
        status: 'Open now',
        type: 'Coffee',
      },
      {
        name: 'Sweetgreen',
        distance: '0.4 mi away',
        rating: 4.6,
        status: 'Open now',
        type: 'Salad',
      },
      {
        name: 'Central Park Boathouse',
        distance: '0.1 mi away',
        rating: 4.4,
        status: 'Outdoor seating',
        type: 'Restaurant',
      },
    ];
  }
}
