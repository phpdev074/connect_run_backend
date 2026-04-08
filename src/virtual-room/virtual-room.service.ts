import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VirtualRoom, VirtualRoomDocument } from './entities/virtual-room.entity';

@Injectable()
export class VirtualRoomService {
  constructor(
    @InjectModel(VirtualRoom.name) private virtualRoomModel: Model<VirtualRoomDocument>,
  ) {}

  async createRoom(data: any) {
    return this.virtualRoomModel.create(data);
  }

  async getRoom(id: string) {
    const room = await this.virtualRoomModel.findById(id).populate('participants.userId', 'first_name last_name image');
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async updateStats(id: string, userId: string, stats: any) {
    return this.virtualRoomModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), 'participants.userId': new Types.ObjectId(userId) },
      { $set: { 'participants.$.stats': stats } },
      { new: true }
    );
  }

  async endRoom(id: string) {
    return this.virtualRoomModel.findByIdAndUpdate(id, { endTime: new Date() }, { new: true });
  }
}
