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
            this.logger.log(`Live Socket connected: ${client.id}, User: ${userId}`);
        } catch (error) {
            this.logger.error(`Live Socket connection failed: ${error.message}`);
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Live Socket disconnected: ${client.id}`);
        // Handle unexpected viewer disconnection?
    }

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
            client.emit(LiveEvents.LIVE_ERROR, { message: 'LIVE_ROOM_NOT_FOUND' });
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

        this.liveService.leaveLive(channelName, userId);
        client.leave(channelName);

        const room = this.liveService.getRoomByChannel(channelName);
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
}
