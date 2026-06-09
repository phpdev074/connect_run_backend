import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type ChatDocument = Chat & Document;

@Schema({ timestamps: true })
export class Chat {
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], required: true })
  participants: Types.ObjectId[];

  @Prop({ default: true })
  isLocked: boolean;

  @Prop({ default: false })
  unlockConditionMet: boolean;

  @Prop()
  expiresAt?: Date; // 7-day renewal timer

  @Prop()
  lastMessage?: string;

  @Prop({ default: Date.now })
  lastActivity: Date;

  @Prop()
  groupName?: string;

  @Prop({ default: 'direct', enum: ['direct', 'group', 'community', 'pace'] })
  type: string;

  @Prop({ type: Types.ObjectId, default: null })
  referenceId?: Types.ObjectId;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
