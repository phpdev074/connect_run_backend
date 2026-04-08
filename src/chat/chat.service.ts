import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chat, ChatDocument } from './entities/chat.entity';
import { Message, MessageDocument } from './entities/message.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  async createChat(userId: string, targetId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const targetObjectId = new Types.ObjectId(targetId);

    // Check if chat already exists
    let chat = await this.chatModel.findOne({
      participants: { $all: [userObjectId, targetObjectId] },
    });

    if (!chat) {
      chat = await this.chatModel.create({
        participants: [userObjectId, targetObjectId],
        isLocked: true, // Default locked until first run
        lastActivity: new Date(),
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
    return this.messageModel.find({ chatId: new Types.ObjectId(chatId) }).sort({ createdAt: 1 });
  }

  async sendMessage(userId: string, chatId: string, content: string, type: string = 'text') {
    const chat = await this.chatModel.findById(chatId);
    if (!chat) throw new NotFoundException('Chat not found');
    if (chat.isLocked && type !== 'invite') {
       throw new ForbiddenException('Chat is locked until your first virtual run together');
    }

    const message = await this.messageModel.create({
      chatId: new Types.ObjectId(chatId),
      senderId: new Types.ObjectId(userId),
      content,
      type,
    });

    await this.chatModel.findByIdAndUpdate(chatId, {
      lastMessage: content,
      lastActivity: new Date(),
    });

    return message;
  }

  async getMyChats(userId: string) {
    return this.chatModel.find({
      participants: new Types.ObjectId(userId),
    }).populate('participants', 'first_name last_name image').sort({ lastActivity: -1 });
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
}
