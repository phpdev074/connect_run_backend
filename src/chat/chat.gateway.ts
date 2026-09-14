import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { UsersService } from '../users/users.service';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: true })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private userSocketMap: Map<string, string> = new Map();

  constructor(
    private readonly chatService: ChatService,
    private readonly usersService: UsersService,
  ) {}

  afterInit(server: Server) {
    console.log('\n\n**************************************************');
    console.log('🚀 CHAT GATEWAY IS ALIVE ON THE BASE URL (/)');
    console.log('**************************************************\n\n');
  }

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    console.log('--------------------------------------------------');
    console.log(
      `[SOCKET CONNECT] ID: ${client.id} | User: ${userId || 'Unknown'}`,
    );
    console.log('--------------------------------------------------');
    if (userId) {
      this.userSocketMap.set(userId, client.id);
      client.data.userId = userId;

      // Update online status
      this.usersService.updateOnlineStatus(userId, true).then(() => {
        this.logger.log(`User ${userId} is now online`);
        this.server.emit('userStatusChanged', { userId, isOnline: true });
      });

      this.chatService.getMyChats(userId).then((chats) => {
        chats.forEach((chat) => {
          console.log(
            `[SOCKET JOIN] User ${userId} joining room: ${chat._id.toString()}`,
          );
          client.join(chat._id.toString());
        });

        client.emit(
          'chatList',
          chats.map((chat) => ({
            chatId: chat._id,
            participants: chat.participants,
            lastMessage: chat.lastMessage,
            lastActivity: chat.lastActivity,
            isLocked: chat.isLocked,
            unreadCount: chat.unreadCount,
            groupName: chat.groupName,
            groupImage: chat.groupImage,
            type: chat.type,
            referenceId: chat.referenceId,
          })),
        );
      });
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    console.log(
      `[SOCKET DISCONNECT] ID: ${client.id} | User: ${userId || 'Unknown'}`,
    );
    if (userId) {
      this.userSocketMap.delete(userId);
      this.usersService.updateOnlineStatus(userId, false).then(() => {
        this.logger.log(`User ${userId} is now offline`);
        this.server.emit('userStatusChanged', {
          userId,
          isOnline: false,
          lastSeen: new Date(),
        });
      });
    }
  }

  @SubscribeMessage('joinDirectChat')
  @SubscribeMessage('joinMatchedChat')
  async handleJoinDirectChat(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = data.userId || client.data.userId;
    const targetId = data.targetId;
    this.logger.log(`User ${userId} joining direct chat with ${targetId}`);

    try {
      const chat = await this.chatService.getOrCreateDirectChat(
        userId,
        targetId,
      );
      client.join(chat._id.toString());
      client.emit('chatJoined', chat);
      return { status: 'joined', chatId: chat._id, chat };
    } catch (error) {
      this.logger.warn(`JoinDirectChat Error: ${error.message}`);
      client.emit('error', { message: error.message });
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('joinGroupChat')
  async handleJoinGroupChat(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = data.userId || client.data.userId;
    const groupId = data.groupId;
    this.logger.log(`User ${userId} joining group chat for group ${groupId}`);

    try {
      const chat = await this.chatService.getOrCreateGroupChat(groupId, userId);
      client.join(chat._id.toString());
      client.emit('chatJoined', chat);
      return { status: 'joined', chatId: chat._id, chat };
    } catch (error) {
      this.logger.warn(`JoinGroupChat Error: ${error.message}`);
      client.emit('error', { message: error.message });
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('joinTeamChat')
  async handleJoinTeamChat(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = data.userId || client.data.userId;
    const teamId = data.teamId;
    this.logger.log(`User ${userId} joining team chat for team ${teamId}`);

    try {
      const chat = await this.chatService.getOrCreateTeamChat(teamId, userId);
      client.join(chat._id.toString());
      client.emit('chatJoined', chat);
      return { status: 'joined', chatId: chat._id, chat };
    } catch (error) {
      this.logger.warn(`JoinTeamChat Error: ${error.message}`);
      client.emit('error', { message: error.message });
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('joinRaceChat')
  async handleJoinRaceChat(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = data.userId || client.data.userId;
    const raceId = data.raceId;
    this.logger.log(`User ${userId} joining race chat for race ${raceId}`);

    try {
      const chat = await this.chatService.getOrCreateRaceChat(raceId, userId);
      client.join(chat._id.toString());
      client.emit('chatJoined', chat);
      return { status: 'joined', chatId: chat._id, chat };
    } catch (error) {
      this.logger.warn(`JoinRaceChat Error: ${error.message}`);
      client.emit('error', { message: error.message });
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() data: { chatId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data?.chatId)
      return { status: 'error', message: 'chatId is required' };

    const userId =
      client.data.userId || (client.handshake.query.userId as string);
    try {
      // Enforce participant/membership check before allowing room join
      const chat = await this.chatService.getChat(data.chatId, userId);
      if (!chat) {
        return { status: 'error', message: 'Chat not found' };
      }
      client.join(chat._id.toString());
      return { status: 'joined', chatId: chat._id };
    } catch (error) {
      this.logger.warn(`JoinRoom Error: ${error.message}`);
      client.emit('error', { message: error.message });
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('getChatList')
  async handleGetChatList(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    const userId =
      data?.userId ||
      client.data.userId ||
      (client.handshake.query.userId as string);
    this.logger.debug(`User ${userId} getting chat list`);

    const chats = await this.chatService.getMyChats(userId);

    const formattedChats = chats.map((chat) => {
      return {
        chatId: chat._id.toString(),
        participants: chat.participants,
        lastMessage: chat.lastMessage || '',
        lastActivity: chat.lastActivity,
        isLocked: !!chat.isLocked,
        unreadCount: chat.unreadCount,
        groupName: chat.groupName,
        groupImage: chat.groupImage,
        type: chat.type,
        referenceId: chat.referenceId,
      };
    });
    client.emit('chatList', formattedChats);
    return formattedChats;
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const chatId = data.chatId.toString();
      const senderId = data.senderId || client.data.userId;
      const message = await this.chatService.sendMessage(
        senderId.toString(),
        chatId,
        data.content,
        data.type,
        data.metadata,
      );
      this.server.to(chatId).emit('newMessage', message);
      this.logger.debug(`Broadcasted newMessage to room: ${chatId}`);
      return message;
    } catch (error) {
      this.logger.warn(`SendMessage Logic Error: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('getChatMessages')
  async handleGetChatMessages(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = data.userId || client.data.userId;
      const messages = await this.chatService.getMessages(data.chatId, userId);
      client.emit('messages', messages);
      return { status: 'messages', messages };
    } catch (error) {
      this.logger.warn(`GetChatMessages Error: ${error.message}`);
      client.emit('error', { message: error.message });
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('getMatches')
  async handleGetMatches(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = data.userId || client.data.userId;
    const matches = await this.chatService.getUserMatches(userId);
    return matches.map((match) => ({
      matchId: match._id,
      users: match.users.map((u) => ({
        _id: u._id,
        first_name: u.first_name,
        last_name: u.last_name,
        display_name: u.display_name,
        image: u.image,
      })),
    }));
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @MessageBody()
    data: { chatId: string; userId: string; isTyping: boolean },
    @ConnectedSocket() client: Socket,
  ) {
    this.server.to(data.chatId).emit('userTyping', {
      userId: data.userId || client.data.userId,
      isTyping: data.isTyping,
      chatId: data.chatId,
    });
  }

  @SubscribeMessage('readMessage')
  async handleReadMessage(
    @MessageBody() data: { chatId: string; userId: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = data.userId || client.data.userId;
      await this.chatService.markAsRead(userId, data.chatId);
      this.server.to(data.chatId).emit('messagesRead', {
        chatId: data.chatId,
        userId: userId,
      });
    } catch (error) {
      this.logger.error(`Error marking messages as read: ${error.message}`);
    }
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @MessageBody()
    data: {
      messageIds: string[];
      userId: string;
      chatId: string;
      mode?: 'me' | 'everyone';
    },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const userId = data.userId || client.data.userId;
      const mode = data.mode || 'everyone';
      const result = await this.chatService.deleteMessages(
        userId,
        data.messageIds,
        mode,
      );

      if (mode === 'everyone') {
        this.server.to(data.chatId).emit('messagesDeleted', {
          messageIds: data.messageIds,
          chatId: data.chatId,
          mode: 'everyone',
        });
      } else {
        client.emit('messagesDeleted', {
          messageIds: data.messageIds,
          chatId: data.chatId,
          mode: 'me',
        });
      }
      return { ...result, messageIds: data.messageIds };
    } catch (error) {
      this.logger.error(`Error deleting messages: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }
}
