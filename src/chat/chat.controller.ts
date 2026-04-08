import { Controller, Get, Post, Body, Req, UseGuards, Param, HttpStatus, Patch } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) { }

  @Post()
  @ApiOperation({ summary: 'Start a new chat or retrieve existing one with a user' })
  @ApiBody({ type: CreateChatDto })
  async createChat(@Req() req, @Body() body: CreateChatDto) {
    const data = await this.chatService.createChat(req.user.id, body.targetId);
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Chat initiated successfully',
      data,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get list of my active chats' })
  async getMyChats(@Req() req) {
    const data = await this.chatService.getMyChats(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Chats fetched successfully',
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific chat' })
  async getChat(@Req() req, @Param('id') id: string) {
    const data = await this.chatService.getChat(id, req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Chat details fetched successfully',
      data,
    };
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get message history for a chat' })
  async getMessages(@Req() req, @Param('id') id: string) {
    const data = await this.chatService.getMessages(id, req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Messages fetched successfully',
      data,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update chat status (lock/unlock, expiration)' })
  @ApiBody({ type: UpdateChatDto })
  async updateChat(
    @Param('id') id: string,
    @Body() body: UpdateChatDto,
  ) {
    const data = await this.chatService.update(id, body);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Chat updated successfully',
      data,
    };
  }

  @Post(':id/message')
  @ApiOperation({ summary: 'Send a new message or invite' })
  @ApiBody({ type: SendMessageDto })
  async sendMessage(
    @Req() req,
    @Param('id') id: string,
    @Body() body: SendMessageDto,
  ) {
    const data = await this.chatService.sendMessage(req.user.id, id, body.content, body.type);
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Message sent successfully',
      data,
    };
  }
}
