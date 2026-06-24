import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './entities/notification.entity';
import { FirebaseService } from '../utils/firebase.service';
import { UsersService } from '../users/users.service';

export type PostActivityNotificationType = 'POST_LIKE' | 'POST_COMMENT';

export interface NotificationListItem {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  body: string;
  type: string;
  data?: any;
  activityAt?: Date;
  isRead: boolean;
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface NotificationsPage {
  data: NotificationListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    private readonly firebaseService: FirebaseService,
    private readonly userService: UsersService,
  ) { }

  async sendNotification(userId: string | Types.ObjectId, title: string, message: string, type?: string, data: any = {}) {
    try {
      const tokens = await this.userService.getFcmTokens([userId.toString()]);
      this.logger.log(`Found ${tokens.length} FCM tokens for user ${userId} to send push notification.`);
      if (tokens.length > 0) {
        // Merge type into data for push payload
        const payload = { ...data, notificationType: type };
        for (const token of tokens) {
          await this.firebaseService.sendPushNotification(token, title, message, payload);
        }
        this.logger.log(`Push notification sent. userId=${userId} type=${type} tokenCount=${tokens.length}`);
      } else {
        this.logger.log(`Push notification skipped: no FCM tokens. userId=${userId} type=${type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send push notification to user ${userId}`, error.stack);
    }
  }

  async sendAndSave(userId: string | Types.ObjectId, title: string, body: string, type: string, data?: any) {
    // 1. Save to database
    const notification = await this.notificationModel.create({
      userId: new Types.ObjectId(userId),
      title,
      body,
      type,
      data,
    });
    this.logger.log(
      `Notification saved. notificationId=${notification._id?.toString?.()} userId=${userId} type=${type} body="${body}"`,
    );

    // 2. Send push notification if token exists
    try {
      const tokens = await this.userService.getFcmTokens([userId.toString()]);
      if (tokens.length > 0) {
        // Merge type into data for push payload
        const payload = { ...data, type };
        for (const token of tokens) {
          await this.firebaseService.sendPushNotification(token, title, body, payload);
        }
        this.logger.log(`Saved notification push sent. userId=${userId} type=${type} tokenCount=${tokens.length}`);
      } else {
        this.logger.log(`Saved notification push skipped: no FCM tokens. userId=${userId} type=${type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send push notification to user ${userId}`, error.stack);
    }

    return notification;
  }

  async upsertPostActivityNotification(params: {
    userId: string | Types.ObjectId;
    postId: string | Types.ObjectId;
    actorId: string | Types.ObjectId;
    actorName: string;
    actorCount: number;
    type: PostActivityNotificationType;
    activityAt: Date;
    shouldSendPush?: boolean;
    extraData?: Record<string, any>;
  }) {
    const {
      userId,
      postId,
      actorId,
      actorName,
      actorCount,
      type,
      activityAt,
      shouldSendPush = true,
      extraData = {},
    } = params;

    const actionText = type === 'POST_LIKE' ? 'liked' : 'commented on';
    const title = type === 'POST_LIKE' ? 'New like' : 'New comment';
    const body =
      actorCount > 1
        ? `${actorName} and ${actorCount - 1} ${actorCount - 1 === 1 ? 'other' : 'others'} ${actionText} your post`
        : `${actorName} ${actionText} your post`;

    const data = {
      postId: postId.toString(),
      actorId: actorId.toString(),
      actorName,
      actorCount,
      activityAt: activityAt.toISOString(),
      ...extraData,
    };

    const notification = await this.notificationModel.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        type,
        'data.postId': postId.toString(),
        isDeleted: false,
      },
      {
        $set: {
          title,
          body,
          type,
          data,
          activityAt,
          isRead: false,
          updatedAt: activityAt,
        },
        $setOnInsert: {
          userId: new Types.ObjectId(userId),
          createdAt: activityAt,
          isDeleted: false,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
        timestamps: false,
      },
    );

    this.logger.log(
      `Post activity notification saved. notificationId=${notification?._id?.toString?.()} userId=${userId} postId=${postId} type=${type} body="${body}" shouldSendPush=${shouldSendPush}`,
    );

    if (shouldSendPush) {
      this.logger.log(
        `Post activity push requested. userId=${userId} postId=${postId} type=${type} actorId=${actorId} actorCount=${actorCount}`,
      );
      await this.sendNotification(userId, title, body, type, {
        postId: postId.toString(),
        actorId: actorId.toString(),
        actorName,
        actorCount: actorCount.toString(),
        activityAt: activityAt.toISOString(),
        ...Object.fromEntries(
          Object.entries(extraData).map(([key, value]) => [key, value?.toString?.() ?? String(value)]),
        ),
      });
    } else {
      this.logger.log(
        `Post activity push skipped. userId=${userId} postId=${postId} type=${type} actorId=${actorId} actorCount=${actorCount}`,
      );
    }

    return notification;
  }

  async removePostActivityNotification(
    userId: string | Types.ObjectId,
    postId: string | Types.ObjectId,
    type: PostActivityNotificationType,
  ) {
    return this.notificationModel.updateOne(
      {
        userId: new Types.ObjectId(userId),
        type,
        'data.postId': postId.toString(),
        isDeleted: false,
      },
      {
        $set: {
          isDeleted: true,
          updatedAt: new Date(),
        },
      },
      { timestamps: false },
    );
  }

  async getUserNotifications(userId: string, page: number = 1, limit: number = 20): Promise<NotificationsPage> {
    const skip = (page - 1) * limit;
    const query = { userId: new Types.ObjectId(userId), isDeleted: { $ne: true } };
    const [data, total] = await Promise.all([
      this.notificationModel
        .find(query)
        .sort({ activityAt: -1, updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.notificationModel.countDocuments(query),
    ]);

    const notifications = data as NotificationListItem[];

    return {
      data: notifications.map((notification) => ({
        ...notification,
        createdAt: notification.activityAt || notification.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(notificationId: string) {
    return this.notificationModel.findByIdAndUpdate(notificationId, { isRead: true }, { new: true });
  }

  async markAllAsRead(userId: string) {
    return this.notificationModel.updateMany(
      { userId: new Types.ObjectId(userId), isRead: false, isDeleted: { $ne: true } },
      { isRead: true },
    );
  }

  async bulkDelete(userId: string, notificationIds: string[]) {
    const objectIds = notificationIds.map((id) => new Types.ObjectId(id));
    return this.notificationModel.updateMany(
      {
        _id: { $in: objectIds },
        userId: new Types.ObjectId(userId),
        isDeleted: { $ne: true },
      },
      { isDeleted: true },
    );
  }
}
