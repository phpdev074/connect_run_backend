import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Match, MatchDocument } from './entities/match.entity';
import { User, UserDocument } from '../users/entities/user.entity';

@Injectable()
export class MatchesService {
  constructor(
    @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async discover(userId: string, filter: string) {
    // Basic discovery logic: find users within distance, excluding self and existing matches
    // This would be more complex in production (filtering by mode: Dating, Buddy, Group)
    return this.userModel.find({
      _id: { $ne: new Types.ObjectId(userId) },
      // modes: filter // assuming modes field was added previously
    }).limit(10).select('first_name last_name display_name age running_level miles_per_week interests image location');
  }

  async like(userId: string, targetId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const targetObjectId = new Types.ObjectId(targetId);

    let match = await this.matchModel.findOne({
      users: { $all: [userObjectId, targetObjectId] },
    });

    if (!match) {
      match = await this.matchModel.create({
        users: [userObjectId, targetObjectId],
        likedBy: [userObjectId],
      });
    } else {
      if (!match.likedBy.includes(userObjectId)) {
        match.likedBy.push(userObjectId);
        if (match.likedBy.length === 2) {
          match.status = 'matched';
          match.expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48-hr countdown
        }
        await match.save();
      }
    }

    return match;
  }

  async getMatches(userId: string) {
    return this.matchModel.find({
      users: new Types.ObjectId(userId),
      status: 'matched',
    }).populate('users', 'first_name last_name display_name image');
  }
}
