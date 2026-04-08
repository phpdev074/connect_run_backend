import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PointTransaction, PointTransactionDocument } from './entities/point-transaction.entity';
import { User, UserDocument } from '../users/entities/user.entity';

@Injectable()
export class RewardsService {
  constructor(
    @InjectModel(PointTransaction.name) private transactionModel: Model<PointTransactionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async getBalance(userId: string) {
    const user = await this.userModel.findById(userId).select('points');
    return user ? user.points : 0;
  }

  async getHistory(userId: string) {
    return this.transactionModel.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 });
  }

  async addPoints(userId: string, amount: number, description: string, relatedId?: string, onModel?: string) {
    const transaction = await this.transactionModel.create({
      userId: new Types.ObjectId(userId),
      amount,
      type: 'earned',
      description,
      relatedId: relatedId ? new Types.ObjectId(relatedId) : undefined,
      onModel,
    });

    await this.userModel.findByIdAndUpdate(userId, { $inc: { points: amount } });
    return transaction;
  }

  async redeemPoints(userId: string, amount: number, description: string) {
    const user = await this.userModel.findById(userId);
    if (!user || user.points < amount) {
      throw new BadRequestException('Insufficient points');
    }

    const transaction = await this.transactionModel.create({
      userId: new Types.ObjectId(userId),
      amount: -amount,
      type: 'redeemed',
      description,
    });

    await this.userModel.findByIdAndUpdate(userId, { $inc: { points: -amount } });
    return transaction;
  }

  async redeemBoost(userId: string, boostType: string) {
    const boosts = {
      'Profile Boost': 5,
      'Super Like': 5,
    };

    const cost = boosts[boostType];
    if (cost === undefined) throw new BadRequestException('Invalid boost type');

    return this.redeemPoints(userId, cost, `Redeemed ${boostType}`);
  }

  async sendGift(userId: string, targetId: string, giftType: string) {
    const gifts = {
      'Rose': 2,
      'Card': 2,
    };

    const cost = gifts[giftType];
    if (cost === undefined) throw new BadRequestException('Invalid gift type');

    // In a real app, we'd also notify the target user and maybe create a Gift entity
    return this.redeemPoints(userId, cost, `Sent ${giftType} to user ${targetId}`);
  }

  async donate(userId: string, charityName: string, miles: number) {
    // UI says "Donate a Mile" is "0 pts - free" (meaning it uses miles, not points, or just a free action)
    // Let's assume it's free for now as per UI "0 pts - free"
    return this.transactionModel.create({
      userId: new Types.ObjectId(userId),
      amount: 0,
      type: 'redeemed',
      description: `Donated ${miles} mile(s) to ${charityName}`,
    });
  }
}
