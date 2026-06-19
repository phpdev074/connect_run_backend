import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

@Schema({ timestamps: true })
export class Block {
  // user who is blocking
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  blockerId: Types.ObjectId;

  // user who is being blocked
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  blockedId: Types.ObjectId;

  // soft block / unblock support
  //   @Prop({ type: Boolean, default: true })
  //   isBlocked: boolean;
}

export const BlockSchema = SchemaFactory.createForClass(Block);

// Prevent duplicate blocks
BlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
