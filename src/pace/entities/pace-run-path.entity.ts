import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type PaceRunPathDocument = PaceRunPath & Document;

@Schema({ timestamps: true })
export class PaceRunPath {
  @Prop({ type: Types.ObjectId, ref: 'Pace', required: true, index: true })
  paceId: Types.ObjectId;

  @Prop({
    type: [{ latitude: Number, longitude: Number }],
    required: true,
    default: [],
  })
  gpsTrack: { latitude: number; longitude: number }[];
}

export const PaceRunPathSchema = SchemaFactory.createForClass(PaceRunPath);
