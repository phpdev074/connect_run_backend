import { Injectable } from "@nestjs/common";
import { Block } from "./entities/block.entity";
import { User } from "src/users/entities/user.entity";
import { Match } from "../matches/entities/match.entity";
import { Notification } from "src/notifications/entities/notification.entity";
import { Model, Types } from "mongoose";
import { InjectModel } from "@nestjs/mongoose";

@Injectable()
export class BlockService {
  constructor(
    @InjectModel(Block.name)
    private readonly blockModel: Model<Block>,

    @InjectModel(User.name)
    private readonly userModel: Model<User>,

    @InjectModel(Match.name)
    private readonly matchModel: Model<Match>,

    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
  ) {}

  /**
   * Returns all user IDs that should be excluded due to blocks (both directions).
   * Used by other services to filter out blocked users.
   */
  async getBlockedUserIds(userId: string): Promise<Types.ObjectId[]> {
    const userObjectId = new Types.ObjectId(userId);

    const blocks = await this.blockModel.find({
      $or: [{ blockerId: userObjectId }, { blockedId: userObjectId }],
    });

    const blockedIds: Types.ObjectId[] = [];
    for (const block of blocks) {
      if (block.blockerId.toString() === userId) {
        blockedIds.push(block.blockedId);
      } else {
        blockedIds.push(block.blockerId);
      }
    }

    return blockedIds;
  }

  /**
   * Check if either user has blocked the other.
   */
  async isBlocked(userIdA: string, userIdB: string): Promise<boolean> {
    const block = await this.blockModel.findOne({
      $or: [
        {
          blockerId: new Types.ObjectId(userIdA),
          blockedId: new Types.ObjectId(userIdB),
        },
        {
          blockerId: new Types.ObjectId(userIdB),
          blockedId: new Types.ObjectId(userIdA),
        },
      ],
    });
    return !!block;
  }

  async toggleBlock(loggedInUserId: string, personId: string) {
    try {
      /* ---------- VALIDATION ---------- */
      if (loggedInUserId === personId) {
        return { statusCode: 400, success: false, message: "You cannot block yourself", data: null };
      }

      const [blocker, blocked] = await Promise.all([
        this.userModel.findById(loggedInUserId),
        this.userModel.findById(personId),
      ]);

      if (!blocker) {
        return { statusCode: 404, success: false, message: "Logged-in user not found", data: null };
      }

      if (!blocked) {
        return { statusCode: 404, success: false, message: "User to block not found", data: null };
      }

      /* ---------- CHECK EXISTING BLOCK ---------- */
      const existingBlock = await this.blockModel.findOne({
        blockerId: new Types.ObjectId(loggedInUserId),
        blockedId: new Types.ObjectId(personId),
      });

      /* ---------- UNBLOCK ---------- */
      if (existingBlock) {
        await this.blockModel.deleteOne({ _id: existingBlock._id });
        return { statusCode: 200, success: true, message: "User unblocked successfully", data: null };
      }

      /* ---------- BLOCK ---------- */
      const block = await this.blockModel.create({
        blockerId: new Types.ObjectId(loggedInUserId),
        blockedId: new Types.ObjectId(personId),
      });

      // Clean up: remove all match requests between these two users
      const blockerObjectId = new Types.ObjectId(loggedInUserId);
      const blockedObjectId = new Types.ObjectId(personId);

      await Promise.all([
        // Delete match between these two users
        this.matchModel.deleteMany({
          users: { $all: [blockerObjectId, blockedObjectId] },
        }),
      ]);

      return { statusCode: 201, success: true, message: "User blocked successfully", data: block };
    } catch (error) {
      return { statusCode: 500, success: false, message: "Failed to toggle block", error: error.message };
    }
  }

  async getBlockedUsers(loggedInUserId: string, page = 1, limit = 10) {
    try {
      const userExists = await this.userModel.findById(loggedInUserId);

      if (!userExists) {
        return { statusCode: 404, success: false, message: "Logged-in user not found", data: null };
      }

      const skip = (page - 1) * limit;

      const [blocks, total] = await Promise.all([
        this.blockModel
          .find({ blockerId: new Types.ObjectId(loggedInUserId) })
          .populate("blockedId", "name email profile_image gender createdAt")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),

        this.blockModel.countDocuments({
          blockerId: new Types.ObjectId(loggedInUserId),
        }),
      ]);

      const blockedUsers = blocks.map((block) => block.blockedId);

      return {
        statusCode: 200,
        success: true,
        message: "Blocked users fetched successfully",
        data: {
          blockedUsers,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      return { statusCode: 500, success: false, message: "Failed to fetch blocked users", error: error.message };
    }
  }
}
