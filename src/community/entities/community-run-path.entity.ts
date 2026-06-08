import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type CommunityRunPathDocument = CommunityRunPath & Document;

@Schema({ timestamps: true })
export class CommunityRunPath {
  @Prop({ type: Types.ObjectId, ref: 'CommunityRun', required: true, index: true })
  communityRunId: Types.ObjectId;

  @Prop({
    type: [{ latitude: Number, longitude: Number }],
    required: true,
    default: [],
  })
  gpsTrack: { latitude: number; longitude: number }[];
}

export const CommunityRunPathSchema = SchemaFactory.createForClass(CommunityRunPath);
