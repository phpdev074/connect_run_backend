import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Run, RunDocument } from './entities/run.entity';
import { Mission, MissionDocument } from '../missions/entities/mission.entity';
import { User, UserDocument } from '../users/entities/user.entity';
import { RunLocation, RunLocationDocument } from './entities/runLocation.entity';

@Injectable()
export class RunsService {
  constructor(
    @InjectModel(Run.name) private runModel: Model<RunDocument>,
    @InjectModel(Mission.name) private missionModel: Model<MissionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(RunLocation.name)
    private runLocationModel: Model<RunLocationDocument>,
  ) { }

  async startRun(userId: string, matchId?: string) {
    const runData: any = {
      userId: new Types.ObjectId(userId),
      distance: 0,
      pace: '0:00',
      duration: '0:00',
      calories: 0,
    };

    if (matchId) {
      runData.matchId = new Types.ObjectId(matchId);
    }

    const run = await this.runModel.create(runData);
    return run;
  }

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

  // =========================
  // ✅ NEW METHODS ADDED
  // =========================

  async shouldStorePoint(
    runId: string,
    userId: string,
    lat: number,
    lng: number,
    timestamp: number,
  ) {
    const last = await this.runLocationModel
      .findOne({
        runId: new Types.ObjectId(runId),
        userId: new Types.ObjectId(userId),
      })
      .sort({ timestamp: -1 });

    if (!last) return true;

    const [lastLng, lastLat] = last.location.coordinates;

    const distance = this.calculateDistance(lastLat, lastLng, lat, lng);
    const timeDiff =
      (timestamp - new Date(last.timestamp).getTime()) / 1000;

    // return distance > 5 || timeDiff > 5;
    if (distance < 3) return false;

    if (distance >= 5) return true;

    if (timeDiff >= 5) return true;

    return false;
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async saveLocation(data: {
    runId: string;
    userId: string;
    lat: number;
    lng: number;
    timestamp: number;
  }) {
    await this.runLocationModel.create({
      runId: new Types.ObjectId(data.runId),
      userId: new Types.ObjectId(data.userId),
      location: {
        type: 'Point',
        coordinates: [data.lng, data.lat],
      },
      timestamp: new Date(data.timestamp),
    });
  }

  async getRunPath(runId: string) {
    const points = await this.runLocationModel
      .find({ runId: new Types.ObjectId(runId) })
      .sort({ timestamp: 1 });

    return points.map(p => p.location.coordinates);
  }
}
