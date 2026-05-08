import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { Logger, UseGuards } from '@nestjs/common';

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private userSocketMap: Map<string, string> = new Map();

  constructor(private readonly chatService: ChatService) { }

  afterInit(server: Server) {
    console.log('\n\n**************************************************');
    console.log('🚀 CHAT GATEWAY IS ALIVE ON THE BASE URL (/)');
    console.log('**************************************************\n\n');
  }

  handleConnection(client: Socket) {
    // Expect userId in handshake query
    const userId = client.handshake.query.userId as string;
    console.log('--------------------------------------------------');
    console.log(`[SOCKET CONNECT] ID: ${client.id} | User: ${userId || 'Unknown'}`);
    console.log('--------------------------------------------------');
    if (userId) {

      this.userSocketMap.set(userId, client.id);
      client.data.userId = userId;
      this.chatService.getMyChats(userId).then(chats => {
        chats.forEach(chat => {
          console.log(`[SOCKET JOIN] User ${userId} joining room: ${chat._id.toString()}`);
          client.join(chat._id.toString());
        });

        client.emit('chatList', chats.map(chat => ({
          chatId: chat._id,
          participants: chat.participants,
          lastMessage: chat.lastMessage,
          lastActivity: chat.lastActivity,
          isLocked: chat.isLocked,
        })));
      });
    }
  }

  handleDisconnect(client: Socket) {
    // Remove user from map
    const userId = client.data.userId;
    console.log(`[SOCKET DISCONNECT] ID: ${client.id} | User: ${userId || 'Unknown'}`);
    if (userId) {
      this.userSocketMap.delete(userId);
    }
  }


  @SubscribeMessage('joinMatchedChat')
  async handleJoinMatchedChat(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    this.logger.log(`User ${data.userId} joining chat with ${data.targetId}`);
    const canChat = await this.chatService.canUsersChat(data.userId, data.targetId);
    this.logger.debug(`Can chat: ${canChat}`);
    if (!canChat) {
      client.emit('error', { message: 'You can only chat with matched users' });
      return;
    }
    const chat = await this.chatService.createChat(data.userId, [data.userId, data.targetId]);
    client.join(chat._id.toString());
    client.emit('chatJoined', chat);
    return { status: 'joined', chatId: chat._id };
  }

  @SubscribeMessage('getChatList')
  async handleGetChatList(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const userId = data?.userId || client.handshake.query.userId as string;
    this.logger.debug(`User ${userId} getting chat list`);

    const chats = await this.chatService.getMyChats(userId);

    const formattedChats = chats.map(chat => {
      const chatObj = chat.toObject ? chat.toObject() : chat;
      return {
        chatId: chatObj._id.toString(),
        participants: chatObj.participants,
        lastMessage: chatObj.lastMessage || '',
        lastActivity: chatObj.lastActivity,
        isLocked: !!chatObj.isLocked,
      };
    });
    client.emit('chatList', formattedChats);
    return formattedChats;
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    try {
      const chatId = data.chatId.toString();
      const message = await this.chatService.sendMessage(data.senderId.toString(), chatId, data.content);
      this.server.to(chatId).emit('newMessage', message);
      this.logger.debug(`Broadcasted newMessage to room: ${chatId}`);
      // return message;
    } catch (error) {
      this.logger.warn(`SendMessage Logic Error: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('getChatMessages')
  async handleGetChatMessages(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    // data: { chatId, userId }
    const messages = await this.chatService.getMessages(data.chatId, data.userId);
    client.emit('messages', messages);
    return { status: 'messages', messages };
  }


  @SubscribeMessage('getMatches')
  async handleGetMatches(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    // data: { userId }
    const matches = await this.chatService.getUserMatches(data.userId);
    return matches.map(match => ({
      matchId: match._id,
      users: match.users.map(u => ({
        _id: u._id,
        first_name: u.first_name,
        last_name: u.last_name,
        display_name: u.display_name,
        image: u.image,
      })),
    }));
  }

  @SubscribeMessage('typing')
  async handleTyping(@MessageBody() data: { chatId: string, userId: string, isTyping: boolean }, @ConnectedSocket() client: Socket) {
    this.server.to(data.chatId).emit('userTyping', {
      userId: data.userId,
      isTyping: data.isTyping,
      chatId: data.chatId
    });
  }

  @SubscribeMessage('readMessage')
  async handleReadMessage(@MessageBody() data: { chatId: string, userId: string }, @ConnectedSocket() client: Socket) {
    try {
      await this.chatService.markAsRead(data.userId, data.chatId);
      this.server.to(data.chatId).emit('messagesRead', {
        chatId: data.chatId,
        userId: data.userId
      });
    } catch (error) {
      this.logger.error(`Error marking messages as read: ${error.message}`);
    }
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(@MessageBody() data: { messageIds: string[], userId: string, chatId: string, mode?: 'me' | 'everyone' }, @ConnectedSocket() client: Socket) {
    try {
      const mode = data.mode || 'everyone';
      const result = await this.chatService.deleteMessages(data.userId, data.messageIds, mode);

      if (mode === 'everyone') {
        // Notify everyone in the room
        this.server.to(data.chatId).emit('messagesDeleted', {
          messageIds: data.messageIds,
          chatId: data.chatId,
          mode: 'everyone'
        });
      } else {
        // Only notify the user who deleted for themselves
        client.emit('messagesDeleted', {
          messageIds: data.messageIds,
          chatId: data.chatId,
          mode: 'me'
        });
      }
      return { ...result, messageIds: data.messageIds };
    } catch (error) {
      this.logger.error(`Error deleting messages: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }
}
