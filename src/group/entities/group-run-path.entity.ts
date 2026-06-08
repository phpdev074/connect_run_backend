import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type GroupRunPathDocument = GroupRunPath & Document;

@Schema({ timestamps: true })
export class GroupRunPath {
  @Prop({ type: Types.ObjectId, ref: 'GroupRun', required: true, index: true })
  groupRunId: Types.ObjectId;

  @Prop({
    type: [{ latitude: Number, longitude: Number }],
    required: true,
    default: [],
  })
  gpsTrack: { latitude: number; longitude: number }[];
}

export const GroupRunPathSchema = SchemaFactory.createForClass(GroupRunPath);
