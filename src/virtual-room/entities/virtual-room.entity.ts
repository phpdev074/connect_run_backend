import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type VirtualRoomDocument = VirtualRoom & Document;

@Schema({ timestamps: true })
export class VirtualRoom {
  @Prop({ type: Types.ObjectId, ref: 'Chat' })
  chatId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Mission' })
  missionId?: Types.ObjectId;

  @Prop({ default: 'Dating', enum: ['Dating', 'Group'] })
  type: string;

  @Prop({
    type: [{
      userId: { type: Types.ObjectId, ref: 'User' },
      status: { type: String, default: 'joined' }, // joined, running, finished
      stats: {
        distance: { type: Number, default: 0 },
        pace: { type: String, default: '0:00' },
      }
    }],
    default: [],
  })
  participants: any[];

  @Prop({ default: Date.now })
  startTime: Date;

  @Prop()
  endTime?: Date;
}

export const VirtualRoomSchema = SchemaFactory.createForClass(VirtualRoom);
