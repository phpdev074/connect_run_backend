import { Injectable, Logger } from '@nestjs/common';
import { AgoraService } from './agora.service';
import { LiveEvents } from './live.events';
import { MatchesService } from '../matches/matches.service';
import { NotificationsService } from '../notifications/notifications.service';
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
        private readonly matchesService: MatchesService,
        private readonly notificationsService: NotificationsService,
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

        // Notify matches (friends)
        this.notifyMatches(hostId, channelName);

        this.logger.log(`Live started: ${channelName} by host ${hostId}`);
        return room;
    }

    private async notifyMatches(hostId: string, channelName: string) {
        try {
            const host = await this.userModel.findById(hostId).select('display_name first_name').lean();
            const matches = await this.matchesService.getMatches(hostId);
            
            if (!matches.length) return;

            const hostName = host?.display_name || host?.first_name || 'Someone';
            this.logger.log(`Notifying ${matches.length} matches about live stream from ${hostName}`);

            for (const match of matches) {
                // Find the other user in the match
                const otherUser = match.users.find(u => u._id.toString() !== hostId);
                if (!otherUser) continue;

                await this.notificationsService.sendAndSave(
                    otherUser._id.toString(),
                    'Live Stream',
                    `${hostName} is live now!`,
                    'LIVE_START',
                    {
                        channelName,
                        hostId,
                        hostName
                    }
                );
            }
        } catch (error) {
            this.logger.error('Failed to notify matches about live', error);
        }
    }

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
