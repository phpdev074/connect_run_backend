import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type MatchDocument = Match & Document;

@Schema({ timestamps: true })
export class Match {
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], required: true })
  users: Types.ObjectId[];

  @Prop({ default: 'pending', enum: ['pending', 'matched', 'rejected'] })
  status: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  likedBy: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  superLikedBy: Types.ObjectId[];

  @Prop()
  expiresAt?: Date; // 48-hr countdown for virtual run invite

  @Prop({ default: false })
  virtualRunInviteSent: boolean;

  @Prop({ type: Types.ObjectId, ref: 'RunInvite', default: null })
  runInviteId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Mission', default: null })
  missionId?: Types.ObjectId;

}

export const MatchSchema = SchemaFactory.createForClass(Match);
MatchSchema.index({ users: 1 });
