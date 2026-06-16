import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CommentDocument = HydratedDocument<Comment>;

@Schema({
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Comment {
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

  @Prop({
    type: String,
    required: true,
    trim: true,
  })
  text: string;

  created_at: Date;
  updated_at: Date;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
