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

  @Prop({ required: true })
  date: Date;

  @Prop({ default: 'pending', enum: ['pending', 'completed', 'missed'] })
  status: string;
}

export const MissionSchema = SchemaFactory.createForClass(Mission);
