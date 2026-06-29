import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type StoryDocument = HydratedDocument<Story>;

@Schema({
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Story {
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  user_id: Types.ObjectId;

  @Prop({ required: true, trim: true })
  mediaUrl: string;

  @Prop({ default: 'image', trim: true })
  mediaType?: string; // 'image' | 'video'

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'User' }],
    default: [],
  })
  views: Types.ObjectId[];

  @Prop({ default: false, index: true })
  is_deleted?: boolean;

  created_at: Date;
  updated_at: Date;
}

export const StorySchema = SchemaFactory.createForClass(Story);
StorySchema.index({ created_at: -1 });
