import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PostDocument = HydratedDocument<Post>;

@Schema({
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Post {
    @Prop({
        type: Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    })
    user_id: Types.ObjectId;

    @Prop({ trim: true })
    title?: string;

    @Prop({ trim: true })
    text?: string;

    @Prop({ type: [String], default: [] })
    urls?: string[];

    @Prop({ type: [String], default: [], index: true })
    tags?: string[];

    @Prop({
        type: [{ type: Types.ObjectId, ref: 'User' }],
        default: [],
        index: true,
    })
    tagged_users?: Types.ObjectId[];

    @Prop({ default: 'image', trim: true })
    postType?: string;

    @Prop({ default: 0, type: Number })
    watchCount?: number;

    @Prop({ default: true })
    is_active?: boolean;

    created_at: Date;
    updated_at: Date;

    @Prop({
        type: {
            type: String,
            enum: ["Point"],
            default: "Point",
        },
        coordinates: {
            type: [Number], // [lng, lat]
            default: [0, 0],
            // required: true,
        },
    })
    location: {
        type: string;
        coordinates: [number, number];
    };
}

export const PostSchema = SchemaFactory.createForClass(Post);
PostSchema.index({ location: '2dsphere' });
