import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Story, StoryDocument } from './entities/story.entity';
import { User, UserDocument } from '../users/entities/user.entity';
import { BlockService } from '../block/block.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { StoryQueryDto } from './dto/story-query.dto';

@Injectable()
export class StoryService {
  constructor(
    @InjectModel(Story.name) private storyModel: Model<StoryDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly blockService: BlockService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(userId: string, createStoryDto: CreateStoryDto) {
    const story = new this.storyModel({
      user_id: new Types.ObjectId(userId),
      ...createStoryDto,
      user_time: createStoryDto.user_time ? new Date(createStoryDto.user_time) : undefined,
    });
    return story.save();
  }

  async findAllFeed(currentUserId: string, query: StoryQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const blockedIds = await this.blockService.getBlockedUserIds(currentUserId);
    const excludedUserIds = [...blockedIds, new Types.ObjectId(currentUserId)];

    const pipeline: any[] = [
      {
        $match: {
          user_id: { $nin: excludedUserIds },
          is_deleted: { $ne: true },
          created_at: { $gte: twentyFourHoursAgo },
        },
      },
      { $sort: { created_at: 1 } },
      {
        $group: {
          _id: '$user_id',
          stories: {
            $push: {
              _id: '$_id',
              mediaUrl: '$mediaUrl',
              mediaType: '$mediaType',
              views: '$views',
              created_at: '$created_at',
              updated_at: '$updated_at',
              hasWatched: {
                $in: [new Types.ObjectId(currentUserId), { $ifNull: ['$views', []] }],
              },
            },
          },
          latestStoryAt: { $last: '$created_at' },
        },
      },
      { $sort: { latestStoryAt: -1 } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      { $unwind: '$userDetails' },
      {
        $project: {
          _id: 0,
          user: {
            _id: '$userDetails._id',
            first_name: '$userDetails.first_name',
            last_name: '$userDetails.last_name',
            display_name: '$userDetails.display_name',
            image: '$userDetails.image',
            profile_galary: '$userDetails.profile_galary',
          },
          stories: 1,
          allWatched: {
            $eq: [
              {
                $size: {
                  $filter: {
                    input: '$stories',
                    as: 'story',
                    cond: { $eq: ['$$story.hasWatched', false] },
                  },
                },
              },
              0,
            ],
          },
        },
      },
    ];

    const countPipeline = [
      {
        $match: {
          user_id: { $nin: excludedUserIds },
          is_deleted: { $ne: true },
          created_at: { $gte: twentyFourHoursAgo },
        },
      },
      {
        $group: {
          _id: '$user_id',
        },
      },
      {
        $count: 'total',
      },
    ];

    const [results, countResult] = await Promise.all([
      this.storyModel.aggregate([...pipeline, { $skip: skip }, { $limit: limit }]).exec(),
      this.storyModel.aggregate(countPipeline).exec(),
    ]);

    const total = countResult[0]?.total || 0;

    return {
      data: results,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findMyActiveStories(userId: string, query: StoryQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const filter = {
      user_id: new Types.ObjectId(userId),
      is_deleted: { $ne: true },
      created_at: { $gte: twentyFourHoursAgo },
    };

    const [stories, total] = await Promise.all([
      this.storyModel
        .find(filter)
        .populate('views', 'first_name last_name display_name image profile_galary')
        .sort({ created_at: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.storyModel.countDocuments(filter),
    ]);

    // Original code commented out:
    // return {
    //   data: stories,
    //   meta: {
    //     total,
    //     page,
    //     limit,
    //     totalPages: Math.ceil(total / limit),
    //   },
    // };

    const data = stories.map((story) => {
      const storyObj = story.toObject();
      return {
        ...storyObj,
        viewCount: story.views ? story.views.length : 0,
      };
    });

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

  async findMyHistory(userId: string, query: StoryQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const filter = {
      user_id: new Types.ObjectId(userId),
      is_deleted: { $ne: true },
      created_at: { $lt: twentyFourHoursAgo },
    };

    const [stories, total] = await Promise.all([
      this.storyModel
        .find(filter)
        .populate('views', 'first_name last_name display_name image profile_galary')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.storyModel.countDocuments(filter),
    ]);

    // Original code commented out:
    // return {
    //   data: stories,
    //   meta: {
    //     total,
    //     page,
    //     limit,
    //     totalPages: Math.ceil(total / limit),
    //   },
    // };

    const data = stories.map((story) => {
      const storyObj = story.toObject();
      return {
        ...storyObj,
        viewCount: story.views ? story.views.length : 0,
      };
    });

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
    const story = await this.storyModel.findOne({ _id: new Types.ObjectId(id), is_deleted: { $ne: true } }).exec();
    if (!story) {
      throw new NotFoundException('Story not found');
    }

    const storyOwnerId = story.user_id.toString();
    const isBlocked = await this.blockService.isBlocked(currentUserId, storyOwnerId);
    if (isBlocked) {
      throw new ForbiddenException('You cannot view this story');
    }

    // Populate user details of the story owner
    await story.populate('user_id', 'first_name last_name display_name image profile_galary');

    // Only allow the story owner to see the full list of viewers, likes, comments, and reactions
    if (storyOwnerId === currentUserId) {
      await story.populate([
        { path: 'views', select: 'first_name last_name display_name image profile_galary' },
        { path: 'likes', select: 'first_name last_name display_name image profile_galary' },
        { path: 'comments.user_id', select: 'first_name last_name display_name image profile_galary' },
        { path: 'reactions.user_id', select: 'first_name last_name display_name image profile_galary' },
      ]);
    }

    const getUserIdStr = (userField: any) => {
      if (!userField) return '';
      return userField._id ? userField._id.toString() : userField.toString();
    };

    const hasWatched = story.views.some((viewId) => getUserIdStr(viewId) === currentUserId);
    const hasLiked = story.likes.some((likeId) => getUserIdStr(likeId) === currentUserId);
    const myReaction = story.reactions.find((r) => getUserIdStr(r.user_id) === currentUserId)?.reaction || null;

    return {
      ...story.toObject(),
      hasWatched,
      hasLiked,
      myReaction,
    };
  }

  async toggleLikeStory(currentUserId: string, id: string) {
    const story = await this.storyModel.findOne({ _id: new Types.ObjectId(id), is_deleted: { $ne: true } });
    if (!story) {
      throw new NotFoundException('Story not found');
    }

    const storyOwnerId = story.user_id.toString();
    const isBlocked = await this.blockService.isBlocked(currentUserId, storyOwnerId);
    if (isBlocked) {
      throw new ForbiddenException('You cannot interact with this story');
    }

    const userIdObj = new Types.ObjectId(currentUserId);
    const hasLiked = story.likes.some((likeId) => likeId.toString() === currentUserId);

    if (hasLiked) {
      // Unlike
      await this.storyModel.findByIdAndUpdate(id, {
        $pull: { likes: userIdObj },
      });
      return { liked: false };
    } else {
      // Like
      await this.storyModel.findByIdAndUpdate(id, {
        $addToSet: { likes: userIdObj },
      });

      // Send notification if not liking own story
      if (storyOwnerId !== currentUserId) {
        const likerName = await this.getUserNameById(currentUserId);
        await this.notificationsService.sendAndSave(
          storyOwnerId,
          'ConnectRun',
          `${likerName} liked your story`,
          'STORY_LIKE',
          { storyId: id, actorId: currentUserId },
        ).catch(() => {});
      }

      return { liked: true };
    }
  }

  async commentStory(currentUserId: string, id: string, text: string) {
    const story = await this.storyModel.findOne({ _id: new Types.ObjectId(id), is_deleted: { $ne: true } });
    if (!story) {
      throw new NotFoundException('Story not found');
    }

    const storyOwnerId = story.user_id.toString();
    const isBlocked = await this.blockService.isBlocked(currentUserId, storyOwnerId);
    if (isBlocked) {
      throw new ForbiddenException('You cannot interact with this story');
    }

    const comment = {
      user_id: new Types.ObjectId(currentUserId),
      text,
      created_at: new Date(),
    };

    await this.storyModel.findByIdAndUpdate(id, {
      $push: { comments: comment },
    });

    // Send notification if not commenting on own story
    if (storyOwnerId !== currentUserId) {
      const commenterName = await this.getUserNameById(currentUserId);
      await this.notificationsService.sendAndSave(
        storyOwnerId,
        'ConnectRun',
        `${commenterName} replied to your story: "${text}"`,
        'STORY_COMMENT',
        { storyId: id, actorId: currentUserId },
      ).catch(() => {});
    }

    return { success: true, comment };
  }

  async reactStory(currentUserId: string, id: string, reaction: string) {
    const story = await this.storyModel.findOne({ _id: new Types.ObjectId(id), is_deleted: { $ne: true } });
    if (!story) {
      throw new NotFoundException('Story not found');
    }

    const storyOwnerId = story.user_id.toString();
    const isBlocked = await this.blockService.isBlocked(currentUserId, storyOwnerId);
    if (isBlocked) {
      throw new ForbiddenException('You cannot interact with this story');
    }

    const userIdObj = new Types.ObjectId(currentUserId);

    // Pull any existing reaction by this user first (to enforce max 1 reaction)
    await this.storyModel.findByIdAndUpdate(id, {
      $pull: { reactions: { user_id: userIdObj } },
    });

    const newReaction = {
      user_id: userIdObj,
      reaction,
      created_at: new Date(),
    };

    // Push the new reaction
    await this.storyModel.findByIdAndUpdate(id, {
      $push: { reactions: newReaction },
    });

    // Send notification if not reacting to own story
    if (storyOwnerId !== currentUserId) {
      const reactorName = await this.getUserNameById(currentUserId);
      await this.notificationsService.sendAndSave(
        storyOwnerId,
        'ConnectRun',
        `${reactorName} reacted to your story: ${reaction}`,
        'STORY_REACTION',
        { storyId: id, actorId: currentUserId, reaction },
      ).catch(() => {});
    }

    return { success: true, reaction: newReaction };
  }

  async getStoryLikers(currentUserId: string, id: string) {
    const story = await this.storyModel.findOne({ _id: new Types.ObjectId(id), is_deleted: { $ne: true } });
    if (!story) {
      throw new NotFoundException('Story not found');
    }

    const storyOwnerId = story.user_id.toString();
    if (storyOwnerId !== currentUserId) {
      throw new ForbiddenException('Only the story owner can view story likers');
    }

    await story.populate({
      path: 'likes',
      select: 'first_name last_name display_name image profile_galary',
    });

    return story.likes;
  }

  async getStoryCommentsAndReactions(currentUserId: string, id: string) {
    const story = await this.storyModel.findOne({ _id: new Types.ObjectId(id), is_deleted: { $ne: true } });
    if (!story) {
      throw new NotFoundException('Story not found');
    }

    const storyOwnerId = story.user_id.toString();
    if (storyOwnerId !== currentUserId) {
      throw new ForbiddenException('Only the story owner can view story comments and reactions');
    }

    await story.populate([
      { path: 'comments.user_id', select: 'first_name last_name display_name image profile_galary' },
      { path: 'reactions.user_id', select: 'first_name last_name display_name image profile_galary' },
    ]);

    return {
      comments: story.comments,
      reactions: story.reactions,
    };
  }

  private async getUserNameById(userId: string): Promise<string> {
    const user = await this.userModel.findById(userId).select('first_name last_name display_name').exec();
    if (!user) return 'Someone';
    return user.display_name || `${user.first_name} ${user.last_name}`.trim() || 'Someone';
  }

  async watchStory(currentUserId: string, id: string) {
    const story = await this.storyModel.findOne({ _id: new Types.ObjectId(id), is_deleted: { $ne: true } });
    if (!story) {
      throw new NotFoundException('Story not found');
    }

    const storyOwnerId = story.user_id.toString();
    const isBlocked = await this.blockService.isBlocked(currentUserId, storyOwnerId);
    if (isBlocked) {
      throw new ForbiddenException('You cannot watch this story');
    }

    // Add current user to views if they are not the owner of the story
    if (storyOwnerId !== currentUserId) {
      await this.storyModel.findByIdAndUpdate(id, {
        $addToSet: { views: new Types.ObjectId(currentUserId) },
      });
    }

    return { success: true };
  }

  async update(userId: string, id: string, updateStoryDto: UpdateStoryDto) {
    const story = await this.storyModel.findOne({ _id: new Types.ObjectId(id), is_deleted: { $ne: true } });
    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.user_id.toString() !== userId) {
      throw new ForbiddenException('You are not authorized to update this story');
    }

    Object.assign(story, updateStoryDto);
    return story.save();
  }

  async remove(userId: string, id: string) {
    const story = await this.storyModel.findOne({ _id: new Types.ObjectId(id), is_deleted: { $ne: true } });
    if (!story) {
      throw new NotFoundException('Story not found');
    }

    if (story.user_id.toString() !== userId) {
      throw new ForbiddenException('You are not authorized to delete this story');
    }

    // Soft delete the story
    story.is_deleted = true;
    await story.save();
    return { deleted: true };
  }
}
