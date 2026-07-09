import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Match, MatchDocument } from './entities/match.entity';
import { User, UserDocument } from '../users/entities/user.entity';
import { RunInvite, RunInviteDocument } from './entities/run-invite.entity';
import { CreateRunInviteDto } from './dto/create-run-invite.dto';
import { RewardsService } from '../rewards/rewards.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Mission, MissionDocument } from 'src/missions/entities/mission.entity';
import { FirebaseService } from '../utils/firebase.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';



@Injectable()
export class MatchesService {
  constructor(
    @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(RunInvite.name) private inviteModel: Model<RunInviteDocument>,
    @InjectModel(Mission.name) private missionModel: Model<MissionDocument>,
    private readonly rewardsService: RewardsService,
    private readonly firebaseService: FirebaseService,
    private readonly userService: UsersService,
    private readonly notificationsService: NotificationsService,
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

    let alreadyLiked = false;
    let isNewInteraction = false;

    if (!match) {
      isNewInteraction = true;
      match = await this.matchModel.create({
        users: [userObjectId, targetObjectId],
        likedBy: [userObjectId],
        superLikedBy: isSuperLike ? [userObjectId] : [],
        status: 'pending',
      });
    } else if (match.status !== 'rejected') {
      alreadyLiked = match.likedBy.some((id) => id.toString() === userId);
      const alreadySuperLiked = (match.superLikedBy || []).some(
        (id) => id.toString() === userId,
      );

      if (!alreadyLiked) {
        match.likedBy.push(userObjectId);
      }

      if (isSuperLike && !alreadySuperLiked) {
        if (!match.superLikedBy) match.superLikedBy = [];
        match.superLikedBy.push(userObjectId);
      }

      if (match.likedBy.length === 2 && match.status !== 'matched') {
        match.status = 'matched';
        match.expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48-hr countdown
      }

      await match.save();
    }

    // --- PUSH NOTIFICATION LOGIC ---
    try {
      const isNewMatch = match.status === 'matched';
      const sender = await this.userService.findById(userId);
      const senderName = sender?.display_name || sender?.first_name || 'Someone';

      if (isNewMatch) {
        // Notify BOTH users about the new match
        const receiver = await this.userService.findById(targetId);
        const receiverName = receiver?.display_name || receiver?.first_name || 'Someone';

        // Notify User A
        await this.notificationsService.sendAndSave(
          userId,
          'New Match!',
          `You matched with ${receiverName}!`,
          'MATCH',
          { matchId: match._id.toString() }
        );
        
        // Notify User B
        await this.notificationsService.sendAndSave(
          targetId,
          'New Match!',
          `You matched with ${senderName}!`,
          'MATCH',
          { matchId: match._id.toString() }
        );
      } else if (isNewInteraction || !alreadyLiked) {
        // Notify ONLY target user that someone liked/superliked them
        const title = isSuperLike ? 'Super Like!' : 'New Like!';
        const body = isSuperLike
          ? `${senderName} super-liked you!`
          : `Someone liked your profile!`;

        await this.notificationsService.sendAndSave(
          targetId,
          title,
          body,
          isSuperLike ? 'SUPERLIKE' : 'LIKE',
          { senderId: userId }
        );
      }
    } catch (error) {
      console.error('Error sending match notifications:', error);
    }

    // -------------------------------

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
    let userObjectId = new Types.ObjectId(userId);
    let data: any = await this.matchModel.find({ users: userObjectId, status: 'matched', }).populate('users').populate("runInviteId");

    return data.map((match) => {
      const matchObj = match.toObject();
      if (matchObj.runInviteId && typeof matchObj.runInviteId === 'object') {
        if (matchObj.runInviteId.status === 'pending') {
          if (matchObj.runInviteId.senderId && matchObj.runInviteId.senderId.toString() === userId) {
            matchObj.inviteStatus = 'pending';
            matchObj.runInviteId.status = 'pending';
          } else {
            matchObj.inviteStatus = 'invited';
            matchObj.runInviteId.status = 'invited';
          }
        } else {
          matchObj.inviteStatus = matchObj.runInviteId.status;
        }
      } else {
        matchObj.inviteStatus = 'none';
      }
      return matchObj;
    });
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

    // Update match with invite ID and status
    await this.matchModel.findByIdAndUpdate(matchId, {
      $set: {
        runInviteId: invite._id,
        virtualRunInviteSent: body.type === 'Virtual_Run' ? true : match.virtualRunInviteSent
      }
    });

    // --- PUSH NOTIFICATION ---
    try {
      const sender = await this.userService.findById(senderId);
      const senderName = sender?.display_name || sender?.first_name || 'Someone';
      
      await this.notificationsService.sendAndSave(
        receiverId.toString(),
        'New Run Invite!',
        `${senderName} sent you a ${body.type.replace('_', ' ')} invite!`,
        'RUN_INVITE',
        { inviteId: invite._id.toString() }
      );
    } catch (error) {
      console.error('Error sending invite notification:', error);
    }


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

    // --- PUSH NOTIFICATION ---
    try {
      const receiver = await this.userService.findById(userId);
      const receiverName = receiver?.display_name || receiver?.first_name || 'Someone';
      
      await this.notificationsService.sendAndSave(
        invite.senderId,
        `Invite ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        `${receiverName} ${status} your run invite!`,
        'INVITE_RESPONSE',
        { inviteId: invite._id.toString(), status }
      );
    } catch (error) {
      console.error('Error sending invite response notification:', error);
    }


    return invite;
  }

  async getReceivedInvites(userId: string, filter: 'all' | 'active' | 'new') {
    const userObjectId = new Types.ObjectId(userId);
    const query: any = { receiverId: userObjectId };

    if (filter === 'active') {
      query.status = 'accepted';
    } else if (filter === 'new') {
      query.status = 'pending';
    }

    return this.inviteModel
      .find(query)
      .populate('senderId', 'first_name last_name display_name age image running_level')
      .populate('matchId')
      .sort({ createdAt: -1 });
  }
}
