import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type RunInviteDocument = RunInvite & Document;

@Schema({ timestamps: true })
export class RunInvite {
  @Prop({ type: Types.ObjectId, ref: 'Match', required: true })
  matchId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  senderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  receiverId: Types.ObjectId;

  @Prop({ required: true, enum: ['Virtual_Run', 'In_Person_Run'] })
  type: string;

  @Prop({ required: true })
  date: string; // e.g. "2026-03-28"

  @Prop({ required: true })
  time: string; // e.g. "8:00 AM"

  @Prop()
  route?: string; // e.g. "Riverside Loop"

  @Prop()
  location?: string; // e.g. "Central Park South Entrance"

  @Prop()
  counterProposedDate?: string;

  @Prop()
  counterProposedTime?: string;

  @Prop()
  message?: string;

  @Prop({ default: 'pending', enum: ['pending', 'accepted', 'declined', 'counter_proposed'] })
  status: string;

  @Prop({ required: true })
  pointsRequired: number;
}

export const RunInviteSchema = SchemaFactory.createForClass(RunInvite);
