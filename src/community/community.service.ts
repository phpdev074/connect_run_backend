import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Community, CommunityDocument } from './entities/community.entity';
import { User, UserDocument } from '../users/entities/user.entity';
import { Match, MatchDocument } from '../matches/entities/match.entity';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { AddMembersDto } from './dto/add-members.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CommunityService {
  constructor(
    @InjectModel(Community.name) private communityModel: Model<CommunityDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Match.name) private matchModel: Model<MatchDocument>,
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
   * Create a community. Validates that all members specified are matches of the creator.
   */
  async create(userId: string, createCommunityDto: CreateCommunityDto) {
    const creatorObjectId = new Types.ObjectId(userId);
    const memberObjectIds: Types.ObjectId[] = [creatorObjectId];

    if (createCommunityDto.members && createCommunityDto.members.length > 0) {
      const matchedUserIds = await this.getMatchedUserIds(userId);

      for (const memberId of createCommunityDto.members) {
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

    const community = await this.communityModel.create({
      ...createCommunityDto,
      createdBy: creatorObjectId,
      members: uniqueMembers,
    });

    // Send notifications to added members (excluding the creator)
    if (createCommunityDto.members && createCommunityDto.members.length > 0) {
      try {
        const creator = await this.userModel.findById(userId);
        const creatorName = creator?.display_name || creator?.first_name || 'Someone';

        for (const memberId of createCommunityDto.members) {
          await this.notificationsService.sendAndSave(
            memberId,
            'Added to a Community!',
            `You were added to the community "${community.name}" by ${creatorName}!`,
            'COMMUNITY_ADDED',
            { communityId: community._id.toString() }
          );
        }
      } catch (error) {
        console.error('Failed to send community creation notifications:', error);
      }
    }

    return this.findOne(community._id.toString());
  }

  /**
   * Find all communities created by other users.
   */
  async findAllExceptOwn(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    return this.communityModel
      .find({
        createdBy: { $ne: userObjectId },
        members: { $ne: userObjectId },
      })
      .populate('createdBy', 'first_name last_name display_name email image')
      .populate('members', 'first_name last_name display_name email image');
  }

  /**
   * Find other users' communities that the logged-in user has joined (is a member of).
   */
  async findJoinedOthers(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    return this.communityModel
      .find({
        createdBy: { $ne: userObjectId },
        members: userObjectId,
      })
      .populate('createdBy', 'first_name last_name display_name email image')
      .populate('members', 'first_name last_name display_name email image');
  }

  /**
   * Find all communities created by the logged-in user.
   */
  async findOwn(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    return this.communityModel
      .find({
        createdBy: userObjectId,
      })
      .populate('createdBy', 'first_name last_name display_name email image')
      .populate('members', 'first_name last_name display_name email image');
  }

  /**
   * Get details of a single community.
   */
  async findOne(id: string) {
    const community = await this.communityModel
      .findById(id)
      .populate('createdBy', 'first_name last_name display_name email image')
      .populate('members', 'first_name last_name display_name email image');

    if (!community) {
      throw new NotFoundException('Community not found');
    }
    return community;
  }

  /**
   * Update a community. Restricts editing to the creator and validates added members.
   */
  async update(userId: string, id: string, updateCommunityDto: UpdateCommunityDto) {
    const community = await this.communityModel.findById(id);
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    if (community.createdBy.toString() !== userId) {
      throw new ForbiddenException('Only the creator can edit this community');
    }

    const newlyAddedMembers: string[] = [];

    if (updateCommunityDto.members) {
      const creatorObjectId = new Types.ObjectId(userId);
      const memberObjectIds: Types.ObjectId[] = [creatorObjectId];
      const matchedUserIds = await this.getMatchedUserIds(userId);
      const currentMemberStrIds = community.members.map((m) => m.toString());

      for (const memberId of updateCommunityDto.members) {
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
      community.members = uniqueMembers;
    }

    if (updateCommunityDto.name !== undefined) community.name = updateCommunityDto.name;
    if (updateCommunityDto.description !== undefined) community.description = updateCommunityDto.description;
    if (updateCommunityDto.image !== undefined) community.image = updateCommunityDto.image;

    await community.save();

    // Send notifications to newly added members
    if (newlyAddedMembers.length > 0) {
      try {
        const creator = await this.userModel.findById(userId);
        const creatorName = creator?.display_name || creator?.first_name || 'Someone';

        for (const memberId of newlyAddedMembers) {
          await this.notificationsService.sendAndSave(
            memberId,
            'Added to a Community!',
            `You were added to the community "${community.name}" by ${creatorName}!`,
            'COMMUNITY_ADDED',
            { communityId: community._id.toString() }
          );
        }
      } catch (error) {
        console.error('Failed to send community member update notifications:', error);
      }
    }

    return this.findOne(id);
  }

  /**
   * Delete community. Restricts deletion to the creator.
   */
  async delete(userId: string, id: string) {
    const community = await this.communityModel.findById(id);
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    if (community.createdBy.toString() !== userId) {
      throw new ForbiddenException('Only the creator can delete this community');
    }

    await this.communityModel.findByIdAndDelete(id);
    return { deleted: true };
  }

  /**
   * Add members to an existing community. Validates that added members are matches.
   */
  async addMembers(userId: string, id: string, addMembersDto: AddMembersDto) {
    const community = await this.communityModel.findById(id);
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    if (community.createdBy.toString() !== userId) {
      throw new ForbiddenException('Only the creator can add members to this community');
    }

    const matchedUserIds = await this.getMatchedUserIds(userId);
    const currentMemberStrIds = community.members.map((m) => m.toString());
    const newlyAddedMembers: string[] = [];

    for (const memberId of addMembersDto.members) {
      if (!matchedUserIds.includes(memberId)) {
        throw new BadRequestException(`User ${memberId} is not matched with you. You can only add matches.`);
      }
      if (!currentMemberStrIds.includes(memberId)) {
        community.members.push(new Types.ObjectId(memberId));
        newlyAddedMembers.push(memberId);
      }
    }

    await community.save();

    // Send notifications to newly added members
    if (newlyAddedMembers.length > 0) {
      try {
        const creator = await this.userModel.findById(userId);
        const creatorName = creator?.display_name || creator?.first_name || 'Someone';

        for (const memberId of newlyAddedMembers) {
          await this.notificationsService.sendAndSave(
            memberId,
            'Added to a Community!',
            `You were added to the community "${community.name}" by ${creatorName}!`,
            'COMMUNITY_ADDED',
            { communityId: community._id.toString() }
          );
        }
      } catch (error) {
        console.error('Failed to send community addMembers notifications:', error);
      }
    }

    return this.findOne(id);
  }

  /**
   * Leave a community. Restricts creator from leaving and ensures the user is a member.
   */
  async leave(userId: string, id: string) {
    const community = await this.communityModel.findById(id);
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    if (community.createdBy.toString() === userId) {
      throw new BadRequestException('As the creator, you cannot leave this community. Please delete it instead.');
    }

    const memberIndex = community.members.findIndex((m) => m.toString() === userId);
    if (memberIndex === -1) {
      throw new BadRequestException('You are not a member of this community');
    }

    community.members.splice(memberIndex, 1);
    await community.save();

    return {
      success: true,
      message: 'Successfully left the community',
    };
  }

  /**
   * Join a community.
   */
  async join(userId: string, id: string) {
    const community = await this.communityModel.findById(id);
    if (!community) {
      throw new NotFoundException('Community not found');
    }

    const memberIndex = community.members.findIndex((m) => m.toString() === userId);
    if (memberIndex !== -1) {
      throw new BadRequestException('You are already a member of this community');
    }

    community.members.push(new Types.ObjectId(userId));
    await community.save();

    return {
      success: true,
      message: 'Successfully joined the community',
    };
  }
}
