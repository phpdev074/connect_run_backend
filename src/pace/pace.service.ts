import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Pace, PaceDocument } from './entities/pace.entity';
import { User, UserDocument } from '../users/entities/user.entity';
import { Match, MatchDocument } from '../matches/entities/match.entity';
import { CreatePaceDto } from './dto/create-pace.dto';
import { UpdatePaceDto } from './dto/update-pace.dto';
import { AddMembersDto } from './dto/add-members.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { RewardsService } from '../rewards/rewards.service';

@Injectable()
export class PaceService {
  constructor(
    @InjectModel(Pace.name) private paceModel: Model<PaceDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly rewardsService: RewardsService,
  ) { }

  /**
   * Helper to fetch matched user IDs for a given user.
   */
  private async getMatchedUserIds(userId: string): Promise<string[]> {
    const userObjectId = new Types.ObjectId(userId);
    const matches = await this.matchModel.find({
      users: userObjectId,
      status: 'matched',
    });

    return matches.flatMap((m) =>
      m.users.map((u) => u.toString()).filter((id) => id !== userId),
    );
  }

  /**
   * Fetch all potential members (matched users) with their basic profile details.
   */
  async getPotentialMembers(userId: string) {
    const matchedUserIds = await this.getMatchedUserIds(userId);
    if (matchedUserIds.length === 0) {
      return [];
    }

    return this.userModel
      .find({
        _id: { $in: matchedUserIds.map((id) => new Types.ObjectId(id)) },
      })
      .select('first_name last_name display_name email image running_level');
  }

  /**
   * Create a Pace (hosted run). Validates that all members specified are matches of the creator.
   */
  async create(userId: string, createPaceDto: CreatePaceDto) {
    const creatorObjectId = new Types.ObjectId(userId);
    const memberObjectIds: Types.ObjectId[] = [creatorObjectId];

    if (createPaceDto.members && createPaceDto.members.length > 0) {
      const matchedUserIds = await this.getMatchedUserIds(userId);

      for (const memberId of createPaceDto.members) {
        if (!matchedUserIds.includes(memberId)) {
          throw new BadRequestException(`User ${memberId} is not matched with you. You can only add matches.`);
        }
        memberObjectIds.push(new Types.ObjectId(memberId));
      }
    }

    // Remove duplicates
    const uniqueMembers = Array.from(new Set(memberObjectIds.map((id) => id.toString()))).map(
      (id) => new Types.ObjectId(id),
    );

    const pace = await this.paceModel.create({
      ...createPaceDto,
      createdBy: creatorObjectId,
      members: uniqueMembers,
      status: createPaceDto.status || 'upcoming',
      date: createPaceDto.date ? new Date(createPaceDto.date) : undefined,
    });

    // Send notifications to added members (excluding the creator)
    if (createPaceDto.members && createPaceDto.members.length > 0) {
      try {
        const creator = await this.userModel.findById(userId);
        const creatorName = creator?.display_name || creator?.first_name || 'Someone';

        for (const memberId of createPaceDto.members) {
          await this.notificationsService.sendAndSave(
            memberId,
            'Added to a Pace!',
            `You were added to the Pace "${pace.name}" by ${creatorName}!`,
            'PACE_ADDED',
            { paceId: pace._id.toString() }
          );
        }
      } catch (error) {
        console.error('Failed to send Pace creation notifications:', error);
      }
    }

    return this.findOne(pace._id.toString());
  }

  /**
   * Find all paces created by other users that are upcoming and not joined yet.
   */
  async findAllExceptOwn(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    return this.paceModel
      .find({
        createdBy: { $ne: userObjectId },
        members: { $ne: userObjectId },
        status: 'upcoming',
      })
      .populate('createdBy', 'first_name last_name display_name email image')
      .populate('members', 'first_name last_name display_name email image');
  }

  /**
   * Find other users' paces that the logged-in user has joined (is a member of).
   */
  async findJoinedOthers(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    return this.paceModel
      .find({
        createdBy: { $ne: userObjectId },
        members: userObjectId,
        status: 'upcoming',
      })
      .populate('createdBy', 'first_name last_name display_name email image')
      .populate('members', 'first_name last_name display_name email image');
  }

  /**
   * Find all paces created by the logged-in user that are upcoming.
   */
  async findOwn(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    return this.paceModel
      .find({
        createdBy: userObjectId,
        status: 'upcoming',
      })
      .populate('createdBy', 'first_name last_name display_name email image')
      .populate('members', 'first_name last_name display_name email image');
  }

  /**
   * Get details of a single Pace.
   */
  async findOne(id: string) {
    const pace = await this.paceModel
      .findById(id)
      .populate('createdBy', 'first_name last_name display_name email image')
      .populate('members', 'first_name last_name display_name email image');

    if (!pace) {
      throw new NotFoundException('Pace not found');
    }
    return pace;
  }

  /**
   * Update a Pace. Restricts editing to the creator and validates added members.
   */
  async update(userId: string, id: string, updatePaceDto: UpdatePaceDto) {
    const pace = await this.paceModel.findById(id);
    if (!pace) {
      throw new NotFoundException('Pace not found');
    }

    if (pace.createdBy.toString() !== userId) {
      throw new ForbiddenException('Only the creator can edit this Pace');
    }

    const newlyAddedMembers: string[] = [];

    if (updatePaceDto.members) {
      const creatorObjectId = new Types.ObjectId(userId);
      const memberObjectIds: Types.ObjectId[] = [creatorObjectId];
      const matchedUserIds = await this.getMatchedUserIds(userId);
      const currentMemberStrIds = pace.members.map((m) => m.toString());

      for (const memberId of updatePaceDto.members) {
        if (!matchedUserIds.includes(memberId)) {
          throw new BadRequestException(`User ${memberId} is not matched with you. You can only add matches.`);
        }
        memberObjectIds.push(new Types.ObjectId(memberId));
        if (!currentMemberStrIds.includes(memberId)) {
          newlyAddedMembers.push(memberId);
        }
      }

      const uniqueMembers = Array.from(new Set(memberObjectIds.map((id) => id.toString()))).map(
        (id) => new Types.ObjectId(id),
      );
      pace.members = uniqueMembers;
    }

    if (updatePaceDto.name !== undefined) pace.name = updatePaceDto.name;
    if (updatePaceDto.description !== undefined) pace.description = updatePaceDto.description;
    if (updatePaceDto.runTravelPlan !== undefined) pace.runTravelPlan = updatePaceDto.runTravelPlan;
    if (updatePaceDto.meetingLocation !== undefined) pace.meetingLocation = updatePaceDto.meetingLocation;
    if (updatePaceDto.distance !== undefined) pace.distance = updatePaceDto.distance;
    if (updatePaceDto.targetPace !== undefined) pace.targetPace = updatePaceDto.targetPace;
    if (updatePaceDto.joinPrice !== undefined) pace.joinPrice = updatePaceDto.joinPrice;
    if (updatePaceDto.date !== undefined) pace.date = updatePaceDto.date ? new Date(updatePaceDto.date) : undefined;
    if (updatePaceDto.time !== undefined) pace.time = updatePaceDto.time;
    if (updatePaceDto.status !== undefined) pace.status = updatePaceDto.status;

    await pace.save();

    // Send notifications to newly added members
    if (newlyAddedMembers.length > 0) {
      try {
        const creator = await this.userModel.findById(userId);
        const creatorName = creator?.display_name || creator?.first_name || 'Someone';

        for (const memberId of newlyAddedMembers) {
          await this.notificationsService.sendAndSave(
            memberId,
            'Added to a Pace!',
            `You were added to the Pace "${pace.name}" by ${creatorName}!`,
            'PACE_ADDED',
            { paceId: pace._id.toString() }
          );
        }
      } catch (error) {
        console.error('Failed to send Pace member update notifications:', error);
      }
    }

    return this.findOne(id);
  }

  /**
   * Delete Pace. Restricts deletion to the creator.
   */
  async delete(userId: string, id: string) {
    const pace = await this.paceModel.findById(id);
    if (!pace) {
      throw new NotFoundException('Pace not found');
    }

    if (pace.createdBy.toString() !== userId) {
      throw new ForbiddenException('Only the creator can delete this Pace');
    }

    await this.paceModel.findByIdAndDelete(id);
    return { deleted: true };
  }

  /**
   * Add members to an existing Pace. Validates that added members are matches.
   */
  async addMembers(userId: string, id: string, addMembersDto: AddMembersDto) {
    const pace = await this.paceModel.findById(id);
    if (!pace) {
      throw new NotFoundException('Pace not found');
    }

    if (pace.createdBy.toString() !== userId) {
      throw new ForbiddenException('Only the creator can add members to this Pace');
    }

    const matchedUserIds = await this.getMatchedUserIds(userId);
    const currentMemberStrIds = pace.members.map((m) => m.toString());
    const newlyAddedMembers: string[] = [];

    for (const memberId of addMembersDto.members) {
      if (!matchedUserIds.includes(memberId)) {
        throw new BadRequestException(`User ${memberId} is not matched with you. You can only add matches.`);
      }
      if (!currentMemberStrIds.includes(memberId)) {
        pace.members.push(new Types.ObjectId(memberId));
        newlyAddedMembers.push(memberId);
      }
    }

    await pace.save();

    // Send notifications to newly added members
    if (newlyAddedMembers.length > 0) {
      try {
        const creator = await this.userModel.findById(userId);
        const creatorName = creator?.display_name || creator?.first_name || 'Someone';

        for (const memberId of newlyAddedMembers) {
          await this.notificationsService.sendAndSave(
            memberId,
            'Added to a Pace!',
            `You were added to the Pace "${pace.name}" by ${creatorName}!`,
            'PACE_ADDED',
            { paceId: pace._id.toString() }
          );
        }
      } catch (error) {
        console.error('Failed to send Pace addMembers notifications:', error);
      }
    }

    return this.findOne(id);
  }

  /**
   * Leave a Pace. Restricts creator from leaving and ensures the user is a member.
   */
  async leave(userId: string, id: string) {
    const pace = await this.paceModel.findById(id);
    if (!pace) {
      throw new NotFoundException('Pace not found');
    }

    if (pace.createdBy.toString() === userId) {
      throw new BadRequestException('As the creator, you cannot leave this Pace. Please delete it instead.');
    }

    const memberIndex = pace.members.findIndex((m) => m.toString() === userId);
    if (memberIndex === -1) {
      throw new BadRequestException('You are not a member of this Pace');
    }

    pace.members.splice(memberIndex, 1);
    await pace.save();

    return {
      success: true,
      message: 'Successfully left the Pace',
    };
  }

  /**
   * Join a Pace. Deducts the joinPrice points from user's account if greater than 0.
   */
  async join(userId: string, id: string) {
    const pace = await this.paceModel.findById(id);
    if (!pace) {
      throw new NotFoundException('Pace not found');
    }

    const memberIndex = pace.members.findIndex((m) => m.toString() === userId);
    if (memberIndex !== -1) {
      throw new BadRequestException('You are already a member of this Pace');
    }

    // Process joining fee payment if applicable
    if (pace.joinPrice && pace.joinPrice > 0) {
      await this.rewardsService.redeemPoints(userId, pace.joinPrice, `Joined Pace: ${pace.name}`);
    }

    pace.members.push(new Types.ObjectId(userId));
    await pace.save();

    return {
      success: true,
      message: 'Successfully joined the Pace',
    };
  }

  /**
   * Mark a Pace run as completed.
   */
  async complete(userId: string, id: string) {
    const pace = await this.paceModel.findById(id);
    if (!pace) {
      throw new NotFoundException('Pace not found');
    }

    // Only allow creator/host to mark as completed
    if (pace.createdBy.toString() !== userId) {
      throw new ForbiddenException('Only the host of this Pace can mark it as completed');
    }

    pace.status = 'completed';
    await pace.save();

    return {
      success: true,
      message: 'Pace marked as completed successfully',
    };
  }

  /**
   * Get all upcoming paces (hosted runs) available to join.
   */
  async getFeed(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    return this.paceModel
      .find({
        createdBy: { $ne: userObjectId },
        members: { $ne: userObjectId },
        status: 'upcoming',
      })
      .populate('createdBy', 'first_name last_name display_name email image')
      .populate('members', 'first_name last_name display_name email image')
      .sort({ date: 1 });
  }

  /**
   * Get history of completed paces (hosted runs) that the user participated in (either hosted or joined).
   */
  async getHistory(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    return this.paceModel
      .find({
        $or: [
          { createdBy: userObjectId },
          { members: userObjectId }
        ],
        status: 'completed',
      })
      .populate('createdBy', 'first_name last_name display_name email image')
      .populate('members', 'first_name last_name display_name email image')
      .sort({ date: -1 });
  }
}
