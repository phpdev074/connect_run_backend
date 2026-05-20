import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Mission, MissionDocument } from './entities/mission.entity';
import { Match, MatchDocument } from '../matches/entities/match.entity';
import { User, UserDocument } from '../users/entities/user.entity';
import { RunInvite, RunInviteDocument } from '../matches/entities/run-invite.entity';

@Injectable()
export class MissionsService {
  constructor(
    @InjectModel(Mission.name) private missionModel: Model<MissionDocument>,
    @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(RunInvite.name) private inviteModel: Model<RunInviteDocument>,
  ) { }

  async createMission(userId: string, data: any) {
    const currentUser = new Types.ObjectId(userId);
    const partnerUser = new Types.ObjectId(data.partnerId);

    const match = await this.matchModel.findOne({
      users: { $all: [currentUser, partnerUser] },
      status: 'matched',
    });

    if (!match) {
      throw new BadRequestException('Match not found');
    }

    const response = await this.missionModel.create({
      matchId: new Types.ObjectId(match._id),
      userId: new Types.ObjectId(userId),
      ...data,
    });

    const pointsRequired = data.runType === 'Virtual_Run' ? 10 : 50;
    const inviteDate = data.date ? data.date.split('T')[0] : new Date().toISOString().split('T')[0];

    const invite = await this.inviteModel.create({
      matchId: new Types.ObjectId(match._id),
      senderId: new Types.ObjectId(userId),
      receiverId: partnerUser,
      pointsRequired: data.pointsRequired !== undefined ? data.pointsRequired : pointsRequired,
      type: data.runType || 'Virtual_Run',
      date: inviteDate,
      time: data.scheduledTime || '8:00 AM',
      message: data.message || '',
      status: data.inviteStatus || 'pending',
    });
    
    await this.matchModel.updateOne(
      { _id: match._id },
      {
      $set: {
        missionId: response._id,
        runInviteId: invite._id,
          virtualRunInviteSent: true
        }
      }
    );

    return response;
  }

  async getDailyMission(userId: string, date?: string) {
    const dateStr = date || new Date().toISOString().split('T')[0];
    const targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const [mission, invite] = await Promise.all([
      this.missionModel.findOne({
        userId: new Types.ObjectId(userId),
        date: { $gte: targetDate, $lt: nextDay },
        status: 'pending',
      }).populate('partnerId', 'first_name last_name display_name image points total_miles').lean(),

      this.inviteModel.findOne({
        $or: [{ senderId: new Types.ObjectId(userId) }, { receiverId: new Types.ObjectId(userId) }],
        date: dateStr,
        status: 'accepted',
      }).populate('senderId receiverId', 'first_name last_name display_name image points total_miles').lean()
    ]);

    let matchedUsers: any[] = [];
    if (invite) {
      matchedUsers = [invite.senderId, invite.receiverId];
    } else if (mission?.partnerId) {
      const currentUser = await this.userModel.findById(userId)
        .select('first_name last_name display_name image points total_miles')
        .lean();
      matchedUsers = [currentUser, mission.partnerId];
    }

    return {
      mission: mission || null,
      matchedUsers,
      invite: invite || null
    };
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
