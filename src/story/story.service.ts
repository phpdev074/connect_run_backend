import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Story, StoryDocument } from './entities/story.entity';
import { User, UserDocument } from '../users/entities/user.entity';
import { BlockService } from '../block/block.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { StoryQueryDto } from './dto/story-query.dto';

@Injectable()
export class StoryService {
  constructor(
    @InjectModel(Story.name) private storyModel: Model<StoryDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly blockService: BlockService,
  ) {}

  async create(userId: string, createStoryDto: CreateStoryDto) {
    const story = new this.storyModel({
      user_id: new Types.ObjectId(userId),
      ...createStoryDto,
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

    return {
      data: stories,
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

    return {
      data: stories,
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

    // Only allow the story owner to see the full list of viewers
    if (storyOwnerId === currentUserId) {
      await story.populate('views', 'first_name last_name display_name image profile_galary');
    }

    const hasWatched = story.views.some((viewId) => viewId.toString() === currentUserId);

    return {
      ...story.toObject(),
      hasWatched,
    };
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
