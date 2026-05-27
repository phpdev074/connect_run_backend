import { Injectable, Logger } from '@nestjs/common';
import { AgoraService } from './agora.service';
import { LiveEvents } from './live.events';

// import { FollowsService } from '../follows/follows.service';
// import { PushNotificationService } from '../notification/push-notification.service';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../users/entities/user.entity';
import { Model } from 'mongoose';

export interface LiveRoom {
    hostId: string;
    channelName: string;
    startTime: Date;
    viewers: Set<string>;
    token: string;
}

@Injectable()
export class LiveStreamingService {
    private readonly logger = new Logger(LiveStreamingService.name);
    private readonly liveRooms: Map<string, LiveRoom> = new Map();

    constructor(
        private readonly agoraService: AgoraService,
        // private readonly followsService: FollowsService,
        // private readonly pushNotificationService: PushNotificationService,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    ) { }

    async startLive(hostId: string, channelName: string): Promise<LiveRoom> {
        const token = this.agoraService.generateRtcToken(channelName, 0); 
        const room: LiveRoom = {
            hostId,
            channelName,
            startTime: new Date(),
            viewers: new Set(),
            token,
        };
        this.liveRooms.set(channelName, room);

        // Notify followers
        // this.notifyFollowers(hostId, channelName);

        this.logger.log(`Live started: ${channelName} by host ${hostId}`);
        return room;
    }

    // private async notifyFollowers(hostId: string, channelName: string) {
    //     try {
    //         const host = await this.userModel.findById(hostId).select('name').lean();
    //         const followerIds = await this.followsService.getFollowersIds(hostId);
            
    //         if (!followerIds.length) return;

    //         const followers = await this.userModel.find({
    //             _id: { $in: followerIds },
    //             deviceToken: { $exists: true, $ne: null }
    //         }).select('deviceToken').lean();

    //         const tokens = followers.map(f => f.deviceToken).flat().filter((t): t is string => !!t);

    //         if (tokens.length) {
    //             await this.pushNotificationService.sendBulkNotification({
    //                 tokens,
    //                 title: 'Live Streaming',
    //                 body: `${host?.name || 'Someone'} is live now!`,
    //                 type: 'live',
    //                 data: {
    //                     channelName,
    //                     hostId
    //                 }
    //             });
    //         }
    //     } catch (error) {
    //         this.logger.error('Failed to notify followers about live', error);
    //     }
    // }

    joinLive(channelName: string, userId: string): LiveRoom | null {
        const room = this.liveRooms.get(channelName);
        if (room) {
            room.viewers.add(userId);
            this.logger.log(`User ${userId} joined live: ${channelName}`);
            return room;
        }
        return null;
    }

    leaveLive(channelName: string, userId: string): void {
        const room = this.liveRooms.get(channelName);
        if (room) {
            room.viewers.delete(userId);
            this.logger.log(`User ${userId} left live: ${channelName}`);
        }
    }

    endLive(channelName: string, hostId: string): boolean {
        const room = this.liveRooms.get(channelName);
        if (room && room.hostId === hostId) {
            this.liveRooms.delete(channelName);
            this.logger.log(`Live ended: ${channelName} by host ${hostId}`);
            return true;
        }
        return false;
    }

    getLiveRooms() {
        return Array.from(this.liveRooms.values()).map(room => ({
            hostId: room.hostId,
            channelName: room.channelName,
            startTime: room.startTime,
            viewerCount: room.viewers.size,
        }));
    }

    getRoomByChannel(channelName: string): LiveRoom | undefined {
        return this.liveRooms.get(channelName);
    }
}
