import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Run, RunDocument } from './entities/run.entity';
import { Mission, MissionDocument } from '../missions/entities/mission.entity';
import { User, UserDocument } from '../users/entities/user.entity';
import { RunLocation, RunLocationDocument } from './entities/runLocation.entity';
import { Match, MatchDocument } from '../matches/entities/match.entity';
import { RecordRunDto } from './dto/record-run.dto';

@Injectable()
export class RunsService {
  constructor(
    @InjectModel(Run.name) private runModel: Model<RunDocument>,
    @InjectModel(Mission.name) private missionModel: Model<MissionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(RunLocation.name)
    private runLocationModel: Model<RunLocationDocument>,
    @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
  ) { }

  async startRun(userId: string, matchId?: string) {
    const runData: any = {
      userId: new Types.ObjectId(userId),
      distance: 0,
      pace: '0:00',
      duration: '0:00',
      calories: 0,
    };

    if (matchId && Types.ObjectId.isValid(matchId)) {
      runData.matchId = new Types.ObjectId(matchId);
    }

    const run = await this.runModel.create(runData);
    return run;
  }

  async recordRun(userId: string, data: any) {
    const run = await this.runModel.create({
      userId: new Types.ObjectId(userId),
      ...data,
      status: 'completed',
    });

    await this.processRunCompletion(userId, data);

    return run;
  }

  async endRun(runId: string, userId: string, data: any) {
    if (!Types.ObjectId.isValid(runId)) {
      throw new NotFoundException('Invalid Run ID');
    }

    const run = await this.runModel.findOneAndUpdate(
      { _id: new Types.ObjectId(runId), userId: new Types.ObjectId(userId) },
      {
        ...data,
        status: 'completed',
      },
      { new: true },
    );

    if (!run) {
      throw new NotFoundException('Run not found or unauthorized');
    }

    await this.processRunCompletion(userId, data);

    return run;
  }

  private toDateString(date: Date | string): string {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  }

  private async processRunCompletion(userId: string, data: RecordRunDto) {
    if (data.missionId && Types.ObjectId.isValid(data.missionId)) {
      await this.missionModel.findByIdAndUpdate(data.missionId, {
        status: 'completed',
      });
    }

    const user = await this.userModel.findById(userId);
    if (!user) return;

    const distance = Number(data.distance) || 0;
    const pointsEarned = Number(data.pointsEarned) || 0;

    // --- Streak: consecutive active CALENDAR days (not per run) ---
    const today = this.toDateString(new Date());
    const yesterday = this.toDateString(
      new Date(Date.now() - 24 * 60 * 60 * 1000),
    );
    const lastRunDate = user.last_run_date
      ? this.toDateString(user.last_run_date)
      : '';

    let streak = user.streak || 0;

    if (lastRunDate === today) {
      // Case A: already ran today -> do not increment
    } else if (lastRunDate === yesterday) {
      // Case B: first run today, ran yesterday -> +1
      streak = streak + 1;
    } else {
      // Case C: first run today but skipped 1+ days (or never ran) -> reset to 1
      streak = 1;
    }

    // --- Points: never negative, credit earned points ---
    const points = Math.max(0, user.points || 0) + pointsEarned;

    // --- Total miles: round to 2 decimal places ---
    const totalMiles = Number(
      ((Number(user.total_miles) || 0) + distance).toFixed(2),
    );

    await this.userModel.findByIdAndUpdate(userId, {
      points,
      total_miles: totalMiles,
      streak,
      last_run_date: new Date(),
    });
  }

  async pauseRun(runId: string) {
    if (!Types.ObjectId.isValid(runId)) {
      throw new NotFoundException('Invalid Run ID');
    }

    const run = await this.runModel.findByIdAndUpdate(
      runId,
      { status: 'paused' },
      { new: true },
    );
    if (!run) {
      throw new NotFoundException('Run not found');
    }
    return run;
  }

  async resumeRun(runId: string) {
    if (!Types.ObjectId.isValid(runId)) {
      throw new NotFoundException('Invalid Run ID');
    }

    const run = await this.runModel.findByIdAndUpdate(
      runId,
      { status: 'ongoing' },
      { new: true },
    );
    if (!run) {
      throw new NotFoundException('Run not found');
    }
    return run;
  }

  async getUserRuns(userId: string) {
    return this.runModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ date: -1 });
  }

  async getStats(userId: string) {
    const runs = await this.runModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ date: -1 });
    const user = await this.userModel.findById(userId);
    const totalMiles = Number(
      runs.reduce((acc, run) => acc + run.distance, 0).toFixed(2),
    );
    const totalPoints = Math.max(
      0,
      runs.reduce((acc, run) => acc + run.pointsEarned, 0),
    );

    return {
      totalMiles,
      totalPoints,
      dayStreak: user?.streak || 0,
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

  async getRunSetup(userId: string, matchId?: string) {
    if (matchId) {
      const match = await this.matchModel.findById(matchId).populate('users');
      return {
        mode: 'match',
        users: match?.users || []
      };
    } else {
      const user = await this.userModel.findById(userId);
      return {
        mode: 'solo',
        users: user ? [user] : []
      };
    }
  }

  async shouldStorePoint(
    runId: string,
    userId: string,
    lat: number,
    lng: number,
    timestamp: number,
  ) {
    const run = await this.runModel.findById(runId);
    if (!run || run.status !== 'ongoing') return false;

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
