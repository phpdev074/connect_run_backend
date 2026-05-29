import {
    WebSocketGateway,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { LiveEvents } from './live.events';
import { LiveStreamingService } from './live-streaming.service';
import { ChatService } from '../chat/chat.service';
import { AgoraService } from './agora.service';

@WebSocketGateway({
    cors: { origin: '*' },
})
export class LiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;
    private readonly logger = new Logger(LiveGateway.name);

    // Track userId -> socketId for targeted emissions (e.g. sending token to approved guest)
    private readonly userSocketMap: Map<string, string> = new Map();

    constructor(
        private readonly liveService: LiveStreamingService,
        private readonly chatService: ChatService,
        private readonly agoraService: AgoraService,
    ) {
        this.logger.log('LiveGateway initialized');
    }

    async handleConnection(client: Socket) {
        try {
            const authHeader = client.handshake.headers.authorization || client.handshake.auth?.token;
            if (!authHeader) {
                this.logger.warn(`Live connection rejected - NO_TOKEN for socket id: ${client.id}`);
                client.disconnect();
                return;
            }

            const token = authHeader.replace('Bearer ', '');
            const user = await this.chatService.verifyToken(token);
            const userId = (user.sub || user._id || user.id)?.toString();

            if (!userId) {
                throw new Error('USER_ID_NOT_FOUND');
            }

            client.data.userId = userId;
            this.userSocketMap.set(userId, client.id);
            this.logger.log(`Live Socket connected: ${client.id}, User: ${userId}`);
        } catch (error) {
            this.logger.error(`Live Socket connection failed: ${error.message}`);
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        const userId = client.data?.userId;
        if (userId) {
            this.userSocketMap.delete(userId);
        }
        this.logger.log(`Live Socket disconnected: ${client.id}`);
        // Handle unexpected viewer disconnection?
    }

    // ──────────────── Existing Handlers (UNCHANGED) ────────────────

    @SubscribeMessage(LiveEvents.START_LIVE)
    async handleStartLive(
        @MessageBody() data: { channelName: string },
        @ConnectedSocket() client: Socket,
    ) {
        const hostId = client.data.userId;
        const channelName = data.channelName;

        const room = await this.liveService.startLive(hostId, channelName);
        client.join(channelName);

        client.emit(LiveEvents.LIVE_STARTED, {
            channelName,
            hostId,
            token: room.token,
        });

        this.logger.log(`Host ${hostId} started live in channel ${channelName}`);

        // Broadcast to all connected clients (except host) that a new live started
        // Note: Broadcast to all clients in the /live namespace
        this.server.emit(LiveEvents.LIVE_ROOM_LIST, this.liveService.getLiveRooms());
    }

    @SubscribeMessage(LiveEvents.JOIN_LIVE)
    async handleJoinLive(
        @MessageBody() data: { channelName: string },
        @ConnectedSocket() client: Socket,
    ) {
        const userId = client.data.userId;
        const channelName = data.channelName;

        const room = this.liveService.joinLive(channelName, userId);
        if (!room) {
            client.emit(LiveEvents.LIVE_ERROR, { message: 'This live stream has ended.' });
            return;
        }

        client.join(channelName);

        // Generate a viewer token for this user
        const viewerToken = this.agoraService.generateRtcToken(channelName, 0); // Viewers also use UID 0 for simplicity if needed

        client.emit(LiveEvents.USER_JOINED_LIVE, {
            channelName,
            userId,
            token: viewerToken,
            viewerCount: room.viewers.size,
        });

        // Notify host and other viewers
        this.server.to(channelName).emit(LiveEvents.USER_JOINED_LIVE, {
            userId,
            viewerCount: room.viewers.size,
        });
    }

    @SubscribeMessage(LiveEvents.LEAVE_LIVE)
    async handleLeaveLive(
        @MessageBody() data: { channelName: string },
        @ConnectedSocket() client: Socket,
    ) {
        const userId = client.data.userId;
        const channelName = data.channelName;

        // Check if user was a co-host before leaving
        const roomBefore = this.liveService.getRoomByChannel(channelName);
        const wasCoHost = roomBefore?.coHosts.has(userId) || false;

        this.liveService.leaveLive(channelName, userId);
        client.leave(channelName);

        const room = this.liveService.getRoomByChannel(channelName);

        // If the user was a co-host, notify the room they left co-hosting
        if (wasCoHost) {
            this.server.to(channelName).emit(LiveEvents.GUEST_REMOVED, {
                guestId: userId,
                coHostIds: room ? Array.from(room.coHosts.keys()) : [],
                viewerCount: room ? room.viewers.size : 0,
            });
        }

        this.server.to(channelName).emit(LiveEvents.USER_LEFT_LIVE, {
            userId,
            viewerCount: room ? room.viewers.size : 0,
        });
    }

    @SubscribeMessage(LiveEvents.END_LIVE)
    async handleEndLive(
        @MessageBody() data: { channelName: string },
        @ConnectedSocket() client: Socket,
    ) {
        const hostId = client.data.userId;
        const channelName = data.channelName;

        const success = this.liveService.endLive(channelName, hostId);
        if (success) {
            this.server.to(channelName).emit(LiveEvents.LIVE_ENDED, { channelName });
            this.logger.log(`Live ended by host for channel ${channelName}`);

            // Clean up: everyone leaves the room
            const sockets = await this.server.in(channelName).fetchSockets();
            sockets.forEach(s => s.leave(channelName));

            // Broadcast room list update
            this.server.emit(LiveEvents.LIVE_ROOM_LIST, this.liveService.getLiveRooms());
        } else {
            client.emit(LiveEvents.LIVE_ERROR, { message: 'FAILED_TO_END_LIVE' });
        }
    }

    @SubscribeMessage(LiveEvents.LIVE_MESSAGE)
    async handleLiveMessage(
        @MessageBody() data: { channelName: string; content: string },
        @ConnectedSocket() client: Socket,
    ) {
        const userId = client.data.userId;
        const { channelName, content } = data;

        this.server.to(channelName).emit(LiveEvents.LIVE_MESSAGE, {
            userId,
            content,
            timestamp: new Date(),
        });
    }

    @SubscribeMessage(LiveEvents.GET_LIVE_ROOMS)
    handleGetLiveRooms(@ConnectedSocket() client: Socket) {
        const rooms = this.liveService.getLiveRooms();
        this.logger.log(`User ${client.data.userId} requested live rooms. Sending ${rooms.length} rooms.`);
        client.emit(LiveEvents.LIVE_ROOM_LIST, rooms);
    }

    // ──────────────── Guest Co-Host Handlers (NEW) ────────────────

    /**
     * Viewer requests to join the live as a co-host (like Instagram "Request to Join")
     * Payload: { channelName: string }
     */
    @SubscribeMessage(LiveEvents.REQUEST_JOIN_LIVE)
    async handleRequestJoinLive(
        @MessageBody() data: { channelName: string },
        @ConnectedSocket() client: Socket,
    ) {
        const userId = client.data.userId;
        const channelName = data.channelName;

        const room = this.liveService.requestToJoin(channelName, userId);
        if (!room) {
            client.emit(LiveEvents.LIVE_ERROR, { message: 'CANNOT_REQUEST_JOIN' });
            return;
        }

        // Notify the HOST that someone wants to join
        const hostSocketId = this.userSocketMap.get(room.hostId);
        if (hostSocketId) {
            this.server.to(hostSocketId).emit(LiveEvents.JOIN_REQUEST_RECEIVED, {
                channelName,
                userId,       // Who is requesting
            });
        }

        this.logger.log(`User ${userId} requested to co-host in ${channelName}`);
    }

    /**
     * Host approves a guest's join request
     * Payload: { channelName: string, guestId: string }
     */
    @SubscribeMessage(LiveEvents.APPROVE_GUEST)
    async handleApproveGuest(
        @MessageBody() data: { channelName: string; guestId: string },
        @ConnectedSocket() client: Socket,
    ) {
        const hostId = client.data.userId;
        const { channelName, guestId } = data;

        const result = this.liveService.approveGuest(channelName, hostId, guestId);
        if (!result) {
            client.emit(LiveEvents.LIVE_ERROR, { message: 'CANNOT_APPROVE_GUEST' });
            return;
        }

        // Send the PUBLISHER token to the approved guest
        const guestSocketId = this.userSocketMap.get(guestId);
        if (guestSocketId) {
            this.server.to(guestSocketId).emit(LiveEvents.GUEST_APPROVED, {
                channelName,
                token: result.token,    // PUBLISHER token for the guest
                uid: result.uid,        // Unique Agora UID for the guest
            });
        }

        // Notify the entire room that a new co-host has joined
        const room = this.liveService.getRoomByChannel(channelName);
        this.server.to(channelName).emit(LiveEvents.COHOST_JOINED, {
            guestId,
            guestUid: result.uid,
            coHosts: room ? Array.from(room.coHosts.entries()).map(([id, uid]) => ({ userId: id, uid })) : [],
        });

        this.logger.log(`Guest ${guestId} approved as co-host in ${channelName}`);
    }

    /**
     * Host rejects a guest's join request
     * Payload: { channelName: string, guestId: string }
     */
    @SubscribeMessage(LiveEvents.REJECT_GUEST)
    async handleRejectGuest(
        @MessageBody() data: { channelName: string; guestId: string },
        @ConnectedSocket() client: Socket,
    ) {
        const hostId = client.data.userId;
        const { channelName, guestId } = data;

        const success = this.liveService.rejectGuest(channelName, hostId, guestId);
        if (!success) {
            client.emit(LiveEvents.LIVE_ERROR, { message: 'CANNOT_REJECT_GUEST' });
            return;
        }

        // Notify the rejected guest
        const guestSocketId = this.userSocketMap.get(guestId);
        if (guestSocketId) {
            this.server.to(guestSocketId).emit(LiveEvents.GUEST_REJECTED, {
                channelName,
                message: 'Your request to join was declined',
            });
        }

        this.logger.log(`Guest ${guestId} rejected from co-hosting in ${channelName}`);
    }

    /**
     * Host removes an active co-host (kicks them back to viewer)
     * Payload: { channelName: string, guestId: string }
     */
    @SubscribeMessage(LiveEvents.REMOVE_GUEST)
    async handleRemoveGuest(
        @MessageBody() data: { channelName: string; guestId: string },
        @ConnectedSocket() client: Socket,
    ) {
        const hostId = client.data.userId;
        const { channelName, guestId } = data;

        const success = this.liveService.removeGuest(channelName, hostId, guestId);
        if (!success) {
            client.emit(LiveEvents.LIVE_ERROR, { message: 'CANNOT_REMOVE_GUEST' });
            return;
        }

        // Notify the removed guest — they should switch back to viewer mode
        const guestSocketId = this.userSocketMap.get(guestId);
        if (guestSocketId) {
            this.server.to(guestSocketId).emit(LiveEvents.GUEST_REMOVED, {
                channelName,
                guestId,
                message: 'You have been removed from co-hosting',
            });
        }

        // Notify the entire room
        const room = this.liveService.getRoomByChannel(channelName);
        this.server.to(channelName).emit(LiveEvents.GUEST_REMOVED, {
            guestId,
            coHostIds: room ? Array.from(room.coHosts.keys()) : [],
            viewerCount: room ? room.viewers.size : 0,
        });

        this.logger.log(`Co-host ${guestId} removed by host from ${channelName}`);
    }
}
