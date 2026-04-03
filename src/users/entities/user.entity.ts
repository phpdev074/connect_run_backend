import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';
export type UserDocument = User & Document;
@Schema({ timestamps: true })
export class User {
  @Prop({ lowercase: true })
  email?: string;

  @Prop()
  full_name?: string;

  @Prop()
  first_name?: string;

  @Prop()
  last_name?: string;

  @Prop()
  display_name?: string;

  @Prop()
  dob?: string;

  @Prop()
  height_ft?: number;

  @Prop()
  height_in?: number;

  @Prop()
  education?: string;

  @Prop()
  occupation?: string;

  @Prop()
  running_level?: string;

  @Prop()
  miles_per_week?: number;

  @Prop({ type: [String], default: [] })
  interests: string[];

  @Prop()
  image?: string;

  @Prop({ type: [String], default: [] })
  profile_galary: string[];

  @Prop()
  fitness_level: string;

  @Prop()
  password: string;

  @Prop()
  phone?: string;

  @Prop()
  countryCode?: string;

  @Prop()
  age?: number;

  @Prop()
  days_per_week?: number;

  @Prop({ type: [String], default: [] })
  activities: string[];

  @Prop({ type: [String], default: [] })
  fitness_goals: string[];

  @Prop()
  gym_location?: string;

  @Prop()
  latitude?: number;

  @Prop()
  longitude?: number;

  @Prop({
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] },
  })
  location: {
    type: string;
    coordinates: number[];
  };

  @Prop()
  bio?: string;

  @Prop({ default: true })
  isNotification?: boolean;

  @Prop()
  deviceToken?: string;

  @Prop({ type: Number })
  resetOtp?: number | null;

  @Prop({ type: Number })
  resetOtpExpire?: number | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ location: '2dsphere' });