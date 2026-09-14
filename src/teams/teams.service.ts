import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Team, TeamDocument } from './entities/team.entity';
import { User, UserDocument } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';

import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { InviteMembersDto } from './dto/team-actions.dto';
import { JoinTeamDto } from './dto/team-actions.dto';
import { AddChallengeDto } from './dto/team-actions.dto';
import { Chat, ChatDocument } from '../chat/entities/chat.entity';

@Injectable()
export class TeamsService {
  constructor(
    @InjectModel(Team.name) private teamModel: Model<TeamDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Generate a random join code when none is provided. */
  private generateJoinCode(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 12; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
      if (i === 2 || i === 5 || i === 8) code += '-';
    }
    return code;
  }

  /** Fetch a team with populated creator, captain, and members. */
  async findOne(id: string) {
    const team = await this.teamModel
      .findById(id)
      .populate('createdBy', 'first_name last_name display_name email image')
      .populate('captain', 'first_name last_name display_name email image')
      .populate('members', 'first_name last_name display_name email image')
      .populate('invitees', 'first_name last_name display_name email image');

    if (!team) {
      throw new NotFoundException('Team not found');
    }
    return team;
  }

  /** Create a team. Returns populated team. */
  async create(userId: string, dto: CreateTeamDto) {
    const creatorObjectId = new Types.ObjectId(userId);
    const memberObjectIds: Types.ObjectId[] = [creatorObjectId];
    const inviteeObjectIds: Types.ObjectId[] = [];

    if (dto.members && dto.members.length > 0) {
      for (const memberId of dto.members) {
        const exists = await this.userModel.exists({ _id: new Types.ObjectId(memberId) });
        if (!exists) {
          throw new BadRequestException(`User ${memberId} not found`);
        }
        memberObjectIds.push(new Types.ObjectId(memberId));
      }
    }

    const uniqueMembers = Array.from(new Set(memberObjectIds.map((id) => id.toString())))
      .map((id) => new Types.ObjectId(id));

    const team = await this.teamModel.create({
      ...dto,
      createdBy: creatorObjectId,
      members: uniqueMembers,
      captain: creatorObjectId,
      joinCode: dto.joinCode || this.generateJoinCode(),
    });

    // Automatically create Team Chat
    try {
      await this.chatModel.create({
        participants: uniqueMembers,
        isLocked: false,
        lastActivity: new Date(),
        groupName: team.name,
        groupImage: team.image,
        type: 'team',
        referenceId: team._id,
      });
    } catch (error) {
      console.error('Failed to create team chat:', error);
    }

    return this.findOne(team._id.toString());
  }

  /** List teams the user owns. */
  async findOwned(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    return this.teamModel
      .find({ createdBy: userObjectId })
      .populate('createdBy', 'first_name last_name display_name email image')
      .populate('captain', 'first_name last_name display_name email image')
      .populate('members', 'first_name last_name display_name email image');
  }

  /** List teams the user is a member of (joined). */
  async findJoined(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    return this.teamModel
      .find({ members: userObjectId })
      .populate('createdBy', 'first_name last_name display_name email image')
      .populate('captain', 'first_name last_name display_name email image')
      .populate('members', 'first_name last_name display_name email image');
  }

  /** List all teams (including the user's own). */
  async findAll(userId: string) {
    return this.teamModel
      .find()
      .populate('createdBy', 'first_name last_name display_name email image')
      .populate('captain', 'first_name last_name display_name email image')
      .populate('members', 'first_name last_name display_name email image');
  }

  /** Update a team (owner or captain). */
  async update(userId: string, id: string, dto: UpdateTeamDto) {
    const team = await this.teamModel.findById(id);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const isOwner = team.createdBy.toString() === userId;

    if (!isOwner && team.captain?.toString() !== userId) {
      throw new ForbiddenException('Only the owner or captain can edit this team');
    }

    if (dto.name !== undefined) team.name = dto.name;
    if (dto.description !== undefined) team.description = dto.description;
    if (dto.image !== undefined) team.image = dto.image;
    if (dto.paceRange !== undefined) team.paceRange = dto.paceRange;
    if (dto.maxMembers !== undefined) team.maxMembers = dto.maxMembers;
    if (dto.visibility !== undefined) team.visibility = dto.visibility;
    if (dto.joinCode !== undefined) team.joinCode = dto.joinCode;

    await team.save();

    // Sync team chat details
    try {
      const updateFields: any = {};
      if (dto.name !== undefined) updateFields.groupName = dto.name;
      if (dto.image !== undefined) updateFields.groupImage = dto.image;
      if (Object.keys(updateFields).length > 0) {
        await this.chatModel.updateOne(
          { referenceId: team._id, type: 'team' },
          { $set: updateFields },
        );
      }
    } catch (error) {
      console.error('Failed to sync team chat update:', error);
    }

    return this.findOne(id);
  }

  /** Delete a team (owner only). */
  async delete(userId: string, id: string) {
    const team = await this.teamModel.findById(id);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.createdBy.toString() !== userId) {
      throw new ForbiddenException('Only the owner can delete this team');
    }

    await this.teamModel.findByIdAndDelete(id);

    // Delete associated team chat
    try {
      await this.chatModel.deleteOne({ referenceId: new Types.ObjectId(id), type: 'team' });
    } catch (error) {
      console.error('Failed to delete team chat:', error);
    }

    return { deleted: true };
  }

  /** Invite users to join the team. Owner or captain only. */
  async invite(userId: string, id: string, dto: InviteMembersDto) {
    const team = await this.teamModel.findById(id);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const isOwner = team.createdBy.toString() === userId;
    const isCaptain = team.captain?.toString() === userId;
    if (!isOwner && !isCaptain) {
      throw new ForbiddenException('Only the owner or captain can invite members');
    }

    const currentMemberIds = team.members.map((m) => m.toString());
    const newlyInvited: string[] = [];

    for (const userIdStr of dto.userIds) {
      const uid = new Types.ObjectId(userIdStr);
      const exists = await this.userModel.exists({ _id: uid });
      if (!exists) {
        throw new BadRequestException(`User ${userIdStr} not found`);
      }

      if (!currentMemberIds.includes(userIdStr)) {
        const alreadyInvited = team.invitees.some((i) => i.toString() === userIdStr);
        if (!alreadyInvited) {
          team.invitees.push(uid);
          newlyInvited.push(userIdStr);
        }
      }
    }

    await team.save();

    if (newlyInvited.length > 0) {
      try {
        const owner = await this.userModel.findById(userId);
        const ownerName = owner?.display_name || owner?.first_name || 'Someone';
        for (const inviteeId of newlyInvited) {
          await this.notificationsService.sendAndSave(
            inviteeId,
            'Invited to a Team!',
            `You were invited to join \"${team.name}\" by ${ownerName}.`,
            'TEAM_INVITED',
            { teamId: team._id.toString() },
          );
        }
      } catch (error) {
        console.error('Failed to send team invite notifications:', error);
      }
    }

    return this.findOne(id);
  }

  /** Accept an invite. Adds the user to members and clears them from invitees. */
  async acceptInvite(userId: string, id: string) {
    const team = await this.teamModel.findById(id);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const userObjectId = new Types.ObjectId(userId);
    const isInvited = team.invitees.some((i) => i.toString() === userId);
    if (!isInvited) {
      throw new BadRequestException('You have not been invited to this team');
    }

    if (team.members.some((m) => m.toString() === userId)) {
      throw new BadRequestException('You are already a member of this team');
    }

    if (team.maxMembers && team.members.length >= team.maxMembers) {
      throw new BadRequestException('Team is at full capacity');
    }

    team.invitees = team.invitees.filter((i) => i.toString() !== userId);
    team.members.push(userObjectId);

    await team.save();

    // Add user to team chat
    try {
      await this.chatModel.updateOne(
        { referenceId: team._id, type: 'team' },
        { $addToSet: { participants: userObjectId } },
      );
    } catch (error) {
      console.error('Failed to add user to team chat on acceptInvite:', error);
    }

    try {
      const owner = await this.userModel.findById(team.createdBy.toString());
      const ownerName = owner?.display_name || owner?.first_name || 'Someone';
      await this.notificationsService.sendAndSave(
        userId,
        `Joined ${team.name}`,
        `You joined ${team.name}.`,
        'TEAM_JOINED',
        { teamId: team._id.toString() },
      );
      await this.notificationsService.sendAndSave(
        team.createdBy.toString(),
        `${ownerName} joined ${team.name}`,
        `${ownerName} accepted the invite to ${team.name}.`,
        'TEAM_MEMBER_JOINED',
        { teamId: team._id.toString() },
      );
    } catch (error) {
      console.error('Failed to send team join notifications:', error);
    }

    return this.findOne(id);
  }

  /** Join a team by join code. */
  async joinByCode(userId: string, code: JoinTeamDto) {
    const team = await this.teamModel.findOne({ joinCode: code.joinCode });

    if (!team) {
      throw new NotFoundException('Team not found or invalid join code');
    }

    const userObjectId = new Types.ObjectId(userId);

    if (team.members.some((m) => m.toString() === userId)) {
      throw new BadRequestException('You are already a member of this team');
    }

    if (team.maxMembers && team.members.length >= team.maxMembers) {
      throw new BadRequestException('Team is at full capacity');
    }

    team.members.push(userObjectId);
    await team.save();

    // Add user to team chat
    try {
      await this.chatModel.updateOne(
        { referenceId: team._id, type: 'team' },
        { $addToSet: { participants: userObjectId } },
      );
    } catch (error) {
      console.error('Failed to add user to team chat on joinByCode:', error);
    }

    try {
      const owner = await this.userModel.findById(team.createdBy.toString());
      const ownerName = owner?.display_name || owner?.first_name || 'Someone';
      await this.notificationsService.sendAndSave(
        userId,
        `Joined ${team.name}`,
        `You joined ${team.name} using the join code.`,
        'TEAM_JOINED',
        { teamId: team._id.toString() },
      );
      await this.notificationsService.sendAndSave(
        team.createdBy.toString(),
        `${ownerName} joined ${team.name}`,
        `${ownerName} joined ${team.name} using the join code.`,
        'TEAM_MEMBER_JOINED',
        { teamId: team._id.toString() },
      );
    } catch (error) {
      console.error('Failed to send team join-by-code notifications:', error);
    }

    return this.findOne(team._id.toString());
  }

  /** Leave a team. Owner cannot leave unless they transfer captaincy first. */
  async leave(userId: string, id: string) {
    const team = await this.teamModel.findById(id);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.createdBy.toString() === userId) {
      throw new BadRequestException('The owner cannot leave. Transfer captaincy or delete the team instead.');
    }

    const memberIndex = team.members.findIndex((m) => m.toString() === userId);
    if (memberIndex === -1) {
      throw new BadRequestException('You are not a member of this team');
    }

    team.members.splice(memberIndex, 1);
    if (team.captain?.toString() === userId) {
      team.captain = team.members[0] || undefined;
    }

    await team.save();

    // Remove user from team chat
    try {
      await this.chatModel.updateOne(
        { referenceId: team._id, type: 'team' },
        { $pull: { participants: new Types.ObjectId(userId) } },
      );
    } catch (error) {
      console.error('Failed to remove user from team chat on leave:', error);
    }

    try {
      await this.notificationsService.sendAndSave(
        userId,
        `Left ${team.name}`,
        `You left ${team.name}.`,
        'TEAM_LEFT',
        { teamId: team._id.toString() },
      );
    } catch (error) {
      console.error('Failed to send team leave notifications:', error);
    }

    return { success: true, message: 'Left team successfully' };
  }

  /** Transfer captaincy to a member. Owner only. */
  async transferCaptain(userId: string, id: string, userIds: { userId: string }) {
    const team = await this.teamModel.findById(id);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.createdBy.toString() !== userId) {
      throw new ForbiddenException('Only the owner can transfer captaincy');
    }

    const targetId = new Types.ObjectId(userIds.userId);
    const isMember = team.members.some((m) => m.toString() === userIds.userId);

    if (!isMember) {
      throw new BadRequestException(`User ${userIds.userId} is not a member of this team`);
    }

    team.captain = targetId;
    await team.save();

    return this.findOne(id);
  }

  /** Update daily/weekly miles for a team. Logged-in user must be a member. */
  async updateMiles(userId: string, id: string, miles: number) {
    const team = await this.teamModel.findById(id);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const isMember = team.members.some((m) => m.toString() === userId);
    if (!isMember && team.createdBy.toString() !== userId && team.captain?.toString() !== userId) {
      throw new ForbiddenException('Only members can update team miles');
    }

    team.weeklyMiles = (team.weeklyMiles ?? 0) + miles;
    team.weeklyMilesUpdatedAt = new Date().toISOString();

    await team.save();
    return this.findOne(id);
  }

  /** Get teams where the user has been invited (is in invitees). */
  async getInvitations(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    return this.teamModel
      .find({ invitees: userObjectId })
      .populate('createdBy', 'first_name last_name display_name email image')
      .populate('captain', 'first_name last_name display_name email image')
      .populate('members', 'first_name last_name display_name email image')
      .populate('invitees', 'first_name last_name display_name email image');
  }

  /** Add a challenge to the team. Owner/captain only. */
  async addChallenge(userId: string, id: string, dto: AddChallengeDto) {
    const team = await this.teamModel.findById(id);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const isOwner = team.createdBy.toString() === userId;
    const isCaptain = team.captain?.toString() === userId;
    if (!isOwner && !isCaptain) {
      throw new ForbiddenException('Only the owner or captain can add challenges');
    }

    const challenge = {
      title: dto.title,
      startDate: dto.startDate,
      endDate: dto.endDate,
      currentCount: 0,
      targetCount: dto.targetCount,
      status: 'upcoming',
    } as const;

    team.challenges = team.challenges || [];
    team.challenges.push(challenge);
    await team.save();
    return this.findOne(id);
  }

  /** Request to join a team or direct join if public. */
  async requestJoinTeam(userId: string, teamId: string) {
    const team = await this.teamModel.findById(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.members.some((m) => m.toString() === userId)) {
      throw new BadRequestException('You are already a member of this team');
    }

    if (team.maxMembers && team.members.length >= team.maxMembers) {
      throw new BadRequestException('Team is at full capacity');
    }

    const visibility = (team.visibility || 'public').toLowerCase();

    // If public visibility, directly add member
    if (visibility === 'public') {
      team.members.push(new Types.ObjectId(userId));

      if (team.joinRequests) {
        team.joinRequests = team.joinRequests.filter((r) => r.toString() !== userId);
      }
      if (team.invitees) {
        team.invitees = team.invitees.filter((i) => i.toString() !== userId);
      }

      await team.save();

      // Sync team chat participants
      try {
        await this.chatModel.updateOne(
          { referenceId: team._id, type: 'team' },
          { $addToSet: { participants: new Types.ObjectId(userId) } },
        );
      } catch (error) {
        console.error('Failed to update team chat members after join:', error);
      }

      return {
        success: true,
        message: 'Joined team successfully',
        joined: true,
      };
    }

    // If private visibility, send join request
    if (team.joinRequests && team.joinRequests.some((r) => r.toString() === userId)) {
      throw new BadRequestException('You have already requested to join this team');
    }

    if (!team.joinRequests) {
      team.joinRequests = [];
    }

    team.joinRequests.push(new Types.ObjectId(userId));
    await team.save();

    // Notify the creator/captain
    try {
      const requester = await this.userModel.findById(userId);
      const requesterName = requester?.display_name || requester?.first_name || 'Someone';
      const notifyId = team.captain ? team.captain.toString() : team.createdBy.toString();

      await this.notificationsService.sendAndSave(
        notifyId,
        'New Team Join Request!',
        `${requesterName} requested to join your team "${team.name}".`,
        'TEAM_JOIN_REQUEST',
        { teamId: team._id.toString(), requesterId: userId }
      );
    } catch (error) {
      console.error('Failed to send team join request notification:', error);
    }

    return {
      success: true,
      message: 'Join request sent successfully',
      joined: false,
    };
  }

  /** Get all join requests for a specific team. */
  async getJoinRequests(userId: string, teamId: string) {
    const team = await this.teamModel.findById(teamId)
      .populate('joinRequests', 'first_name last_name display_name email image');
      
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const isOwner = team.createdBy.toString() === userId;
    const isCaptain = team.captain?.toString() === userId;
    if (!isOwner && !isCaptain) {
      throw new ForbiddenException('Only the owner or captain can view join requests');
    }

    return team.joinRequests || [];
  }

  /** Approve a join request for a team. */
  async approveJoinRequest(userId: string, teamId: string, requestId: string) {
    const team = await this.teamModel.findById(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const isOwner = team.createdBy.toString() === userId;
    const isCaptain = team.captain?.toString() === userId;
    if (!isOwner && !isCaptain) {
      throw new ForbiddenException('Only the owner or captain can approve join requests');
    }

    if (!team.joinRequests || !team.joinRequests.some(r => r.toString() === requestId)) {
      throw new BadRequestException('Join request not found');
    }

    if (team.maxMembers && team.members.length >= team.maxMembers) {
      throw new BadRequestException('Team is at full capacity');
    }

    // Remove from joinRequests
    team.joinRequests = team.joinRequests.filter(r => r.toString() !== requestId);
    
    // Add to members if not already
    if (!team.members.some(m => m.toString() === requestId)) {
      team.members.push(new Types.ObjectId(requestId));
    }
    
    await team.save();

    // Sync team chat participants
    try {
      await this.chatModel.updateOne(
        { referenceId: team._id, type: 'team' },
        { $addToSet: { participants: new Types.ObjectId(requestId) } },
      );
    } catch (error) {
      console.error('Failed to update team chat members after approval:', error);
    }

    // Notify the user
    try {
      await this.notificationsService.sendAndSave(
        requestId,
        'Join Request Approved!',
        `Your request to join the team "${team.name}" has been approved!`,
        'TEAM_JOIN_APPROVED',
        { teamId: team._id.toString() }
      );
    } catch (error) {
      console.error('Failed to send team join approval notification:', error);
    }

    return {
      success: true,
      message: 'Join request approved successfully',
    };
  }

  /** Reject a join request for a team. */
  async rejectJoinRequest(userId: string, teamId: string, requestId: string) {
    const team = await this.teamModel.findById(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const isOwner = team.createdBy.toString() === userId;
    const isCaptain = team.captain?.toString() === userId;
    if (!isOwner && !isCaptain) {
      throw new ForbiddenException('Only the owner or captain can reject join requests');
    }

    if (!team.joinRequests || !team.joinRequests.some(r => r.toString() === requestId)) {
      throw new BadRequestException('Join request not found');
    }

    // Remove from joinRequests
    team.joinRequests = team.joinRequests.filter(r => r.toString() !== requestId);
    await team.save();

    return {
      success: true,
      message: 'Join request rejected successfully',
    };
  }
}
