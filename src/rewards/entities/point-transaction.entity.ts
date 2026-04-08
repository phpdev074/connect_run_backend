import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export type PointTransactionDocument = PointTransaction & Document;

@Schema({ timestamps: true })
export class PointTransaction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, enum: ['earned', 'redeemed'] })
  type: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: Types.ObjectId, refPath: 'onModel' })
  relatedId?: Types.ObjectId;

  @Prop({ enum: ['Mission', 'Run', 'Gift', 'Boost'] })
  onModel?: string;
}

export const PointTransactionSchema = SchemaFactory.createForClass(PointTransaction);
