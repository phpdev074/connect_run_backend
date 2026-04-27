import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Match, MatchDocument } from './entities/match.entity';
import { User, UserDocument } from '../users/entities/user.entity';
import { RunInvite, RunInviteDocument } from './entities/run-invite.entity';
import { CreateRunInviteDto } from './dto/create-run-invite.dto';
import { RewardsService } from '../rewards/rewards.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

@Injectable()
export class MatchesService {
  constructor(
    @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(RunInvite.name) private inviteModel: Model<RunInviteDocument>,
    private readonly rewardsService: RewardsService,
  ) { }

  async discover(
    userId: string,
    mode?: string,
    search?: string,
    page: number = 1,
    limit: number = 10,
  ) {
    const userObjectId = new Types.ObjectId(userId);

    // Get users I have already liked or where a final status (matched/rejected) exists
    // We don't exclude people who liked us but we haven't liked back yet.
    const existingInteractions = await this.matchModel.find({
      users: userObjectId,
      $or: [
        { likedBy: userObjectId },
        { status: { $in: ['matched', 'rejected'] } },
      ],
    }).select('users');

    const interactedUserIds = existingInteractions.flatMap((m) =>
      m.users.filter((u) => u.toString() !== userId),
    );

    // Build query to find new potential matches
    const query: any = {
      _id: { $ne: userObjectId, $nin: interactedUserIds },
    };

    // ✅ Mode filter
    if (mode) {
      query.modes = mode;
    }

    // ✅ Search filter
    if (search) {
      query.$or = [
        { first_name: { $regex: search, $options: 'i' } },
        { last_name: { $regex: search, $options: 'i' } },
        { display_name: { $regex: search, $options: 'i' } },
        { interests: { $regex: search, $options: 'i' } },
      ];
    }

    // ✅ Pagination
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.userModel
        .find(query)
        .skip(skip)
        .limit(limit)
        .select(
          '-password -resetOtp -resetOtpExpire -isEmailVerified -emailVerificationToken '
        ),
      this.userModel.countDocuments(query),
    ]);

    // Add isRequested: true/false for each user in data
    const targetUserIds = data.map((u) => u._id);
    let requestedMatches: { [k: string]: string } = {};

    if (targetUserIds.length) {
      // Find any existing matches between the current user and the discovered users
      const matches = await this.matchModel.find({
        users: userObjectId,
        $or: targetUserIds.map(id => ({ users: id }))
      });

      // Build a map for quick lookup (targetUserId -> match document)
      const matchMap = new Map<string, any>();
      matches.forEach(m => {
        const otherUser = m.users.find(u => u.toString() !== userId);
        if (otherUser) {
          matchMap.set(otherUser.toString(), m);
        }
      });

      // For every discover user, check if they have liked the current user
      targetUserIds.forEach(targetId => {
        const tidStr = targetId.toString();
        const match = matchMap.get(tidStr);
        
        if (!match) {
          requestedMatches[tidStr] = 'none';
          return;
        }

        const likedByStrings = match.likedBy.map(x => x.toString());
        const superLikedByStrings = (match.superLikedBy || []).map(x => x.toString());

        // isRequested is TRUE if the target user has liked me
        // In discover, the current user has not liked the target user yet (filtered out earlier)
        if (superLikedByStrings.includes(tidStr)) {
          requestedMatches[tidStr] = 'superliked';
        } else if (likedByStrings.includes(tidStr)) {
          requestedMatches[tidStr] = 'liked';
        } else {
          requestedMatches[tidStr] = 'none';
        }
      });
    }

    // Add action and isRequested to user objects
    const dataWithAction = data.map(user => {
      const action = requestedMatches[user._id.toString()] || 'none';
      return {
        ...user.toObject(),
        action: action,
        isRequested: action !== 'none',
      };
    });

    return {
      data: dataWithAction,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
  
  async like(userId: string, targetId: string, isSuperLike = false) {
    const userObjectId = new Types.ObjectId(userId);
    const targetObjectId = new Types.ObjectId(targetId);

    let match = await this.matchModel.findOne({
      users: { $all: [userObjectId, targetObjectId] },
    });

    if (!match) {
      match = await this.matchModel.create({
        users: [userObjectId, targetObjectId],
        likedBy: [userObjectId],
        superLikedBy: isSuperLike ? [userObjectId] : [],
        status: 'pending',
      });
    } else if (match.status !== 'rejected') {
      const alreadyLiked = match.likedBy.some(id => id.toString() === userId);
      const alreadySuperLiked = match.superLikedBy.some(id => id.toString() === userId);

      if (!alreadyLiked) {
        match.likedBy.push(userObjectId);
      }
      
      if (isSuperLike && !alreadySuperLiked) {
        match.superLikedBy.push(userObjectId);
      }

      if (match.likedBy.length === 2 && match.status !== 'matched') {
        match.status = 'matched';
        match.expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48-hr countdown
      }
      
      await match.save();
    }

    return match;
  }

  async superLike(userId: string, targetId: string) {
    // Deduct 5 points for super like
    await this.rewardsService.redeemPoints(userId, 5, `Super Like to user ${targetId}`);

    // Perform like logic with superLike flag
    const match = await this.like(userId, targetId, true);
    return match;
  }

  async reject(userId: string, targetId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const targetObjectId = new Types.ObjectId(targetId);

    let match = await this.matchModel.findOne({
      users: { $all: [userObjectId, targetObjectId] },
    });

    if (!match) {
      match = await this.matchModel.create({
        users: [userObjectId, targetObjectId],
        status: 'rejected',
      });
    } else {
      match.status = 'rejected';
      await match.save();
    }

    return match;
  }

  async getPendingLikes(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    return this.matchModel.find({
      users: userObjectId,
      status: 'pending',
      likedBy: { $ne: userObjectId }, // Liked by the other user, not me
    }).populate('users', 'first_name last_name display_name age image running_level');
  }

  async sendVirtualRunInvite(matchId: string) {
    return this.matchModel.findByIdAndUpdate(matchId, {
      virtualRunInviteSent: true,
    }, { new: true });
  }

  async getMatches(userId: string) {
    return this.matchModel.find({
      users: new Types.ObjectId(userId),
      status: 'matched',
    }).populate('users');
  }

  async sendDetailedInvite(matchId: string, senderId: string, body: CreateRunInviteDto) {
    const match = await this.matchModel.findById(matchId);
    if (!match) throw new NotFoundException('Match not found');

    const receiverId = match.users.find(u => u.toString() !== senderId);
    if (!receiverId) throw new BadRequestException('Receiver not found in match');

    // Point requirements from UI
    const pointsRequired = body.type === 'Virtual_Run' ? 10 : 50;

    const invite = await this.inviteModel.create({
      matchId: new Types.ObjectId(matchId),
      senderId: new Types.ObjectId(senderId),
      receiverId: receiverId,
      pointsRequired,
      ...body,
    });

    return invite;
  }

  async findMatchById(matchId: string) {
    return this.matchModel.findById(matchId).populate('users');
  }

  async respondToInvite(inviteId: string, userId: string, status: 'accepted' | 'declined') {
    const invite = await this.inviteModel.findById(inviteId);
    if (!invite) throw new NotFoundException('Invite not found');

    if (invite.receiverId.toString() !== userId) {
      throw new BadRequestException('You are not the receiver of this invite');
    }

    invite.status = status;
    await invite.save();

    if (status === 'accepted') {
      // Update match status or create a Run session
    }

    return invite;
  }
}
