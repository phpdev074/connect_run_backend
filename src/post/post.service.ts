import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Post, PostDocument } from './entities/post.entity';
import { Like, LikeDocument } from './entities/like.entity';
import { Comment, CommentDocument } from './entities/comment.entity';
import { Report, ReportDocument } from './entities/report.entity';
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
    @InjectModel(Report.name) private reportModel: Model<ReportDocument>,
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

    if (query.postType) {
      filter.postType = query.postType;
      countFilter.postType = query.postType;
    }

    const maxDistanceParam = query.maxDistance !== undefined ? Number(query.maxDistance) : null;
    const hasValidRadius = maxDistanceParam !== null && !isNaN(maxDistanceParam) && maxDistanceParam > 0;

    const hasCoordinates = queryLng !== null && queryLat !== null;
    const runProximitySearch = hasCoordinates && hasValidRadius;

    if (runProximitySearch) {
      const maxDist = maxDistanceParam * 1000; // convert km to meters
      
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
    if (!runProximitySearch) {
      queryBuilder.sort({ created_at: -1 });
    }

    const [posts, total] = await Promise.all([
      queryBuilder
        .populate('user_id', 'first_name last_name display_name image profile_galary')
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

    const filter: any = { user_id: new Types.ObjectId(userId) };
    if (query.postType) {
      filter.postType = query.postType;
    }

    const [posts, total] = await Promise.all([
      this.postModel
        .find(filter)
        .populate('user_id', 'first_name last_name display_name image profile_galary')
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
      .populate('user_id', 'first_name last_name display_name image profile_galary')
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
        .populate('user_id', 'first_name last_name display_name image profile_galary')
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

    await this.deleteCommentAndRepliesRecursively(comment._id as Types.ObjectId);
    return { deleted: true };
  }

  private async deleteCommentAndRepliesRecursively(commentId: Types.ObjectId) {
    // Find direct child replies
    const replies = await this.commentModel.find({ parentCommentId: commentId }).exec();
    for (const reply of replies) {
      await this.deleteCommentAndRepliesRecursively(reply._id as Types.ObjectId);
    }
    // Delete the comment itself
    await this.commentModel.findByIdAndDelete(commentId);
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

  async addComment(userId: string, id: string, text: string, parentCommentId?: string) {
    const post = await this.postModel.findById(id);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    let parentCommentIdObj: Types.ObjectId | null = null;
    if (parentCommentId) {
      const parentComment = await this.commentModel.findById(parentCommentId);
      if (!parentComment) {
        throw new NotFoundException('Parent comment not found');
      }
      if (parentComment.post_id.toString() !== id) {
        throw new ForbiddenException('Parent comment does not belong to this post');
      }
      parentCommentIdObj = parentComment._id as Types.ObjectId;
    }

    const comment = await this.commentModel.create({
      post_id: new Types.ObjectId(id),
      user_id: new Types.ObjectId(userId),
      text,
      parentCommentId: parentCommentIdObj,
    });

    return comment.populate('user_id', 'first_name last_name display_name image profile_galary');
  }

  async getPostLikers(postId: string) {
    const post = await this.postModel.findById(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const likes = await this.likeModel
      .find({ post_id: new Types.ObjectId(postId) })
      .populate('user_id', 'first_name last_name display_name image profile_galary')
      .exec();

    return likes.map((like) => like.user_id).filter((user) => user !== null);
  }

  async getPostCommenters(postId: string) {
    const post = await this.postModel.findById(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const comments = await this.commentModel
      .find({ post_id: new Types.ObjectId(postId) })
      .populate('user_id', 'first_name last_name display_name image profile_galary')
      .sort({ created_at: 1 })
      .exec();

    const commentMap = new Map<string, any>();
    const rootComments: any[] = [];

    // Initialize all comments in the map with a replies array
    for (const comment of comments) {
      const commentObj = {
        ...comment.toObject(),
        replies: [],
      };
      commentMap.set(commentObj._id.toString(), commentObj);
    }

    // Associate child replies to parent comments
    for (const comment of comments) {
      const commentObj = commentMap.get(comment._id.toString());
      if (comment.parentCommentId) {
        const parentIdStr = comment.parentCommentId.toString();
        const parentObj = commentMap.get(parentIdStr);
        if (parentObj) {
          parentObj.replies.push(commentObj);
        } else {
          rootComments.push(commentObj);
        }
      } else {
        rootComments.push(commentObj);
      }
    }

    return rootComments;
  }

  async incrementWatchCount(postId: string) {
    const post = await this.postModel.findByIdAndUpdate(
      postId,
      { $inc: { watchCount: 1 } },
      { new: true }
    );
    if (!post) {
      throw new NotFoundException('Post not found');
    }
    return { watchCount: post.watchCount };
  }

  async reportPost(userId: string, postId: string, reason?: string) {
    const post = await this.postModel.findById(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const existingReport = await this.reportModel.findOne({
      post_id: new Types.ObjectId(postId),
      user_id: new Types.ObjectId(userId),
    });

    if (existingReport) {
      throw new ConflictException('You have already reported this post');
    }

    const report = await this.reportModel.create({
      post_id: new Types.ObjectId(postId),
      user_id: new Types.ObjectId(userId),
      reason,
    });

    return report;
  }

  async getReportedPosts() {
    return this.reportModel.aggregate([
      {
        $group: {
          _id: '$post_id',
          reports: {
            $push: {
              user_id: '$user_id',
              reason: '$reason',
              created_at: '$created_at',
            },
          },
          totalReports: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'posts',
          localField: '_id',
          foreignField: '_id',
          as: 'post',
        },
      },
      {
        $unwind: '$post',
      },
      {
        $lookup: {
          from: 'users',
          localField: 'post.user_id',
          foreignField: '_id',
          as: 'postUser',
        },
      },
      {
        $unwind: {
          path: '$postUser',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'reports.user_id',
          foreignField: '_id',
          as: 'reportingUsers',
        },
      },
      {
        $project: {
          _id: 0,
          post_id: '$_id',
          totalReports: 1,
          post: {
            _id: '$post._id',
            title: '$post.title',
            text: '$post.text',
            urls: '$post.urls',
            postType: '$post.postType',
            watchCount: '$post.watchCount',
            is_active: '$post.is_active',
            created_at: '$post.created_at',
            updated_at: '$post.updated_at',
            user_id: {
              _id: '$postUser._id',
              first_name: '$postUser.first_name',
              last_name: '$postUser.last_name',
              display_name: '$postUser.display_name',
              profile_galary: '$postUser.profile_galary',
            },
          },
          reports: {
            $map: {
              input: '$reports',
              as: 'rep',
              in: {
                reason: '$$rep.reason',
                created_at: '$$rep.created_at',
                user: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$reportingUsers',
                        as: 'u',
                        cond: { $eq: ['$$u._id', '$$rep.user_id'] },
                      },
                    },
                    0,
                  ],
                },
              },
            },
          },
        },
      },
      {
        $project: {
          post_id: 1,
          post: 1,
          totalReports: 1,
          reports: {
            $map: {
              input: '$reports',
              as: 'rep',
              in: {
                reason: '$$rep.reason',
                created_at: '$$rep.created_at',
                user: {
                  _id: '$$rep.user._id',
                  first_name: '$$rep.user.first_name',
                  last_name: '$$rep.user.last_name',
                  display_name: '$$rep.user.display_name',
                  profile_galary: '$$rep.user.profile_galary',
                },
              },
            },
          },
        },
      },
    ]).exec();
  }
}
