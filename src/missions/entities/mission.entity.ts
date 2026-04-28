import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type MissionDocument = Mission & Document;

@Schema({ timestamps: true })
export class Mission {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  type: string; // Tempo, Easy, Long, Rest

  @Prop({ required: true })
  distance: number;

  @Prop({ required: true })
  goal: number; // For progress tracking

  @Prop({ default: 0 })
  points: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  partnerId?: Types.ObjectId;

  @Prop({ enum: ['Virtual_Run', 'In_Person_Run'] })
  runType?: string;

  @Prop()
  scheduledTime?: string;

  @Prop()
  pointsRequired?: number;

  @Prop()
  message?: string;

  @Prop({ default: 'pending', enum: ['pending', 'accepted', 'declined'] })
  inviteStatus?: string;

  @Prop({ required: true })
  date: Date;

  @Prop({ default: 'pending', enum: ['pending', 'completed', 'missed'] })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'Match' })
  matchId?: Types.ObjectId;
}

export const MissionSchema = SchemaFactory.createForClass(Mission);
