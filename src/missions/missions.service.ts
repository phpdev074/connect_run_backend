import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Mission, MissionDocument } from './entities/mission.entity';

@Injectable()
export class MissionsService {
  constructor(
    @InjectModel(Mission.name) private missionModel: Model<MissionDocument>,
  ) { }

  async createMission(userId: string, data: any) {
    return this.missionModel.create({
      userId: new Types.ObjectId(userId),
      ...data,
    });
  }

  async getDailyMission(userId: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    return this.missionModel.findOne({
      userId: new Types.ObjectId(userId),
      date: { $gte: targetDate, $lt: nextDay },
      status: 'pending',
    }).populate('partnerId', 'first_name last_name display_name image');
  }

  async getWeeklyProgram(userId: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const startOfWeek = new Date(targetDate);
    startOfWeek.setDate(targetDate.getDate() - targetDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    console.log("startOfWeek", startOfWeek);
    console.log("endOfWeek", endOfWeek);

    return this.missionModel.find({
      userId: new Types.ObjectId(userId),
      date: { $gte: startOfWeek, $lt: endOfWeek },
    }).populate('partnerId', 'first_name last_name image').sort({ date: 1 });
  }

  async getMissionHistory(userId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.missionModel
        .find({ userId: new Types.ObjectId(userId) })
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .populate('partnerId', 'first_name last_name display_name image')
        .lean(),
      this.missionModel.countDocuments({ userId: new Types.ObjectId(userId) }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateMissionStatus(missionId: string, status: string) {
    return this.missionModel.findByIdAndUpdate(missionId, { status }, { new: true });
  }
}
