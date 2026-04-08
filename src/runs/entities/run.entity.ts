import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type RunDocument = Run & Document;

@Schema({ timestamps: true })
export class Run {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Mission' })
  missionId?: Types.ObjectId;

  @Prop({ required: true })
  distance: number;

  @Prop({ required: true })
  pace: string;

  @Prop({ required: true })
  duration: string;

  @Prop({ required: true })
  calories: number;

  @Prop({ default: 0 })
  pointsEarned: number;

  @Prop()
  healthFeeling?: string; // Feeling great, A little tired, Something hurts

  @Prop({
    type: [{ latitude: Number, longitude: Number }],
    default: [],
  })
  gpsTrack: { latitude: number; longitude: number }[];

  @Prop({ default: Date.now })
  date: Date;
}

export const RunSchema = SchemaFactory.createForClass(Run);
