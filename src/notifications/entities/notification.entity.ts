import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop({ required: true })
  type: string;

  @Prop({ type: Object })
  data: any;

  @Prop({ type: Date, default: Date.now, index: true })
  activityAt: Date;

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ default: false, index: true })
  isDeleted: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index(
  { userId: 1, type: 1, 'data.postId': 1, isDeleted: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isDeleted: false,
      'data.postId': { $exists: true },
    },
  },
);
NotificationSchema.index(
  { userId: 1, type: 1, 'data.storyId': 1, isDeleted: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isDeleted: false,
      'data.storyId': { $exists: true },
    },
  },
);
