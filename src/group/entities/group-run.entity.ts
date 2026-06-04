import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type GroupRunDocument = GroupRun & Document;

@Schema({ timestamps: true })
export class GroupRun {
  @Prop({ type: Types.ObjectId, ref: 'Group', required: true })
  groupId: Types.ObjectId;

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

  @Prop({ default: 'upcoming', enum: ['upcoming', 'completed'] })
  status: string;
}

export const GroupRunSchema = SchemaFactory.createForClass(GroupRun);
