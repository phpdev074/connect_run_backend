import { Injectable, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chat, ChatDocument } from './entities/chat.entity';
import { Message, MessageDocument } from './entities/message.entity';
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
    private readonly jwtService: JwtService,
    private readonly matchesService: MatchesService,
    private readonly firebaseService: FirebaseService,
    private readonly userService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) { }

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
    return matches.some(match => match.users.some(u => u._id.toString() === targetId));
  }

  async createChat(creatorId: string, participantIds: string[], groupName?: string) {
    // For single chat, check if matched (if only 2 participants)
    if (participantIds.length === 2) {
      const [userA, userB] = participantIds;
      const canChat = await this.canUsersChat(userA, userB);
      if (!canChat) throw new ForbiddenException('You can only chat with matched users');
    }
    const objectIds = participantIds.map(id => new Types.ObjectId(id));
    // Check if chat already exists (for single chat)
    let chat;
    if (participantIds.length === 2) {
      chat = await this.chatModel.findOne({ participants: { $all: objectIds, $size: 2 } });
    }
    if (!chat) {
      chat = await this.chatModel.create({
        participants: objectIds,
        isLocked: participantIds.length === 2, // Lock only for single chat
        lastActivity: new Date(),
        ...(groupName ? { groupName } : {}),
      });
    }
    return chat.populate('participants', 'first_name last_name display_name image');
  }

  async getChat(chatId: string, userId: string) {
    const chat = await this.chatModel.findById(chatId).populate('participants', 'first_name last_name image');
    if (!chat) throw new NotFoundException('Chat not found');
    if (!chat.participants.some(p => p['_id'].toString() === userId)) {
      throw new ForbiddenException('You are not a participant in this chat');
    }
    return chat;
  }

  async getMessages(chatId: string, userId: string) {
    const chat = await this.chatModel.findById(chatId);
    if (!chat) throw new NotFoundException('Chat not found');
    if (chat.isLocked) {
      // Logic to check if condition met (e.g. first run together)
    }
    return this.messageModel.find({
      chatId: new Types.ObjectId(chatId),
      isDeleted: { $ne: true },
      deletedFor: { $ne: new Types.ObjectId(userId) }
    }).sort({ createdAt: 1 });
  }

  async sendMessage(userId: string, chatId: string, content: string = 'text', type: string = 'text', metadata?: any) {
    const chat = await this.chatModel.findById(chatId);

    if (!chat) throw new NotFoundException('Chat not found');
    if (!chat.participants.some(p => p.toString() === userId)) {
      throw new ForbiddenException('You are not a participant in this chat');
    }
    // if (chat.isLocked && type !== 'invite') {
    //   throw new ForbiddenException('Chat is locked until your first virtual run together');
    // }

    const message = await this.messageModel.create({
      chatId: new Types.ObjectId(chatId),
      senderId: new Types.ObjectId(userId),
      content,
      type,
      metadata,
      readBy: [new Types.ObjectId(userId)],
    });

    const data = await this.chatModel.findByIdAndUpdate(chatId, {
      lastMessage: content,
      lastActivity: new Date(),
    });
    console.log('🚀 ~ ChatService ~ sendMessage ~ data:', data)
    // Send push notification to all other participants
    const recipientIds = chat.participants.filter(p => p.toString() !== userId);

    try {
      // Fetch sender info for better notification
      const sender = await this.userService.findById(userId);
      const senderName = sender?.display_name || sender?.first_name || 'Someone';

      for (const recipientId of recipientIds) {
        await this.notificationsService.sendNotification(
          recipientId.toString(),
          `New message from ${senderName}`,
          content,
          'CHAT_MESSAGE',
          JSON.stringify(data)
        );
      }
    } catch (error) {
      // Don't fail message sending if notification fails
      console.error('Error sending chat notifications:', error);
    }



    return message;
  }

  async getMyChats(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
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
                    { $not: { $in: ['$$userId', { $ifNull: ['$readBy', []] }] } },
                    { $ne: ['$isDeleted', true] },
                    { $not: { $in: ['$$userId', { $ifNull: ['$deletedFor', []] }] } },
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
                    { $not: { $in: ['$$userId', { $ifNull: ['$deletedFor', []] }] } },
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
          unreadCount: { $ifNull: [{ $arrayElemAt: ['$unreadMessages.count', 0] }, 0] },
          lastMessage: { $ifNull: [{ $arrayElemAt: ['$lastMessageDoc.content', 0] }, ''] },
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

  async update(chatId: string, updateDto: any) {
    const chat = await this.chatModel.findByIdAndUpdate(chatId, updateDto, { new: true });
    if (!chat) throw new NotFoundException('Chat not found');
    return chat;
  }

  async unlockChat(chatId: string) {
    return this.chatModel.findByIdAndUpdate(chatId, {
      isLocked: false,
      unlockConditionMet: true,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    }, { new: true });
  }

  async getUserMatches(userId: string) {
    return this.matchesService.getMatches(userId);
  }

  async markAsRead(userId: string, chatId: string) {
    await this.messageModel.updateMany(
      {
        chatId: new Types.ObjectId(chatId),
        senderId: { $ne: new Types.ObjectId(userId) },
        readBy: { $ne: new Types.ObjectId(userId) }
      },
      { $addToSet: { readBy: new Types.ObjectId(userId) } }
    );
    return { status: 'success' };
  }

  async deleteMessages(userId: string, messageIds: string[], mode: 'me' | 'everyone' = 'everyone') {
    const objectIds = messageIds.map(id => new Types.ObjectId(id));

    if (mode === 'everyone') {
      // For 'everyone', we need to verify the sender for each message.
      // Easiest is updateMany where senderId matches.
      const result = await this.messageModel.updateMany(
        {
          _id: { $in: objectIds },
          senderId: new Types.ObjectId(userId)
        },
        { $set: { isDeleted: true } }
      );
      return { status: 'success', deletedCount: result.modifiedCount, mode };
    } else {
      // mode === 'me'
      // Add user to deletedFor array for all specified messages
      const result = await this.messageModel.updateMany(
        { _id: { $in: objectIds } },
        { $addToSet: { deletedFor: new Types.ObjectId(userId) } }
      );
      return { status: 'success', deletedCount: result.modifiedCount, mode };
    }
  }
}
