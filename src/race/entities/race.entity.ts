import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type RaceDocument = Race & Document;

export enum RaceType {
  IN_PERSON = 'In-Person',
  VIRTUAL = 'Virtual',
}

export enum RaceStatus {
  UPCOMING = 'upcoming',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Schema({ timestamps: true })
export class Race {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  organizer: string;

  @Prop({
    required: true,
    enum: ['In-Person', 'Virtual', 'in-person', 'virtual'],
    default: 'In-Person',
  })
  raceType: string;

  @Prop({ required: true, trim: true })
  distance: string; // e.g. "5K", "10K", "Half Marathon", "26.2 mi"

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true, trim: true })
  location: string; // e.g. "Zilker Park, Austin TX"

  @Prop({ trim: true })
  city?: string; // e.g. "Austin"

  @Prop({ trim: true })
  state?: string; // e.g. "TX"

  @Prop({ trim: true, default: 'Free' })
  registrationFee?: string; // e.g. "$95" or "Free"

  @Prop({ trim: true })
  description?: string;

  @Prop()
  bannerImage?: string;

  @Prop({ type: [String], default: [] })
  tags: string[]; // e.g. ['Marathon', 'Road', 'Certified', 'Chip Timed']

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: 0 })
  maxSpots?: number; // Total capacity e.g. 6000

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'User' }],
    default: [],
  })
  participants: Types.ObjectId[];

  @Prop({ default: 0 })
  participantsCount: number;

  @Prop({
    enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
    default: 'upcoming',
  })
  status: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const RaceSchema = SchemaFactory.createForClass(Race);

RaceSchema.index({ name: 'text', organizer: 'text', location: 'text', city: 'text' });
RaceSchema.index({ date: 1 });
RaceSchema.index({ raceType: 1 });
RaceSchema.index({ distance: 1 });
RaceSchema.index({ isFeatured: 1 });
RaceSchema.index({ status: 1 });
RaceSchema.index({ isActive: 1 });
