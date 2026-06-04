import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type PaceDocument = Pace & Document;

@Schema({ timestamps: true })
export class Pace {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop()
  runTravelPlan?: string;

  @Prop()
  meetingLocation?: string;

  @Prop()
  distance?: string;

  @Prop()
  targetPace?: string;

  @Prop({ type: Number, default: 0 })
  joinPrice: number;

  @Prop({ type: Date })
  date?: Date;

  @Prop()
  time?: string;

  @Prop({ default: 'upcoming', enum: ['upcoming', 'completed'] })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  members: Types.ObjectId[];
}

export const PaceSchema = SchemaFactory.createForClass(Pace);
