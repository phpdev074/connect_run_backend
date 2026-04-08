import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Chat', required: true })
  chatId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ default: 'text', enum: ['text', 'image', 'invite', 'system'] })
  type: string;

  @Prop({ type: Object })
  metadata?: any; // For invite details, etc.
}

export const MessageSchema = SchemaFactory.createForClass(Message);
