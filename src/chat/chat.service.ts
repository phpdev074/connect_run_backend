import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chat, ChatDocument } from './entities/chat.entity';
import { Message, MessageDocument } from './entities/message.entity';
import { Group, GroupDocument } from '../group/entities/group.entity';
import { Team, TeamDocument } from '../teams/entities/team.entity';
import { Race, RaceDocument } from '../race/entities/race.entity';
import { MatchesService } from '../matches/matches.service';
import { FirebaseService } from '../utils/firebase.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(Team.name) private teamModel: Model<TeamDocument>,
    @InjectModel(Race.name) private raceModel: Model<RaceDocument>,
    private readonly jwtService: JwtService,
    private readonly matchesService: MatchesService,
    private readonly firebaseService: FirebaseService,
    private readonly userService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // JWT
  async verifyToken(token: string) {
    try {
      const tokenData = await this.jwtService.verifyAsync(token);
      return tokenData;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException({
          message: 'TOKEN_EXPIRED',
          expiredAt: error.expiredAt,
        });
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException({
          message: 'TOKEN_EXPIRED',
        });
      }
      throw new UnauthorizedException({
        message: 'INVALID_TOKEN',
      });
    }
  }

  async canUsersChat(userId: string, targetId: string): Promise<boolean> {
    // Check if users are matched
    const matches = await this.matchesService.getMatches(userId);
    return matches.some((match) =>
      match.users.some((u) => u._id.toString() === targetId),
    );
  }

  /**
   * Get or create a 1-on-1 direct chat with matched user
   */
  async getOrCreateDirectChat(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new BadRequestException('You cannot start a chat with yourself');
    }
    if (!Types.ObjectId.isValid(targetUserId)) {
      throw new BadRequestException('Invalid target user ID format');
    }

    const canChat = await this.canUsersChat(userId, targetUserId);
    if (!canChat) {
      throw new ForbiddenException('You can only chat with matched users');
    }

    const objectIds = [
      new Types.ObjectId(userId),
      new Types.ObjectId(targetUserId),
    ];
    let chat = await this.chatModel.findOne({
      participants: { $all: objectIds, $size: 2 },
      type: { $in: [null, 'direct'] },
    });

    if (!chat) {
      chat = await this.chatModel.create({
        participants: objectIds,
        isLocked: true,
        lastActivity: new Date(),
        type: 'direct',
      });
    }

    return chat.populate(
      'participants',
      'first_name last_name display_name image profile_galary isOnline lastSeen',
    );
  }

  /**
   * Get or create a Group chat by Group ID
   */
  async getOrCreateGroupChat(groupId: string, userId: string) {
    if (!Types.ObjectId.isValid(groupId)) {
      throw new BadRequestException('Invalid group ID format');
    }
    const groupObjectId = new Types.ObjectId(groupId);

    const group = await this.groupModel.findById(groupObjectId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const isMember =
      group.members?.some((m) => m.toString() === userId) ||
      group.createdBy?.toString() === userId;

    if (!isMember) {
      throw new ForbiddenException('You are not a member of this group');
    }

    // Include creator and all members
    const memberIds = Array.from(
      new Set(
        [
          group.createdBy?.toString(),
          ...(group.members || []).map((m) => m.toString()),
        ].filter(Boolean),
      ),
    ).map((id) => new Types.ObjectId(id));

    let chat = await this.chatModel.findOne({
      referenceId: groupObjectId,
      type: 'group',
    });

    if (!chat) {
      chat = await this.chatModel.create({
        participants: memberIds,
        isLocked: false,
        lastActivity: new Date(),
        groupName: group.name,
        groupImage: group.image,
        type: 'group',
        referenceId: groupObjectId,
      });
    } else {
      // Sync members and group details if needed
      const currentParticipants = (chat.participants || []).map((p) =>
        p.toString(),
      );
      const needsMemberSync = memberIds.some(
        (m) => !currentParticipants.includes(m.toString()),
      );
      const needsUpdate =
        needsMemberSync ||
        chat.groupName !== group.name ||
        chat.groupImage !== group.image ||
        chat.isLocked;

      if (needsUpdate) {
        chat.participants = memberIds;
        chat.groupName = group.name;
        chat.groupImage = group.image;
        chat.isLocked = false;
        await chat.save();
      }
    }

    return chat.populate(
      'participants',
      'first_name last_name display_name image profile_galary isOnline lastSeen',
    );
  }

  /**
   * Get or create a Team chat by Team ID
   */
  async getOrCreateTeamChat(teamId: string, userId: string) {
    if (!Types.ObjectId.isValid(teamId)) {
      throw new BadRequestException('Invalid team ID format');
    }
    const teamObjectId = new Types.ObjectId(teamId);

    const team = await this.teamModel.findById(teamObjectId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const isMember =
      team.members?.some((m) => m.toString() === userId) ||
      team.createdBy?.toString() === userId ||
      team.captain?.toString() === userId;

    if (!isMember) {
      throw new ForbiddenException('You are not a member of this team');
    }

    // Include creator, captain and all members
    const memberIds = Array.from(
      new Set(
        [
          team.createdBy?.toString(),
          team.captain?.toString(),
          ...(team.members || []).map((m) => m.toString()),
        ].filter(Boolean),
      ),
    ).map((id) => new Types.ObjectId(id));

    let chat = await this.chatModel.findOne({
      referenceId: teamObjectId,
      type: 'team',
    });

    if (!chat) {
      chat = await this.chatModel.create({
        participants: memberIds,
        isLocked: false,
        lastActivity: new Date(),
        groupName: team.name,
        groupImage: team.image,
        type: 'team',
        referenceId: teamObjectId,
      });
    } else {
      // Sync members and team details if needed
      const currentParticipants = (chat.participants || []).map((p) =>
        p.toString(),
      );
      const needsMemberSync = memberIds.some(
        (m) => !currentParticipants.includes(m.toString()),
      );
      const needsUpdate =
        needsMemberSync ||
        chat.groupName !== team.name ||
        chat.groupImage !== team.image ||
        chat.isLocked;

      if (needsUpdate) {
        chat.participants = memberIds;
        chat.groupName = team.name;
        chat.groupImage = team.image;
        chat.isLocked = false;
        await chat.save();
      }
    }

    return chat.populate(
      'participants',
      'first_name last_name display_name image profile_galary isOnline lastSeen',
    );
  }

  /**
   * Get or create a Race chat by Race ID
   */
  async getOrCreateRaceChat(raceId: string, userId: string) {
    if (!Types.ObjectId.isValid(raceId)) {
      throw new BadRequestException('Invalid race ID format');
    }
    const raceObjectId = new Types.ObjectId(raceId);

    const race = await this.raceModel.findById(raceObjectId);
    if (!race || !race.isActive) {
      throw new NotFoundException('Race not found');
    }

    const isParticipant =
      race.participants?.some((p) => p.toString() === userId) ||
      race.userId?.toString() === userId;

    if (!isParticipant) {
      throw new ForbiddenException('You are not registered for this race');
    }

    // Include organizer and all participants
    const memberIds = Array.from(
      new Set(
        [
          race.userId?.toString(),
          ...(race.participants || []).map((p) => p.toString()),
        ].filter(Boolean),
      ),
    ).map((id) => new Types.ObjectId(id));

    let chat = await this.chatModel.findOne({
      referenceId: raceObjectId,
      type: 'race',
    });

    if (!chat) {
      chat = await this.chatModel.create({
        participants: memberIds,
        isLocked: false,
        lastActivity: new Date(),
        groupName: race.name,
        groupImage: race.bannerImage,
        type: 'race',
        referenceId: raceObjectId,
      });
    } else {
      // Sync participants and race details if needed
      const currentParticipants = (chat.participants || []).map((p) =>
        p.toString(),
      );
      const needsMemberSync = memberIds.some(
        (m) => !currentParticipants.includes(m.toString()),
      );
      const needsUpdate =
        needsMemberSync ||
        chat.groupName !== race.name ||
        chat.groupImage !== race.bannerImage ||
        chat.isLocked;

      if (needsUpdate) {
        chat.participants = memberIds;
        chat.groupName = race.name;
        chat.groupImage = race.bannerImage;
        chat.isLocked = false;
        await chat.save();
      }
    }

    return chat.populate(
      'participants',
      'first_name last_name display_name image profile_galary isOnline lastSeen',
    );
  }

  /**
   * Universal Create/Start chat method
   */
  async createChat(
    creatorId: string,
    participantIds?: string[],
    groupName?: string,
    type?: string,
    referenceId?: string,
    groupImage?: string,
    groupId?: string,
    teamId?: string,
    targetUserId?: string,
    raceId?: string,
  ) {
    // Check if race chat requested via raceId or type === 'race'
    const finalRaceId = raceId || (type === 'race' ? referenceId : undefined);
    if (finalRaceId) {
      return this.getOrCreateRaceChat(finalRaceId, creatorId);
    }

    // Check if group chat requested via groupId or type === 'group'
    const finalGroupId =
      groupId || (type === 'group' ? referenceId : undefined);
    if (finalGroupId) {
      return this.getOrCreateGroupChat(finalGroupId, creatorId);
    }

    // Check if team chat requested via teamId or type === 'team'
    const finalTeamId = teamId || (type === 'team' ? referenceId : undefined);
    if (finalTeamId) {
      return this.getOrCreateTeamChat(finalTeamId, creatorId);
    }

    // Check if direct chat requested via targetUserId
    if (targetUserId) {
      return this.getOrCreateDirectChat(creatorId, targetUserId);
    }

    // Fallback to participantIds
    const participants = participantIds || [];
    if (participants.length === 2 && (!type || type === 'direct')) {
      const targetId =
        participants.find((id) => id !== creatorId) || participants[1];
      return this.getOrCreateDirectChat(creatorId, targetId);
    }

    if (referenceId) {
      const chat = await this.chatModel.findOne({
        referenceId: new Types.ObjectId(referenceId),
      });
      if (chat) {
        return chat.populate(
          'participants',
          'first_name last_name display_name image profile_galary isOnline lastSeen',
        );
      }
    }

    const allParticipantIds = Array.from(new Set([creatorId, ...participants]));
    const objectIds = allParticipantIds.map((id) => new Types.ObjectId(id));

    const chat = await this.chatModel.create({
      participants: objectIds,
      isLocked: objectIds.length === 2 && (!type || type === 'direct'),
      lastActivity: new Date(),
      ...(groupName ? { groupName } : {}),
      ...(groupImage ? { groupImage } : {}),
      type: type || (objectIds.length > 2 ? 'group' : 'direct'),
      referenceId: referenceId ? new Types.ObjectId(referenceId) : null,
    });

    return chat.populate(
      'participants',
      'first_name last_name display_name image profile_galary isOnline lastSeen',
    );
  }

  /**
   * Shared access check: verifies the user is a participant of the chat.
   * Self-heals group/team/race chats by re-checking the source entity
   * membership and auto-adding the user to participants if they belong.
   * Throws NotFoundException / ForbiddenException.
   */
  private async ensureChatAccess(chatId: string, userId: string) {
    if (!Types.ObjectId.isValid(chatId)) {
      throw new BadRequestException(`Invalid chat ID format: "${chatId}"`);
    }
    const chat = await this.chatModel.findById(chatId);
    if (!chat) {
      throw new NotFoundException(`Chat not found for chatId: "${chatId}"`);
    }

    const isParticipant = chat.participants.some(
      (p) => p.toString() === userId,
    );
    if (isParticipant) return chat;

    let isMember = false;

    if (chat.type === 'group' && chat.referenceId) {
      const group = await this.groupModel.findById(chat.referenceId);
      isMember =
        !!group &&
        (group.members?.some((m) => m.toString() === userId) ||
          group.createdBy?.toString() === userId);
    } else if (chat.type === 'team' && chat.referenceId) {
      const team = await this.teamModel.findById(chat.referenceId);
      isMember =
        !!team &&
        (team.members?.some((m) => m.toString() === userId) ||
          team.createdBy?.toString() === userId ||
          team.captain?.toString() === userId);
    } else if (chat.type === 'race' && chat.referenceId) {
      const race = await this.raceModel.findById(chat.referenceId);
      isMember =
        !!race &&
        (race.participants?.some((p) => p.toString() === userId) ||
          race.userId?.toString() === userId);
    }

    if (isMember) {
      await this.chatModel.findByIdAndUpdate(chatId, {
        $addToSet: { participants: new Types.ObjectId(userId) },
      });
      chat.participants.push(new Types.ObjectId(userId));
      return chat;
    }

    throw new ForbiddenException('You are not a participant in this chat');
  }

  async getChat(chatId: string, userId: string) {
    await this.ensureChatAccess(chatId, userId);

    return this.chatModel
      .findById(chatId)
      .populate(
        'participants',
        'first_name last_name display_name image profile_galary isOnline lastSeen',
      );
  }

  async getMessages(chatId: string, userId: string) {
    await this.ensureChatAccess(chatId, userId);

    return this.messageModel
      .find({
        chatId: new Types.ObjectId(chatId),
        isDeleted: { $ne: true },
        deletedFor: { $ne: new Types.ObjectId(userId) },
      })
      .sort({ createdAt: 1 })
      .populate('senderId', 'first_name last_name display_name image');
  }

  async sendMessage(
    userId: string,
    chatId: string,
    content: string = 'text',
    type: string = 'text',
    metadata?: any,
  ) {
    const chat = await this.ensureChatAccess(chatId, userId);

    const message = await this.messageModel.create({
      chatId: new Types.ObjectId(chatId),
      senderId: new Types.ObjectId(userId),
      content,
      type,
      metadata,
      readBy: [new Types.ObjectId(userId)],
    });

    let notificationBody = content;
    if (type === 'image') notificationBody = '📷 Image';
    else if (type === 'video') notificationBody = '🎥 Video';

    const data = await this.chatModel.findByIdAndUpdate(
      chatId,
      {
        lastMessage: notificationBody,
        lastActivity: new Date(),
      },
      { new: true },
    );

    await message.populate(
      'senderId',
      'first_name last_name display_name image',
    );

    console.log('🚀 ~ ChatService ~ sendMessage ~ data:', data);
    console.log('\n--------------------------------------------------');
    console.log(
      `[MESSAGE LOG] Sent by: ${userId} | Type: ${type} | Preview: ${notificationBody}`,
    );
    console.log('--------------------------------------------------\n');

    // Send push notification to all other participants
    const recipientIds = chat.participants.filter(
      (p) => p.toString() !== userId,
    );

    try {
      const sender = await this.userService.findById(userId);
      const senderName =
        sender?.display_name || sender?.first_name || 'Someone';

      let notifTitle = `New message from ${senderName}`;
      if (chat.type === 'group') {
        notifTitle = `${senderName} in ${chat.groupName || 'Group'}`;
      } else if (chat.type === 'team') {
        notifTitle = `${senderName} in ${chat.groupName || 'Team'}`;
      } else if (chat.type === 'race') {
        notifTitle = `${senderName} in ${chat.groupName || 'Race'}`;
      }

      for (const recipientId of recipientIds) {
        await this.notificationsService.sendNotification(
          recipientId.toString(),
          notifTitle,
          notificationBody,
          'CHAT_MESSAGE',
          JSON.stringify(data),
        );
      }
    } catch (error) {
      console.error('Error sending chat notifications:', error);
    }

    return message;
  }

  async getMyChats(userId: string) {
    const userObjectId = new Types.ObjectId(userId);

    // Auto-sync: find groups, teams, and races where user is a member
    // and ensure chat documents exist with user in participants
    try {
      const [userGroups, userTeams, userRaces] = await Promise.all([
        this.groupModel
          .find({ members: userObjectId }, '_id name image members createdBy')
          .lean(),
        this.teamModel
          .find(
            { members: userObjectId },
            '_id name image members createdBy captain',
          )
          .lean(),
        this.raceModel
          .find(
            {
              $or: [{ participants: userObjectId }, { userId: userObjectId }],
              isActive: true,
            },
            '_id name bannerImage participants userId',
          )
          .lean(),
      ]);

      for (const group of userGroups) {
        const groupMembers = Array.from(
          new Set(
            [
              group.createdBy?.toString(),
              ...(group.members || []).map((m) => m.toString()),
            ].filter(Boolean),
          ),
        ).map((id) => new Types.ObjectId(id));

        await this.chatModel.updateOne(
          { referenceId: group._id, type: 'group' },
          {
            $setOnInsert: {
              lastActivity: new Date(),
              isLocked: false,
            },
            $set: {
              groupName: group.name,
              groupImage: group.image,
            },
            $addToSet: { participants: { $each: groupMembers } },
          },
          { upsert: true },
        );
      }

      for (const team of userTeams) {
        const teamMembers = Array.from(
          new Set(
            [
              team.createdBy?.toString(),
              team.captain?.toString(),
              ...(team.members || []).map((m) => m.toString()),
            ].filter(Boolean),
          ),
        ).map((id) => new Types.ObjectId(id));

        await this.chatModel.updateOne(
          { referenceId: team._id, type: 'team' },
          {
            $setOnInsert: {
              lastActivity: new Date(),
              isLocked: false,
            },
            $set: {
              groupName: team.name,
              groupImage: team.image,
            },
            $addToSet: { participants: { $each: teamMembers } },
          },
          { upsert: true },
        );
      }

      for (const race of userRaces) {
        const raceMembers = Array.from(
          new Set(
            [
              race.userId?.toString(),
              ...(race.participants || []).map((m) => m.toString()),
            ].filter(Boolean),
          ),
        ).map((id) => new Types.ObjectId(id));

        await this.chatModel.updateOne(
          { referenceId: race._id, type: 'race' },
          {
            $setOnInsert: {
              lastActivity: new Date(),
              isLocked: false,
            },
            $set: {
              groupName: race.name,
              groupImage: race.bannerImage,
            },
            $addToSet: { participants: { $each: raceMembers } },
          },
          { upsert: true },
        );
      }
    } catch (err) {
      console.error('Error syncing group/team/race chats in getMyChats:', err);
    }

    return this.chatModel.aggregate([
      {
        $match: {
          participants: userObjectId,
        },
      },
      {
        $lookup: {
          from: 'messages',
          let: { chatId: '$_id', userId: userObjectId },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$chatId', '$$chatId'] },
                    { $ne: ['$senderId', '$$userId'] },
                    {
                      $not: { $in: ['$$userId', { $ifNull: ['$readBy', []] }] },
                    },
                    { $ne: ['$isDeleted', true] },
                    {
                      $not: {
                        $in: ['$$userId', { $ifNull: ['$deletedFor', []] }],
                      },
                    },
                  ],
                },
              },
            },
            { $count: 'count' },
          ],
          as: 'unreadMessages',
        },
      },
      {
        $lookup: {
          from: 'messages',
          let: { chatId: '$_id', userId: userObjectId },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$chatId', '$$chatId'] },
                    { $ne: ['$isDeleted', true] },
                    {
                      $not: {
                        $in: ['$$userId', { $ifNull: ['$deletedFor', []] }],
                      },
                    },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: 'lastMessageDoc',
        },
      },
      {
        $addFields: {
          unreadCount: {
            $ifNull: [{ $arrayElemAt: ['$unreadMessages.count', 0] }, 0],
          },
          lastMessage: {
            $cond: {
              if: { $gt: [{ $size: '$lastMessageDoc' }, 0] },
              then: {
                $let: {
                  vars: { lastDoc: { $arrayElemAt: ['$lastMessageDoc', 0] } },
                  in: {
                    $cond: {
                      if: {
                        $eq: [{ $ifNull: ['$$lastDoc.type', 'text'] }, 'image'],
                      },
                      then: '📷 Image',
                      else: {
                        $cond: {
                          if: {
                            $eq: [
                              { $ifNull: ['$$lastDoc.type', 'text'] },
                              'video',
                            ],
                          },
                          then: '🎥 Video',
                          else: { $ifNull: ['$$lastDoc.content', ''] },
                        },
                      },
                    },
                  },
                },
              },
              else: { $ifNull: ['$lastMessage', ''] },
            },
          },
        },
      },
      {
        $project: {
          unreadMessages: 0,
          lastMessageDoc: 0,
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'participants',
          foreignField: '_id',
          as: 'participants',
        },
      },
      {
        $addFields: {
          participants: {
            $map: {
              input: '$participants',
              as: 'p',
              in: {
                _id: '$$p._id',
                first_name: '$$p.first_name',
                last_name: '$$p.last_name',
                display_name: '$$p.display_name',
                image: '$$p.image',
                profile_galary: '$$p.profile_galary',
                isOnline: '$$p.isOnline',
                lastSeen: '$$p.lastSeen',
              },
            },
          },
        },
      },
      { $sort: { lastActivity: -1 } },
    ]);
  }

  async update(chatId: string, userId: string, updateDto: any) {
    await this.ensureChatAccess(chatId, userId);

    return this.chatModel.findByIdAndUpdate(chatId, updateDto, {
      new: true,
    });
  }

  async unlockChat(chatId: string) {
    return this.chatModel.findByIdAndUpdate(
      chatId,
      {
        isLocked: false,
        unlockConditionMet: true,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
      { new: true },
    );
  }

  async getUserMatches(userId: string) {
    return this.matchesService.getMatches(userId);
  }

  async markAsRead(userId: string, chatId: string) {
    await this.messageModel.updateMany(
      {
        chatId: new Types.ObjectId(chatId),
        senderId: { $ne: new Types.ObjectId(userId) },
        readBy: { $ne: new Types.ObjectId(userId) },
      },
      { $addToSet: { readBy: new Types.ObjectId(userId) } },
    );
    return { status: 'success' };
  }

  async deleteMessages(
    userId: string,
    messageIds: string[],
    mode: 'me' | 'everyone' = 'everyone',
  ) {
    const objectIds = messageIds.map((id) => new Types.ObjectId(id));

    if (mode === 'everyone') {
      const result = await this.messageModel.updateMany(
        {
          _id: { $in: objectIds },
          senderId: new Types.ObjectId(userId),
        },
        { $set: { isDeleted: true } },
      );
      return { status: 'success', deletedCount: result.modifiedCount, mode };
    } else {
      const result = await this.messageModel.updateMany(
        { _id: { $in: objectIds } },
        { $addToSet: { deletedFor: new Types.ObjectId(userId) } },
      );
      return { status: 'success', deletedCount: result.modifiedCount, mode };
    }
  }
}
