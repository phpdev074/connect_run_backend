import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type ReelDocument = Reel & Document;

@Schema({ timestamps: true })
export class Reel {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  videoUrl: string;

  @Prop()
  thumbnailUrl: string;

  @Prop()
  caption: string;

  @Prop({ type: [String], default: [] })
  hashtags: string[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  likes: Types.ObjectId[];

  @Prop({
    type: [
      {
        userId: { type: Types.ObjectId, ref: 'User' },
        text: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  comments: {
    userId: Types.ObjectId;
    text: string;
    createdAt: Date;
  }[];

  @Prop()
  location?: string;

  @Prop({ default: '15-30 sec' })
  durationTag: string;
}

export const ReelSchema = SchemaFactory.createForClass(Reel);
