import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type CommunityRunDocument = CommunityRun & Document;

@Schema({ timestamps: true })
export class CommunityRun {
  @Prop({ type: Types.ObjectId, ref: 'Community', required: true })
  communityId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  date: Date;

  @Prop({ type: Number })
  distance?: number;

  @Prop()
  duration?: string;

  @Prop()
  pace?: string;

  @Prop()
  location?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  participants: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'CommunityRunPath', default: null })
  pathId?: Types.ObjectId;

  @Prop({ default: 'in-person', enum: ['in-person', 'virtual'] })
  runType: string;

  @Prop({ default: 'upcoming', enum: ['upcoming', 'completed'] })
  status: string;
}

export const CommunityRunSchema = SchemaFactory.createForClass(CommunityRun);
