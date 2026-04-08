import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Reel, ReelDocument } from './entities/reel.entity';
import { CreateReelDto } from './dto/create-reel.dto';

@Injectable()
export class ReelsService {
  constructor(
    @InjectModel(Reel.name) private reelModel: Model<ReelDocument>,
  ) {}

  async create(userId: string, createReelDto: CreateReelDto) {
    const reel = new this.reelModel({
      userId: new Types.ObjectId(userId),
      ...createReelDto,
    });
    return reel.save();
  }

  async findAll() {
    return this.reelModel
      .find()
      .populate('userId', 'first_name last_name display_name image')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByUserId(userId: string) {
    return this.reelModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async like(userId: string, reelId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const reel = await this.reelModel.findById(reelId);
    if (!reel) return null;

    const index = reel.likes.indexOf(userObjectId);
    if (index === -1) {
      reel.likes.push(userObjectId);
    } else {
      reel.likes.splice(index, 1);
    }
    return reel.save();
  }

  async addComment(userId: string, reelId: string, text: string) {
    return this.reelModel.findByIdAndUpdate(
      reelId,
      {
        $push: {
          comments: {
            userId: new Types.ObjectId(userId),
            text,
            createdAt: new Date(),
          },
        },
      },
      { new: true },
    ).populate('comments.userId', 'first_name last_name display_name image');
  }
}
