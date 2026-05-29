import { Injectable, Logger } from '@nestjs/common';
import { AgoraService } from './agora.service';
import { LiveEvents } from './live.events';
import { MatchesService } from '../matches/matches.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../users/entities/user.entity';
import { Model } from 'mongoose';
import { RtcRole } from 'agora-token';

export interface LiveRoom {
    hostId: string;
    channelName: string;
    startTime: Date;
    viewers: Set<string>;
    token: string;
    coHosts: Map<string, number>;    // userId -> Agora UID (these users publish video/audio)
    joinRequests: Set<string>;       // userIds who requested to join as co-host
    nextUid: number;                 // counter for assigning unique Agora UIDs to co-hosts
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
            coHosts: new Map(),
            joinRequests: new Set(),
            nextUid: 2,
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
            // Also remove from co-hosts if they were one
            room.coHosts.delete(userId);
            // Also remove any pending join request
            room.joinRequests.delete(userId);
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

    // ──────────────── Guest Co-Host Methods ────────────────

    /**
     * Viewer requests to join the live as a co-host.
     * Returns the room if valid, null otherwise.
     */
    requestToJoin(channelName: string, userId: string): LiveRoom | null {
        const room = this.liveRooms.get(channelName);
        if (!room) return null;

        // Can't request if you're the host
        if (room.hostId === userId) return null;

        // Can't request if already a co-host
        if (room.coHosts.has(userId)) return null;

        room.joinRequests.add(userId);
        this.logger.log(`User ${userId} requested to join live: ${channelName}`);
        return room;
    }

    /**
     * Host approves a guest's join request.
     * Returns the guest's PUBLISHER token and UID, or null if invalid.
     */
    approveGuest(channelName: string, hostId: string, guestId: string): { token: string; uid: number } | null {
        const room = this.liveRooms.get(channelName);
        if (!room) return null;

        // Only the host can approve
        if (room.hostId !== hostId) return null;

        // Guest must have a pending request
        if (!room.joinRequests.has(guestId)) return null;

        // Assign a unique UID for the co-host
        const guestUid = room.nextUid++;
        room.joinRequests.delete(guestId);
        room.coHosts.set(guestId, guestUid);

        // Generate PUBLISHER token so the guest can broadcast video/audio
        const guestToken = this.agoraService.generateRtcToken(channelName, guestUid, RtcRole.PUBLISHER);

        this.logger.log(`Host ${hostId} approved guest ${guestId} (UID: ${guestUid}) in channel ${channelName}`);
        return { token: guestToken, uid: guestUid };
    }

    /**
     * Host rejects a guest's join request.
     */
    rejectGuest(channelName: string, hostId: string, guestId: string): boolean {
        const room = this.liveRooms.get(channelName);
        if (!room || room.hostId !== hostId) return false;

        if (!room.joinRequests.has(guestId)) return false;

        room.joinRequests.delete(guestId);
        this.logger.log(`Host ${hostId} rejected guest ${guestId} in channel ${channelName}`);
        return true;
    }

    /**
     * Host removes an active co-host.
     */
    removeGuest(channelName: string, hostId: string, guestId: string): boolean {
        const room = this.liveRooms.get(channelName);
        if (!room || room.hostId !== hostId) return false;

        if (!room.coHosts.has(guestId)) return false;

        room.coHosts.delete(guestId);
        this.logger.log(`Host ${hostId} removed co-host ${guestId} from channel ${channelName}`);
        return true;
    }

    getLiveRooms() {
        return Array.from(this.liveRooms.values()).map(room => ({
            hostId: room.hostId,
            channelName: room.channelName,
            startTime: room.startTime,
            viewerCount: room.viewers.size,
            coHostCount: room.coHosts.size,
            coHostIds: Array.from(room.coHosts.keys()),
        }));
    }

    getRoomByChannel(channelName: string): LiveRoom | undefined {
        return this.liveRooms.get(channelName);
    }
}
