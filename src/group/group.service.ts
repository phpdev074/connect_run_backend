import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Group, GroupDocument } from './entities/group.entity';
import { User, UserDocument } from '../users/entities/user.entity';
import { Match, MatchDocument } from '../matches/entities/match.entity';
import { GroupRun, GroupRunDocument } from './entities/group-run.entity';
import { GroupRunPath, GroupRunPathDocument } from './entities/group-run-path.entity';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { AddMembersDto } from './dto/add-members.dto';
import { CreateGroupRunDto } from './dto/create-group-run.dto';
import { RecordCoordinateDto } from '../community/dto/record-coordinate.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { Chat, ChatDocument } from '../chat/entities/chat.entity';

@Injectable()
export class GroupService {
  constructor(
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
    @InjectModel(GroupRun.name) private groupRunModel: Model<GroupRunDocument>,
    @InjectModel(GroupRunPath.name) private groupRunPathModel: Model<GroupRunPathDocument>,
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
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

    // Automatically create Group Chat
    try {
      await this.chatModel.create({
        participants: uniqueMembers,
        isLocked: false,
        lastActivity: new Date(),
        groupName: group.name,
        groupImage: group.image,
        type: 'group',
        referenceId: group._id,
      });
    } catch (error) {
      console.error('Failed to create group chat:', error);
    }

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
    await group.save();

    // Sync chat details
    try {
      const updateFields: any = {};
      if (updateGroupDto.name !== undefined) updateFields.groupName = updateGroupDto.name;
      if (updateGroupDto.image !== undefined) updateFields.groupImage = updateGroupDto.image;
      if (updateGroupDto.members) updateFields.participants = group.members;
      if (Object.keys(updateFields).length > 0) {
        await this.chatModel.updateOne(
          { referenceId: group._id, type: 'group' },
          { $set: updateFields },
        );
      }
    } catch (error) {
      console.error('Failed to sync group chat update:', error);
    }

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

    // Delete associated group chat
    try {
      await this.chatModel.deleteOne({ referenceId: new Types.ObjectId(id), type: 'group' });
    } catch (error) {
      console.error('Failed to delete group chat:', error);
    }

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

    // Sync group chat participants
    try {
      await this.chatModel.updateOne(
        { referenceId: group._id, type: 'group' },
        { $addToSet: { participants: { $each: group.members } } },
      );
    } catch (error) {
      console.error('Failed to update group chat members:', error);
    }

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

    // Remove user from group chat participants
    try {
      await this.chatModel.updateOne(
        { referenceId: group._id, type: 'group' },
        { $pull: { participants: new Types.ObjectId(userId) } },
      );
    } catch (error) {
      console.error('Failed to remove user from group chat:', error);
    }

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
      .populate('pathId')
      .sort({ date: -1 });
  }

  /**
   * Record a single GPS coordinate point for an ongoing group run.
   */
  async recordRunCoordinate(userId: string, runId: string, dto: RecordCoordinateDto) {
    const run = await this.groupRunModel.findById(runId);
    if (!run) {
      throw new NotFoundException('Group run not found');
    }

    // Allow participants or creator to record coordinates
    const isParticipant = run.participants.some((p) => p.toString() === userId);
    if (!isParticipant && run.createdBy.toString() !== userId) {
      throw new ForbiddenException('You are not a participant in this group run');
    }

    let path = await this.groupRunPathModel.findOne({ groupRunId: run._id });

    if (!path) {
      // Create new path document
      path = await this.groupRunPathModel.create({
        groupRunId: run._id,
        gpsTrack: [{ latitude: dto.latitude, longitude: dto.longitude }],
      });
      // Link the path to the run
      run.pathId = path._id as Types.ObjectId;
      await run.save();
    } else {
      // Append coordinate to existing path
      path = await this.groupRunPathModel.findOneAndUpdate(
        { groupRunId: run._id },
        { $push: { gpsTrack: { latitude: dto.latitude, longitude: dto.longitude } } },
        { new: true },
      );
    }

    return path;
  }

  /**
   * Request to join a group.
   */
  async requestJoinGroup(userId: string, groupId: string) {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.members.some((m) => m.toString() === userId)) {
      throw new BadRequestException('You are already a member of this group');
    }

    if (group.joinRequests && group.joinRequests.some((r) => r.toString() === userId)) {
      throw new BadRequestException('You have already requested to join this group');
    }

    if (!group.joinRequests) {
      group.joinRequests = [];
    }

    group.joinRequests.push(new Types.ObjectId(userId));
    await group.save();

    // Notify the creator
    try {
      const requester = await this.userModel.findById(userId);
      const requesterName = requester?.display_name || requester?.first_name || 'Someone';

      await this.notificationsService.sendAndSave(
        group.createdBy.toString(),
        'New Group Join Request!',
        `${requesterName} requested to join your group "${group.name}".`,
        'GROUP_JOIN_REQUEST',
        { groupId: group._id.toString(), requesterId: userId }
      );
    } catch (error) {
      console.error('Failed to send group join request notification:', error);
    }

    return {
      success: true,
      message: 'Join request sent successfully',
    };
  }

  /**
   * Get all join requests for a specific group.
   */
  async getJoinRequests(userId: string, groupId: string) {
    const group = await this.groupModel.findById(groupId)
      .populate('joinRequests', 'first_name last_name display_name email image');
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.createdBy.toString() !== userId) {
      throw new ForbiddenException('Only the creator can view join requests');
    }

    return group.joinRequests || [];
  }

  /**
   * Approve a join request for a group.
   */
  async approveJoinRequest(userId: string, groupId: string, requestId: string) {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.createdBy.toString() !== userId) {
      throw new ForbiddenException('Only the creator can approve join requests');
    }

    if (!group.joinRequests || !group.joinRequests.some(r => r.toString() === requestId)) {
      throw new BadRequestException('Join request not found');
    }

    // Remove from joinRequests
    group.joinRequests = group.joinRequests.filter(r => r.toString() !== requestId);

    // Add to members if not already
    if (!group.members.some(m => m.toString() === requestId)) {
      group.members.push(new Types.ObjectId(requestId));
    }

    await group.save();

    // Sync group chat participants
    try {
      await this.chatModel.updateOne(
        { referenceId: group._id, type: 'group' },
        { $addToSet: { participants: new Types.ObjectId(requestId) } },
      );
    } catch (error) {
      console.error('Failed to update group chat members after approval:', error);
    }

    // Notify the user
    try {
      await this.notificationsService.sendAndSave(
        requestId,
        'Join Request Approved!',
        `Your request to join the group "${group.name}" has been approved!`,
        'GROUP_JOIN_APPROVED',
        { groupId: group._id.toString() }
      );
    } catch (error) {
      console.error('Failed to send group join approval notification:', error);
    }

    return {
      success: true,
      message: 'Join request approved successfully',
    };
  }

  /**
   * Reject a join request for a group.
   */
  async rejectJoinRequest(userId: string, groupId: string, requestId: string) {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.createdBy.toString() !== userId) {
      throw new ForbiddenException('Only the creator can reject join requests');
    }

    if (!group.joinRequests || !group.joinRequests.some(r => r.toString() === requestId)) {
      throw new BadRequestException('Join request not found');
    }

    // Remove from joinRequests
    group.joinRequests = group.joinRequests.filter(r => r.toString() !== requestId);
    await group.save();

    return {
      success: true,
      message: 'Join request rejected successfully',
    };
  }
}
