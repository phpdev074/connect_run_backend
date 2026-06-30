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

  @Prop({ required: false, trim: true })
  title?: string;

  @Prop({ default: 'image', trim: true })
  mediaType?: string; // 'image' | 'video'

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'User' }],
    default: [],
  })
  views: Types.ObjectId[];

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'User' }],
    default: [],
  })
  likes: Types.ObjectId[];

  @Prop({
    type: [{
      user_id: { type: Types.ObjectId, ref: 'User' },
      reaction: { type: String, required: true },
      created_at: { type: Date, default: Date.now },
    }],
    default: [],
  })
  reactions: { user_id: Types.ObjectId; reaction: string; created_at: Date }[];

  @Prop({
    type: [{
      user_id: { type: Types.ObjectId, ref: 'User' },
      text: { type: String, required: true },
      created_at: { type: Date, default: Date.now },
    }],
    default: [],
  })
  comments: { user_id: Types.ObjectId; text: string; created_at: Date }[];

  @Prop({ required: false })
  user_time?: Date;

  @Prop({ default: false, index: true })
  is_deleted?: boolean;

  created_at: Date;
  updated_at: Date;
}

export const StorySchema = SchemaFactory.createForClass(Story);
StorySchema.index({ created_at: -1 });
