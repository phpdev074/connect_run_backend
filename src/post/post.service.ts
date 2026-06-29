import { Injectable, NotFoundException, ForbiddenException, ConflictException, Logger } from '@nestjs/common';
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
import { BlockService } from '../block/block.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);

  constructor(
    @InjectModel(Post.name) private postModel: Model<PostDocument>,
    @InjectModel(Like.name) private likeModel: Model<LikeDocument>,
    @InjectModel(Comment.name) private commentModel: Model<CommentDocument>,
    @InjectModel(Report.name) private reportModel: Model<ReportDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly blockService: BlockService,
    private readonly notificationsService: NotificationsService,
  ) { }

  async create(userId: string, createPostDto: CreatePostDto) {
    const tags = createPostDto.tags
      ? createPostDto.tags.map((t) => t.trim().toLowerCase()).filter(Boolean)
      : [];
    // Original code commented out:
    // const post = new this.postModel({
    //   user_id: new Types.ObjectId(userId),
    //   ...createPostDto,
    //   tags,
    // });
    // const taggedUsers = await this.extractTaggedUsers(createPostDto.text, createPostDto.title);
    const taggedUsers = createPostDto.tagged_users
      ? createPostDto.tagged_users.map((id) => new Types.ObjectId(id))
      : [];
    const post = new this.postModel({
      user_id: new Types.ObjectId(userId),
      ...createPostDto,
      tags,
      tagged_users: taggedUsers,
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

    const blockedIds = await this.blockService.getBlockedUserIds(currentUserId);

    const filter: any = { is_active: true, user_id: { $nin: blockedIds } };
    const countFilter: any = { is_active: true, user_id: { $nin: blockedIds } };

    if (query.postType) {
      filter.postType = query.postType;
      countFilter.postType = query.postType;
    }

    if (query.tag) {
      const normalizedTag = query.tag.trim().toLowerCase();
      filter.tags = normalizedTag;
      countFilter.tags = normalizedTag;
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
        // Added populate for tagged_users
        .populate('tagged_users', 'first_name last_name display_name image profile_galary')
        .skip(skip)
        .limit(limit)
        .exec(),
      this.postModel.countDocuments(countFilter),
    ]);

    const data = await Promise.all(
      posts.map(async (post) => {
        const [likesCount, commentsCount, isLiked] = await Promise.all([
          this.likeModel.countDocuments({ post_id: post._id }),
          this.commentModel.countDocuments({ post_id: post._id, parentCommentId: null }),
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

    const isBlocked = await this.blockService.isBlocked(currentUserId, userId);
    if (isBlocked) {
      return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
    }

    const filter: any = { user_id: new Types.ObjectId(userId) };
    if (query.postType) {
      filter.postType = query.postType;
    }
    if (query.tag) {
      filter.tags = query.tag.trim().toLowerCase();
    }

    const [posts, total] = await Promise.all([
      this.postModel
        .find(filter)
        .populate('user_id', 'first_name last_name display_name image profile_galary')
        // Added populate for tagged_users
        .populate('tagged_users', 'first_name last_name display_name image profile_galary')
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
          this.commentModel.countDocuments({ post_id: post._id, parentCommentId: null }),
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
      // Added populate for tagged_users
      .populate('tagged_users', 'first_name last_name display_name image profile_galary')
      .exec();

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const postUserId = (post.user_id as any)._id.toString();
    const isBlocked = await this.blockService.isBlocked(currentUserId, postUserId);
    if (isBlocked) {
      throw new ForbiddenException('You cannot view this post');
    }

    const [likesCount, commentsCount, isLiked, comments] = await Promise.all([
      this.likeModel.countDocuments({ post_id: post._id }),
      this.commentModel.countDocuments({ post_id: post._id, parentCommentId: null }),
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

    const updateData = { ...updatePostDto };
    if (updateData.tags) {
      updateData.tags = updateData.tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
    }

    // Extract tagged users if text or title is updated (Commented out: now receiving user IDs directly)
    // if (updateData.text !== undefined || updateData.title !== undefined) {
    //   const text = updateData.text !== undefined ? updateData.text : post.text;
    //   const title = updateData.title !== undefined ? updateData.title : post.title;
    //   updateData['tagged_users'] = await this.extractTaggedUsers(text, title);
    // }
    if (updateData.tagged_users) {
      updateData.tagged_users = updateData.tagged_users.map((id) => new Types.ObjectId(id as any) as any);
    }

    Object.assign(post, updateData);
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
      this.notificationsService.removePostActivityNotification(userId, id, 'POST_LIKE'),
      this.notificationsService.removePostActivityNotification(userId, id, 'POST_COMMENT'),
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
    if (post) {
      await this.syncPostCommentNotification(post, userId, false);
    }
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
      await this.syncPostLikeNotification(post, userId, false);
    } else {
      await this.likeModel.create({
        post_id: new Types.ObjectId(id),
        user_id: new Types.ObjectId(userId),
      });
      liked = true;
      await this.syncPostLikeNotification(post, userId, true);
    }

    return { liked };
  }

  async addComment(userId: string, id: string, text: string, parentCommentId?: string) {
    const post = await this.postModel.findById(id);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    let parentCommentIdObj: Types.ObjectId | null = null;
    let parentComment: CommentDocument | null = null;
    if (parentCommentId) {
      parentComment = await this.commentModel.findById(parentCommentId);
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

    await this.syncPostCommentNotification(post, userId, true, comment._id as Types.ObjectId);
    if (parentComment) {
      await this.sendCommentReplyNotification(parentComment, comment, userId);
    }

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
      .sort({ created_at: -1 })
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

  private async syncPostLikeNotification(post: PostDocument, triggeringUserId: string, shouldSendPush: boolean) {
    const postId = (post._id as Types.ObjectId).toString();
    const postOwnerId = post.user_id.toString();
    const ownerObjectId = new Types.ObjectId(postOwnerId);

    const latestLike = await this.likeModel
      .findOne({
        post_id: new Types.ObjectId(postId),
        user_id: { $ne: ownerObjectId },
      })
      .sort({ created_at: -1 })
      .exec();

    if (!latestLike) {
      this.logger.log(
        `Post like notification skipped: no active non-owner likes. postId=${postId} ownerId=${postOwnerId} triggeringUserId=${triggeringUserId}`,
      );
      await this.notificationsService.removePostActivityNotification(postOwnerId, postId, 'POST_LIKE');
      return;
    }

    const actorUserId = latestLike.user_id.toString();
    if (actorUserId === postOwnerId) {
      this.logger.log(
        `Post like notification skipped: latest actor is post owner. postId=${postId} ownerId=${postOwnerId} triggeringUserId=${triggeringUserId}`,
      );
      return;
    }

    const actorCount = await this.likeModel.countDocuments({
      post_id: new Types.ObjectId(postId),
      user_id: { $ne: ownerObjectId },
    });

    const pushRequested = shouldSendPush && triggeringUserId !== postOwnerId && actorUserId === triggeringUserId;
    this.logger.log(
      `Post like notification syncing: postId=${postId} ownerId=${postOwnerId} actorId=${actorUserId} actorCount=${actorCount} pushRequested=${pushRequested}`,
    );

    await this.notificationsService.upsertPostActivityNotification({
      userId: postOwnerId,
      postId,
      actorId: actorUserId,
      actorName: await this.getUserNameById(actorUserId),
      actorCount,
      type: 'POST_LIKE',
      activityAt: latestLike.created_at || new Date(),
      shouldSendPush: pushRequested,
    });
  }

  private async syncPostCommentNotification(
    post: PostDocument,
    triggeringUserId: string,
    shouldSendPush: boolean,
    commentId?: Types.ObjectId,
  ) {
    const postId = (post._id as Types.ObjectId).toString();
    const postOwnerId = post.user_id.toString();
    const ownerObjectId = new Types.ObjectId(postOwnerId);

    const latestComment = await this.commentModel
      .findOne({
        post_id: new Types.ObjectId(postId),
        user_id: { $ne: ownerObjectId },
      })
      .sort({ created_at: -1 })
      .exec();

    if (!latestComment) {
      this.logger.log(
        `Post comment notification skipped: no active non-owner comments. postId=${postId} ownerId=${postOwnerId} triggeringUserId=${triggeringUserId}`,
      );
      await this.notificationsService.removePostActivityNotification(postOwnerId, postId, 'POST_COMMENT');
      return;
    }

    const actorUserId = latestComment.user_id.toString();
    if (actorUserId === postOwnerId) {
      this.logger.log(
        `Post comment notification skipped: latest actor is post owner. postId=${postId} ownerId=${postOwnerId} triggeringUserId=${triggeringUserId}`,
      );
      return;
    }

    const commenterIds = await this.commentModel.distinct('user_id', {
      post_id: new Types.ObjectId(postId),
      user_id: { $ne: ownerObjectId },
    });

    const pushRequested = shouldSendPush && triggeringUserId !== postOwnerId && actorUserId === triggeringUserId;
    this.logger.log(
      `Post comment notification syncing: postId=${postId} ownerId=${postOwnerId} actorId=${actorUserId} commenterCount=${commenterIds.length} pushRequested=${pushRequested}`,
    );

    await this.notificationsService.upsertPostActivityNotification({
      userId: postOwnerId,
      postId,
      actorId: actorUserId,
      actorName: await this.getUserNameById(actorUserId),
      actorCount: commenterIds.length,
      type: 'POST_COMMENT',
      activityAt: latestComment.created_at || new Date(),
      shouldSendPush: pushRequested,
      extraData: {
        commentId: (commentId || latestComment._id).toString(),
      },
    });
  }

  private async sendCommentReplyNotification(
    parentComment: CommentDocument,
    reply: CommentDocument,
    replierId: string,
  ) {
    const parentCommentOwnerId = parentComment.user_id.toString();
    const postId = parentComment.post_id.toString();

    if (parentCommentOwnerId === replierId) {
      this.logger.log(
        `Comment reply notification skipped: user replied to own comment. postId=${postId} parentCommentId=${parentComment._id} replierId=${replierId}`,
      );
      return;
    }

    const replierName = await this.getUserNameById(replierId);
    const title = 'New reply';
    const body = `${replierName} replied to your comment`;
    const data = {
      postId,
      commentId: (reply._id as Types.ObjectId).toString(),
      parentCommentId: (parentComment._id as Types.ObjectId).toString(),
      actorId: replierId,
      actorName: replierName,
    };

    this.logger.log(
      `Comment reply notification sending: postId=${postId} parentCommentId=${parentComment._id} replyId=${reply._id} recipientId=${parentCommentOwnerId} actorId=${replierId}`,
    );

    await this.notificationsService.sendAndSave(
      parentCommentOwnerId,
      title,
      body,
      'POST_COMMENT_REPLY',
      data,
    );
  }

  private async getUserNameById(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('first_name last_name display_name full_name')
      .lean();

    return this.getUserName(user);
  }

  private getUserName(user: any) {
    if (!user || user instanceof Types.ObjectId) {
      return 'Someone';
    }

    return user.display_name || user.full_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Someone';
  }

  // Added method to find posts where the user is tagged
  async findTaggedPosts(currentUserId: string, query: PostQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const blockedIds = await this.blockService.getBlockedUserIds(currentUserId);

    const filter: any = {
      is_active: true,
      user_id: { $nin: blockedIds },
      tagged_users: new Types.ObjectId(currentUserId),
    };

    const [posts, total] = await Promise.all([
      this.postModel
        .find(filter)
        .populate('user_id', 'first_name last_name display_name image profile_galary')
        .populate('tagged_users', 'first_name last_name display_name image profile_galary')
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
          this.commentModel.countDocuments({ post_id: post._id, parentCommentId: null }),
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

  // Added helper method to extract tagged users from post text & title
  // (Commented out: now receiving user IDs directly from payload)
  // private async extractTaggedUsers(text?: string, title?: string): Promise<Types.ObjectId[]> {
  //   const combinedText = `${text || ''} ${title || ''}`;
  //   const regex = /@([a-zA-Z0-9_.\-]+)/g;
  //   const matches: string[] = [];
  //   let match;
  //   while ((match = regex.exec(combinedText)) !== null) {
  //     matches.push(match[1].toLowerCase());
  //   }
  //   if (matches.length === 0) return [];
  // 
  //   const users = await this.userModel.find({
  //     $or: [
  //       { display_name: { $exists: true } },
  //       { full_name: { $exists: true } },
  //       { first_name: { $exists: true } },
  //       { last_name: { $exists: true } },
  //     ],
  //   }).select('display_name full_name first_name last_name').lean();
  // 
  //   const taggedUserIds: Types.ObjectId[] = [];
  //   for (const user of users) {
  //     const namesToCompare = [
  //       user.display_name,
  //       user.full_name,
  //       user.first_name,
  //       user.last_name,
  //       user.first_name && user.last_name ? `${user.first_name}${user.last_name}` : null,
  //       user.display_name?.replace(/\s+/g, ''),
  //       user.full_name?.replace(/\s+/g, ''),
  //     ].filter(Boolean).map(n => n?.toLowerCase());
  // 
  //     const isMatched = matches.some(matchTag => namesToCompare.includes(matchTag));
  //     if (isMatched) {
  //       taggedUserIds.push(user._id as Types.ObjectId);
  //     }
  //   }
  // 
  //   return taggedUserIds;
  // }
}
