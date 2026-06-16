import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LikeDocument = HydratedDocument<Like>;

@Schema({
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Like {
  @Prop({
    type: Types.ObjectId,
    ref: 'Post',
    required: true,
    index: true,
  })
  post_id: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  user_id: Types.ObjectId;

  created_at: Date;
  updated_at: Date;
}

export const LikeSchema = SchemaFactory.createForClass(Like);
LikeSchema.index({ post_id: 1, user_id: 1 }, { unique: true });
