import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument } from './entities/post.entity';
import { Like, LikeDocument } from './entities/like.entity';
import { Comment, CommentDocument } from './entities/comment.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostQueryDto } from './dto/post-query.dto';
import { User, UserDocument } from '../users/entities/user.entity';

@Injectable()
export class PostService {
  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(Like.name) private likeModel: Model<LikeDocument>,
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(userId: string, createPostDto: CreatePostDto) {
    const post = new this.postModel({
      user_id: new Types.ObjectId(userId),
      ...createPostDto,
    });
    return post.save();
  }

  async findAll(currentUserId: string, query: PostQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    let queryLng = query.longitude ? Number(query.longitude) : null;
    let queryLat = query.latitude ? Number(query.latitude) : null;

    if (queryLng === null || queryLat === null) {
      const user = await this.userModel.findById(currentUserId).select('location').lean();
      if (user?.location?.coordinates && user.location.coordinates.length === 2) {
        const [userLng, userLat] = user.location.coordinates;
        if (userLng !== 0 || userLat !== 0) {
          queryLng = userLng;
          queryLat = userLat;
        }
      }
    }

    const filter: any = { is_active: true };
    const countFilter: any = { is_active: true };

    const hasCoordinates = queryLng !== null && queryLat !== null;

    if (hasCoordinates) {
      const maxDist = (Number(query.maxDistance) || 50) * 1000; // convert km to meters
      
      filter.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [queryLng, queryLat],
          },
          $maxDistance: maxDist,
        },
      };

      countFilter.location = {
        $geoWithin: {
          $centerSphere: [
            [queryLng, queryLat],
            maxDist / 6378100,
          ],
        },
      };
    }

    const queryBuilder = this.postModel.find(filter);
    if (!hasCoordinates) {
      queryBuilder.sort({ created_at: -1 });
    }

    const [posts, total] = await Promise.all([
      queryBuilder
        .populate('user_id', 'first_name last_name display_name image')
        .skip(skip)
        .limit(limit)
        .exec(),
      this.postModel.countDocuments(countFilter),
    ]);

    const data = await Promise.all(
      posts.map(async (post) => {
        const [likesCount, commentsCount, isLiked] = await Promise.all([
          this.likeModel.countDocuments({ post_id: post._id }),
          this.commentModel.countDocuments({ post_id: post._id }),
          this.likeModel.exists({
            post_id: post._id,
            user_id: new Types.ObjectId(currentUserId),
          }),
        ]);

        return {
          ...post.toObject(),
          likesCount,
          commentsCount,
          isLiked: !!isLiked,
        };
      })
    );

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByUserId(userId: string, currentUserId: string, query: PostQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { user_id: new Types.ObjectId(userId) };

    const [posts, total] = await Promise.all([
      this.postModel
        .find(filter)
        .populate('user_id', 'first_name last_name display_name image')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.postModel.countDocuments(filter),
    ]);

    const data = await Promise.all(
      posts.map(async (post) => {
        const [likesCount, commentsCount, isLiked] = await Promise.all([
          this.likeModel.countDocuments({ post_id: post._id }),
          this.commentModel.countDocuments({ post_id: post._id }),
          this.likeModel.exists({
            post_id: post._id,
            user_id: new Types.ObjectId(currentUserId),
          }),
        ]);

        return {
          ...post.toObject(),
          likesCount,
          commentsCount,
          isLiked: !!isLiked,
        };
      })
    );

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, currentUserId: string) {
    const post = await this.postModel
      .findById(id)
      .populate('user_id', 'first_name last_name display_name image')
      .exec();

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const [likesCount, commentsCount, isLiked, comments] = await Promise.all([
      this.likeModel.countDocuments({ post_id: post._id }),
      this.commentModel.countDocuments({ post_id: post._id }),
      this.likeModel.exists({
        post_id: post._id,
        user_id: new Types.ObjectId(currentUserId),
      }),
      this.commentModel
        .find({ post_id: post._id })
        .populate('user_id', 'first_name last_name display_name image')
        .sort({ created_at: 1 })
        .exec(),
    ]);

    return {
      ...post.toObject(),
      likesCount,
      commentsCount,
      isLiked: !!isLiked,
      comments,
    };
  }

  async update(userId: string, id: string, updatePostDto: UpdatePostDto) {
    const post = await this.postModel.findOne({ _id: new Types.ObjectId(id) });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (post.user_id.toString() !== userId) {
      throw new ForbiddenException('You are not authorized to update this post');
    }

    Object.assign(post, updatePostDto);
    return post.save();
  }

  async remove(userId: string, id: string) {
    const post = await this.postModel.findOne({ _id: new Types.ObjectId(id) });
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    if (post.user_id.toString() !== userId) {
      throw new ForbiddenException('You are not authorized to delete this post');
    }

    const postObjectId = new Types.ObjectId(id);
    await Promise.all([
      this.postModel.findByIdAndDelete(id),
      this.likeModel.deleteMany({ post_id: postObjectId }),
      this.commentModel.deleteMany({ post_id: postObjectId }),
    ]);

    return { deleted: true };
  }

  async removeComment(userId: string, commentId: string) {
    const comment = await this.commentModel.findById(commentId);
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const post = await this.postModel.findById(comment.post_id);
    // User can delete if they are the creator of the comment OR the creator of the post
    if (comment.user_id.toString() !== userId && (!post || post.user_id.toString() !== userId)) {
      throw new ForbiddenException('You are not authorized to delete this comment');
    }

    await this.commentModel.findByIdAndDelete(commentId);
    return { deleted: true };
  }

  async toggleLike(userId: string, id: string) {
    const post = await this.postModel.findById(id);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const like = await this.likeModel.findOne({
      post_id: new Types.ObjectId(id),
      user_id: new Types.ObjectId(userId),
    });

    let liked = false;
    if (like) {
      await this.likeModel.deleteOne({ _id: like._id });
    } else {
      await this.likeModel.create({
        post_id: new Types.ObjectId(id),
        user_id: new Types.ObjectId(userId),
      });
      liked = true;
    }

    return { liked };
  }

  async addComment(userId: string, id: string, text: string) {
    const post = await this.postModel.findById(id);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const comment = await this.commentModel.create({
      post_id: new Types.ObjectId(id),
      user_id: new Types.ObjectId(userId),
      text,
    });

    return comment.populate('user_id', 'first_name last_name display_name image');
  }
}
