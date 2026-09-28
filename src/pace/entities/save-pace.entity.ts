import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type SavedPaceDocument = SavedPace & Document;

@Schema({ timestamps: true })
export class SavedPace {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Pace', required: true })
  paceId: Types.ObjectId;
}

export const SavedPaceSchema = SchemaFactory.createForClass(SavedPace);

// Ensure a user can only save a specific pace once
SavedPaceSchema.index({ userId: 1, paceId: 1 }, { unique: true });
