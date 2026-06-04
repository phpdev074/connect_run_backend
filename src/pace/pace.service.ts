import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Group, GroupDocument } from './entities/pace.entity';
import { User, UserDocument } from '../users/entities/user.entity';
import { Match, MatchDocument } from '../matches/entities/match.entity';
import { GroupRun, GroupRunDocument } from './entities/pace-run.entity';
import { CreateGroupDto } from './dto/create-pace.dto';
import { UpdateGroupDto } from './dto/update-pace.dto';
import { AddMembersDto } from './dto/add-members.dto';
import { CreateGroupRunDto } from './dto/create-pace-run.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class GroupService {
  constructor(
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
    @InjectModel(GroupRun.name) private groupRunModel: Model<GroupRunDocument>,
    private readonly notificationsService: NotificationsService,
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
   * Create a group. Validates that all members specified are matches of the creator.
   */
  async create(userId: string, createGroupDto: CreateGroupDto) {
    const creatorObjectId = new Types.ObjectId(userId);
    const memberObjectIds: Types.ObjectId[] = [creatorObjectId];

    if (createGroupDto.members && createGroupDto.members.length > 0) {
      const matchedUserIds = await this.getMatchedUserIds(userId);

      for (const memberId of createGroupDto.members) {
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

    const group = await this.groupModel.create({
      ...createGroupDto,
      createdBy: creatorObjectId,
      members: uniqueMembers,
    });

    // Send notifications to added members (excluding the creator)
    if (createGroupDto.members && createGroupDto.members.length > 0) {
      try {
        const creator = await this.userModel.findById(userId);
        const creatorName = creator?.display_name || creator?.first_name || 'Someone';

        for (const memberId of createGroupDto.members) {
          await this.notificationsService.sendAndSave(
            memberId,
            'Added to a Group!',
            `You were added to the group "${group.name}" by ${creatorName}!`,
            'GROUP_ADDED',
            { groupId: group._id.toString() }
          );
        }
      } catch (error) {
        console.error('Failed to send group creation notifications:', error);
      }
    }

    return this.findOne(group._id.toString());
  }

  /**
   * Find all groups created by other users.
   */
  async findAllExceptOwn(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    return this.groupModel
      .find({
        createdBy: { $ne: userObjectId },
        members: { $ne: userObjectId },
      })
      .populate('createdBy', 'first_name last_name display_name email image')
      .populate('members', 'first_name last_name display_name email image');
  }

  /**
   * Find other users' groups that the logged-in user has joined (is a member of).
   */
  async findJoinedOthers(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    return this.groupModel
      .find({
        createdBy: { $ne: userObjectId },
        members: userObjectId,
      })
      .populate('createdBy', 'first_name last_name display_name email image')
      .populate('members', 'first_name last_name display_name email image');
  }

  /**
   * Find all groups created by the logged-in user.
   */
  async findOwn(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    return this.groupModel
      .find({
        createdBy: userObjectId,
      })
      .populate('createdBy', 'first_name last_name display_name email image')
      .populate('members', 'first_name last_name display_name email image');
  }

  /**
   * Get details of a single group.
   */
  async findOne(id: string) {
    const group = await this.groupModel
      .findById(id)
      .populate('createdBy', 'first_name last_name display_name email image')
      .populate('members', 'first_name last_name display_name email image');

    if (!group) {
      throw new NotFoundException('Group not found');
    }
    return group;
  }

  /**
   * Update a group. Restricts editing to the creator and validates added members.
   */
  async update(userId: string, id: string, updateGroupDto: UpdateGroupDto) {
    const group = await this.groupModel.findById(id);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.createdBy.toString() !== userId) {
      throw new ForbiddenException('Only the creator can edit this group');
    }

    const newlyAddedMembers: string[] = [];

    if (updateGroupDto.members) {
      const creatorObjectId = new Types.ObjectId(userId);
      const memberObjectIds: Types.ObjectId[] = [creatorObjectId];
      const matchedUserIds = await this.getMatchedUserIds(userId);
      const currentMemberStrIds = group.members.map((m) => m.toString());

      for (const memberId of updateGroupDto.members) {
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
      group.members = uniqueMembers;
    }

    if (updateGroupDto.name !== undefined) group.name = updateGroupDto.name;
    if (updateGroupDto.description !== undefined) group.description = updateGroupDto.description;
    if (updateGroupDto.image !== undefined) group.image = updateGroupDto.image;
    if (updateGroupDto.paceRange !== undefined) group.paceRange = updateGroupDto.paceRange;
    if (updateGroupDto.maxMembers !== undefined) group.maxMembers = updateGroupDto.maxMembers;
    if (updateGroupDto.visibility !== undefined) group.visibility = updateGroupDto.visibility;

    await group.save();

    // Send notifications to newly added members
    if (newlyAddedMembers.length > 0) {
      try {
        const creator = await this.userModel.findById(userId);
        const creatorName = creator?.display_name || creator?.first_name || 'Someone';

        for (const memberId of newlyAddedMembers) {
          await this.notificationsService.sendAndSave(
            memberId,
            'Added to a Group!',
            `You were added to the group "${group.name}" by ${creatorName}!`,
            'GROUP_ADDED',
            { groupId: group._id.toString() }
          );
        }
      } catch (error) {
        console.error('Failed to send group member update notifications:', error);
      }
    }

    return this.findOne(id);
  }

  /**
   * Delete group. Restricts deletion to the creator.
   */
  async delete(userId: string, id: string) {
    const group = await this.groupModel.findById(id);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.createdBy.toString() !== userId) {
      throw new ForbiddenException('Only the creator can delete this group');
    }

    await this.groupModel.findByIdAndDelete(id);
    return { deleted: true };
  }

  /**
   * Add members to an existing group. Validates that added members are matches.
   */
  async addMembers(userId: string, id: string, addMembersDto: AddMembersDto) {
    const group = await this.groupModel.findById(id);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.createdBy.toString() !== userId) {
      throw new ForbiddenException('Only the creator can add members to this group');
    }

    const matchedUserIds = await this.getMatchedUserIds(userId);
    const currentMemberStrIds = group.members.map((m) => m.toString());
    const newlyAddedMembers: string[] = [];

    for (const memberId of addMembersDto.members) {
      if (!matchedUserIds.includes(memberId)) {
        throw new BadRequestException(`User ${memberId} is not matched with you. You can only add matches.`);
      }
      if (!currentMemberStrIds.includes(memberId)) {
        group.members.push(new Types.ObjectId(memberId));
        newlyAddedMembers.push(memberId);
      }
    }

    await group.save();

    // Send notifications to newly added members
    if (newlyAddedMembers.length > 0) {
      try {
        const creator = await this.userModel.findById(userId);
        const creatorName = creator?.display_name || creator?.first_name || 'Someone';

        for (const memberId of newlyAddedMembers) {
          await this.notificationsService.sendAndSave(
            memberId,
            'Added to a Group!',
            `You were added to the group "${group.name}" by ${creatorName}!`,
            'GROUP_ADDED',
            { groupId: group._id.toString() }
          );
        }
      } catch (error) {
        console.error('Failed to send group addMembers notifications:', error);
      }
    }

    return this.findOne(id);
  }

  /**
   * Leave a group. Restricts creator from leaving and ensures the user is a member.
   */
  async leave(userId: string, id: string) {
    const group = await this.groupModel.findById(id);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.createdBy.toString() === userId) {
      throw new BadRequestException('As the creator, you cannot leave this group. Please delete it instead.');
    }

    const memberIndex = group.members.findIndex((m) => m.toString() === userId);
    if (memberIndex === -1) {
      throw new BadRequestException('You are not a member of this group');
    }

    group.members.splice(memberIndex, 1);
    await group.save();

    return {
      success: true,
      message: 'Successfully left the group',
    };
  }

  /**
   * Create a group run (member/creator of the group only).
   */
  async createRun(userId: string, groupId: string, dto: CreateGroupRunDto) {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const isMember = group.members.some((m) => m.toString() === userId);
    if (!isMember && group.createdBy.toString() !== userId) {
      throw new ForbiddenException('You must be a member of this group to create a run');
    }

    const run = await this.groupRunModel.create({
      ...dto,
      groupId: new Types.ObjectId(groupId),
      createdBy: new Types.ObjectId(userId),
      participants: [new Types.ObjectId(userId)], // creator is a participant by default
    });

    return run.populate([
      { path: 'createdBy', select: 'first_name last_name display_name email image' },
      { path: 'participants', select: 'first_name last_name display_name email image' },
    ]);
  }

  /**
   * Get all upcoming group runs for groups that the user is a member of.
   */
  async getRunsFeed(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    // Find groups where the user is a member
    const joinedGroups = await this.groupModel.find({
      members: userObjectId,
    });
    const groupIds = joinedGroups.map((g) => g._id);

    return this.groupRunModel
      .find({
        groupId: { $in: groupIds },
        status: 'upcoming',
      })
      .populate('groupId', 'name image')
      .populate('createdBy', 'first_name last_name display_name email image')
      .populate('participants', 'first_name last_name display_name email image')
      .sort({ date: 1 });
  }

  /**
   * Join a scheduled group run.
   */
  async joinRun(userId: string, runId: string) {
    const run = await this.groupRunModel.findById(runId);
    if (!run) {
      throw new NotFoundException('Group run not found');
    }

    const group = await this.groupModel.findById(run.groupId);
    if (!group) {
      throw new NotFoundException('Associated group not found');
    }

    const isMember = group.members.some((m) => m.toString() === userId);
    if (!isMember && group.createdBy.toString() !== userId) {
      throw new ForbiddenException('You must be a member of the group to join this run');
    }

    const isParticipant = run.participants.some((p) => p.toString() === userId);
    if (isParticipant) {
      throw new BadRequestException('You have already joined this run');
    }

    run.participants.push(new Types.ObjectId(userId));
    await run.save();

    return {
      success: true,
      message: 'Successfully joined the run',
    };
  }

  /**
   * Mark a group run as completed.
   */
  async completeRun(userId: string, runId: string) {
    const run = await this.groupRunModel.findById(runId);
    if (!run) {
      throw new NotFoundException('Group run not found');
    }

    // Only allow creator to mark as completed
    if (run.createdBy.toString() !== userId) {
      throw new ForbiddenException('Only the creator of this run can mark it as completed');
    }

    run.status = 'completed';
    await run.save();

    return {
      success: true,
      message: 'Run marked as completed successfully',
    };
  }

  /**
   * Get history of completed group runs that the user participated in.
   */
  async getRunsHistory(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    return this.groupRunModel
      .find({
        participants: userObjectId,
        status: 'completed',
      })
      .populate('groupId', 'name image')
      .populate('createdBy', 'first_name last_name display_name email image')
      .populate('participants', 'first_name last_name display_name email image')
      .sort({ date: -1 });
  }
}
