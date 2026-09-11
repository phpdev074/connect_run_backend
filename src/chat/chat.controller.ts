import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  Param,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody, ApiParam } from '@nestjs/swagger';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @ApiOperation({
    summary: 'Start or get a chat (individual, group, team, or race)',
    description:
      'Pass targetUserId for direct chat, groupId for group chat, teamId for team chat, raceId for race chat, or participants array.',
  })
  @ApiBody({ type: CreateChatDto })
  async createChat(@Req() req, @Body() body: CreateChatDto) {
    const data = await this.chatService.createChat(
      req.user.id,
      body.participants,
      body.groupName,
      body.type,
      body.referenceId,
      body.groupImage,
      body.groupId,
      body.teamId,
      body.targetUserId,
      body.raceId,
    );
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Chat initiated successfully',
      data,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get list of my active chats (direct, groups, and teams)' })
  async getMyChats(@Req() req) {
    const data = await this.chatService.getMyChats(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Chats fetched successfully',
      data,
    };
  }

  @Get('group/:groupId')
  @ApiOperation({ summary: 'Get or start a group chat by Group ID' })
  @ApiParam({ name: 'groupId', description: 'ID of the group' })
  async getGroupChat(@Req() req, @Param('groupId') groupId: string) {
    const data = await this.chatService.getOrCreateGroupChat(groupId, req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Group chat fetched successfully',
      data,
    };
  }

  @Post('group/:groupId')
  @ApiOperation({ summary: 'Start or get a group chat by Group ID' })
  @ApiParam({ name: 'groupId', description: 'ID of the group' })
  async startGroupChat(@Req() req, @Param('groupId') groupId: string) {
    const data = await this.chatService.getOrCreateGroupChat(groupId, req.user.id);
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Group chat initiated successfully',
      data,
    };
  }

  @Get('team/:teamId')
  @ApiOperation({ summary: 'Get or start a team chat by Team ID' })
  @ApiParam({ name: 'teamId', description: 'ID of the team' })
  async getTeamChat(@Req() req, @Param('teamId') teamId: string) {
    const data = await this.chatService.getOrCreateTeamChat(teamId, req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Team chat fetched successfully',
      data,
    };
  }

  @Post('team/:teamId')
  @ApiOperation({ summary: 'Start or get a team chat by Team ID' })
  @ApiParam({ name: 'teamId', description: 'ID of the team' })
  async startTeamChat(@Req() req, @Param('teamId') teamId: string) {
    const data = await this.chatService.getOrCreateTeamChat(teamId, req.user.id);
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Team chat initiated successfully',
      data,
    };
  }

  @Get('race/:raceId')
  @ApiOperation({ summary: 'Get or start a race chat by Race ID' })
  @ApiParam({ name: 'raceId', description: 'ID of the race' })
  async getRaceChat(@Req() req, @Param('raceId') raceId: string) {
    const data = await this.chatService.getOrCreateRaceChat(raceId, req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Race chat fetched successfully',
      data,
    };
  }

  @Post('race/:raceId')
  @ApiOperation({ summary: 'Start or get a race chat by Race ID' })
  @ApiParam({ name: 'raceId', description: 'ID of the race' })
  async startRaceChat(@Req() req, @Param('raceId') raceId: string) {
    const data = await this.chatService.getOrCreateRaceChat(raceId, req.user.id);
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Race chat initiated successfully',
      data,
    };
  }

  @Get('direct/:targetUserId')
  @ApiOperation({ summary: 'Get or start an individual chat with target user ID' })
  @ApiParam({ name: 'targetUserId', description: 'ID of the matched target user' })
  async getDirectChat(@Req() req, @Param('targetUserId') targetUserId: string) {
    const data = await this.chatService.getOrCreateDirectChat(req.user.id, targetUserId);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Direct chat fetched successfully',
      data,
    };
  }

  @Post('direct/:targetUserId')
  @ApiOperation({ summary: 'Start or get an individual chat with target user ID' })
  @ApiParam({ name: 'targetUserId', description: 'ID of the matched target user' })
  async startDirectChat(@Req() req, @Param('targetUserId') targetUserId: string) {
    const data = await this.chatService.getOrCreateDirectChat(req.user.id, targetUserId);
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Direct chat initiated successfully',
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
  async updateChat(@Param('id') id: string, @Body() body: UpdateChatDto) {
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
    const data = await this.chatService.sendMessage(
      req.user.id,
      id,
      body.content,
      body.type,
      body.metadata,
    );
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Message sent successfully',
      data,
    };
  }
}
