import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './entities/notification.entity';
import { FirebaseService } from '../utils/firebase.service';
import { UsersService } from '../users/users.service';

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
      if (tokens.length > 0) {
        // Merge type into data for push payload
        const payload = { ...data, notificationType: type };
        for (const token of tokens) {
          await this.firebaseService.sendPushNotification(token, title, message, payload);
        }
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

    // 2. Send push notification if token exists
    try {
      const tokens = await this.userService.getFcmTokens([userId.toString()]);
      if (tokens.length > 0) {
        // Merge type into data for push payload
        const payload = { ...data, type };
        for (const token of tokens) {
          await this.firebaseService.sendPushNotification(token, title, body, payload);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to send push notification to user ${userId}`, error.stack);
    }

    return notification;
  }

  async getUserNotifications(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const query = { userId: new Types.ObjectId(userId), isDeleted: { $ne: true } };
    const [data, total] = await Promise.all([
      this.notificationModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.notificationModel.countDocuments(query),
    ]);

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
