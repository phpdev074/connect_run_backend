import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type RunLocationDocument = RunLocation & Document;

@Schema({ timestamps: true })
export class RunLocation {
  @Prop({ type: Types.ObjectId, ref: 'Run', required: true, index: true })
  runId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true,
    },
  })
  location: {
    type: 'Point';
    coordinates: [number, number];
  };

  @Prop({ required: true })
  timestamp: Date;
}

export const RunLocationSchema = SchemaFactory.createForClass(RunLocation);

RunLocationSchema.index({ runId: 1, timestamp: 1 });
RunLocationSchema.index({ location: '2dsphere' });