import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type TeamDocument = Team & Document;

export type Challenge = {
  title: string;
  startDate?: string;
  endDate?: string;
  currentCount?: number;
  targetCount?: number;
  status?: 'active' | 'completed' | 'upcoming';
};

@Schema({ timestamps: true })
export class Team {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop()
  image?: string;

  @Prop()
  paceRange?: string;

  @Prop()
  maxMembers?: number;

  @Prop({ default: 'public' })
  visibility?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  captain?: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  members: Types.ObjectId[];

  @Prop({ type: Number, default: 0 })
  weeklyMiles?: number;

  @Prop({ type: Number, default: 0 })
  weeklyMilesUpdatedAt?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  invitees: Types.ObjectId[];

  @Prop({ type: String })
  joinCode?: string;

  @Prop({ type: [{ type: Object }], default: [] })
  challenges?: Challenge[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  joinRequests: Types.ObjectId[];
}

export const TeamSchema = SchemaFactory.createForClass(Team);
